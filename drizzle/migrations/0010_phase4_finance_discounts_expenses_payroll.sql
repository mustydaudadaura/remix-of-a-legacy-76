-- Phase 4: finance deepening — invoice discounts/scholarships, expense book, staff payroll

-- 1. Discounts and waivers on invoices -------------------------------------
ALTER TABLE public.fee_invoices
  ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_kind text,
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS discount_approved_by uuid,
  ADD COLUMN IF NOT EXISTS discount_approved_at timestamp with time zone;

-- 2. Finance manager helper (school admins and super admins only) ----------
CREATE OR REPLACE FUNCTION public.manages_school_finance(_user_id uuid, _school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT public.is_super_admin(_user_id)
      OR EXISTS (SELECT 1 FROM public.user_roles
                 WHERE user_id = _user_id AND school_id = _school_id AND role = 'school_admin');
$$;
GRANT EXECUTE ON FUNCTION public.manages_school_finance(uuid, uuid) TO authenticated;

-- 3. Expense book ----------------------------------------------------------
CREATE TABLE public.school_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  expense_no text NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL,
  spent_on date NOT NULL DEFAULT current_date,
  paid_to text,
  method text NOT NULL DEFAULT 'cash',
  reference text,
  notes text,
  recorded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT school_expenses_expense_no_unique UNIQUE (school_id, expense_no),
  CONSTRAINT school_expenses_amount_positive CHECK (amount > 0)
);
CREATE INDEX school_expenses_school_date_idx ON public.school_expenses (school_id, spent_on DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_expenses TO authenticated;
GRANT ALL ON public.school_expenses TO service_role;
ALTER TABLE public.school_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_expenses_read ON public.school_expenses FOR SELECT TO authenticated
  USING (public.school_permission(auth.uid(), school_id, 'fees.view'));
CREATE POLICY school_expenses_insert ON public.school_expenses FOR INSERT TO authenticated
  WITH CHECK (public.school_permission(auth.uid(), school_id, 'fees.edit') AND recorded_by = auth.uid());
CREATE POLICY school_expenses_update ON public.school_expenses FOR UPDATE TO authenticated
  USING (public.school_permission(auth.uid(), school_id, 'fees.edit'))
  WITH CHECK (public.school_permission(auth.uid(), school_id, 'fees.edit'));
CREATE POLICY school_expenses_delete ON public.school_expenses FOR DELETE TO authenticated
  USING (public.school_permission(auth.uid(), school_id, 'fees.edit'));
CREATE TRIGGER school_expenses_updated_at BEFORE UPDATE ON public.school_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER school_expenses_validate_tenant BEFORE INSERT OR UPDATE ON public.school_expenses
  FOR EACH ROW EXECUTE FUNCTION validate_school_record_links();
CREATE TRIGGER school_expenses_audit AFTER INSERT OR UPDATE OR DELETE ON public.school_expenses
  FOR EACH ROW EXECUTE FUNCTION capture_school_audit();

-- 4. Scholarships (standing discount per student) --------------------------
CREATE TABLE public.student_scholarships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  label text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL,
  session text NOT NULL,
  term term_name,
  status text NOT NULL DEFAULT 'active',
  approved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_scholarships_type_check CHECK (discount_type IN ('percent','flat')),
  CONSTRAINT student_scholarships_status_check CHECK (status IN ('active','stopped'))
);
CREATE INDEX student_scholarships_lookup_idx ON public.student_scholarships (school_id, student_id, session);

CREATE OR REPLACE FUNCTION public.validate_student_scholarship()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.discount_type = 'percent' AND (NEW.discount_value <= 0 OR NEW.discount_value > 100) THEN
    RAISE EXCEPTION 'A percentage scholarship must be between 1 and 100';
  END IF;
  IF NEW.discount_type = 'flat' AND NEW.discount_value <= 0 THEN
    RAISE EXCEPTION 'A flat scholarship must be greater than zero';
  END IF;
  IF NULLIF(BTRIM(NEW.label), '') IS NULL THEN
    RAISE EXCEPTION 'Give the scholarship a name';
  END IF;
  IF NEW.approved_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.approved_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER student_scholarships_validate BEFORE INSERT OR UPDATE ON public.student_scholarships
  FOR EACH ROW EXECUTE FUNCTION public.validate_student_scholarship();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_scholarships TO authenticated;
GRANT ALL ON public.student_scholarships TO service_role;
ALTER TABLE public.student_scholarships ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_scholarships_read ON public.student_scholarships FOR SELECT TO authenticated
  USING (public.school_permission(auth.uid(), school_id, 'fees.view'));
CREATE POLICY student_scholarships_write ON public.student_scholarships FOR INSERT TO authenticated
  WITH CHECK (public.school_permission(auth.uid(), school_id, 'fees.edit'));
CREATE POLICY student_scholarships_modify ON public.student_scholarships FOR UPDATE TO authenticated
  USING (public.school_permission(auth.uid(), school_id, 'fees.edit'))
  WITH CHECK (public.school_permission(auth.uid(), school_id, 'fees.edit'));
CREATE POLICY student_scholarships_remove ON public.student_scholarships FOR DELETE TO authenticated
  USING (public.school_permission(auth.uid(), school_id, 'fees.edit'));
CREATE TRIGGER student_scholarships_validate_tenant BEFORE INSERT OR UPDATE ON public.student_scholarships
  FOR EACH ROW EXECUTE FUNCTION validate_school_record_links();
CREATE TRIGGER student_scholarships_audit AFTER INSERT OR UPDATE OR DELETE ON public.student_scholarships
  FOR EACH ROW EXECUTE FUNCTION capture_school_audit();

-- 5. Payroll: monthly salary settings and salary records -------------------
CREATE TABLE public.staff_salary_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  user_id uuid NOT NULL,
  basic numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_salary_settings_unique UNIQUE (school_id, user_id),
  CONSTRAINT staff_salary_settings_positive CHECK (basic >= 0 AND allowances >= 0)
);

CREATE TABLE public.staff_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  user_id uuid NOT NULL,
  month date NOT NULL,
  payslip_no text NOT NULL,
  basic numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  net numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  method text,
  reference text,
  notes text,
  recorded_by uuid,
  paid_by uuid,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_salaries_payslip_unique UNIQUE (school_id, payslip_no),
  CONSTRAINT staff_salaries_month_unique UNIQUE (school_id, user_id, month),
  CONSTRAINT staff_salaries_status_check CHECK (status IN ('pending','paid')),
  CONSTRAINT staff_salaries_positive CHECK (basic >= 0 AND allowances >= 0 AND deductions >= 0)
);
CREATE INDEX staff_salaries_month_idx ON public.staff_salaries (school_id, month DESC);

CREATE OR REPLACE FUNCTION public.compute_staff_salary()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  NEW.month := DATE_TRUNC('month', NEW.month)::date;
  NEW.net := GREATEST(COALESCE(NEW.basic,0) + COALESCE(NEW.allowances,0) - COALESCE(NEW.deductions,0), 0);
  IF COALESCE(NEW.deductions,0) > COALESCE(NEW.basic,0) + COALESCE(NEW.allowances,0) THEN
    RAISE EXCEPTION 'Deductions cannot be more than the salary earned';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER staff_salaries_compute BEFORE INSERT OR UPDATE ON public.staff_salaries
  FOR EACH ROW EXECUTE FUNCTION public.compute_staff_salary();
CREATE TRIGGER staff_salaries_validate_tenant BEFORE INSERT OR UPDATE ON public.staff_salaries
  FOR EACH ROW EXECUTE FUNCTION validate_school_record_links();
CREATE TRIGGER staff_salary_settings_validate_tenant BEFORE INSERT OR UPDATE ON public.staff_salary_settings
  FOR EACH ROW EXECUTE FUNCTION validate_school_record_links();
CREATE TRIGGER staff_salaries_audit AFTER INSERT OR UPDATE OR DELETE ON public.staff_salaries
  FOR EACH ROW EXECUTE FUNCTION capture_school_audit();
CREATE TRIGGER staff_salary_settings_audit AFTER INSERT OR UPDATE OR DELETE ON public.staff_salary_settings
  FOR EACH ROW EXECUTE FUNCTION capture_school_audit();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_salary_settings TO authenticated;
GRANT ALL ON public.staff_salary_settings TO service_role;
ALTER TABLE public.staff_salary_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_salary_settings_read ON public.staff_salary_settings FOR SELECT TO authenticated
  USING (public.manages_school_finance(auth.uid(), school_id));
CREATE POLICY staff_salary_settings_write ON public.staff_salary_settings FOR INSERT TO authenticated
  WITH CHECK (public.manages_school_finance(auth.uid(), school_id));
CREATE POLICY staff_salary_settings_modify ON public.staff_salary_settings FOR UPDATE TO authenticated
  USING (public.manages_school_finance(auth.uid(), school_id))
  WITH CHECK (public.manages_school_finance(auth.uid(), school_id));
CREATE POLICY staff_salary_settings_remove ON public.staff_salary_settings FOR DELETE TO authenticated
  USING (public.manages_school_finance(auth.uid(), school_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_salaries TO authenticated;
GRANT ALL ON public.staff_salaries TO service_role;
ALTER TABLE public.staff_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_salaries_read ON public.staff_salaries FOR SELECT TO authenticated
  USING (public.manages_school_finance(auth.uid(), school_id) OR user_id = auth.uid());
CREATE POLICY staff_salaries_write ON public.staff_salaries FOR INSERT TO authenticated
  WITH CHECK (public.manages_school_finance(auth.uid(), school_id));
CREATE POLICY staff_salaries_modify ON public.staff_salaries FOR UPDATE TO authenticated
  USING (public.manages_school_finance(auth.uid(), school_id))
  WITH CHECK (public.manages_school_finance(auth.uid(), school_id));
CREATE POLICY staff_salaries_remove ON public.staff_salaries FOR DELETE TO authenticated
  USING (public.manages_school_finance(auth.uid(), school_id));

-- 6. Discounts count as money the school agreed not to collect -------------
CREATE OR REPLACE FUNCTION public.apply_payment_to_invoice()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
DECLARE inv public.fee_invoices%ROWTYPE; net_due numeric;
BEGIN
  SELECT * INTO inv FROM public.fee_invoices WHERE id = NEW.invoice_id FOR UPDATE;
  net_due := inv.amount_due - COALESCE(inv.discount_amount, 0);
  UPDATE public.fee_invoices
     SET amount_paid = inv.amount_paid + NEW.amount,
         status = CASE
           WHEN inv.amount_paid + NEW.amount >= net_due THEN 'paid'::public.invoice_status
           WHEN inv.amount_paid + NEW.amount > 0 THEN 'partial'::public.invoice_status
           ELSE 'unpaid'::public.invoice_status
         END
   WHERE id = NEW.invoice_id;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.validate_payment_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
DECLARE inv public.fee_invoices%ROWTYPE; net_due numeric;
BEGIN
  SELECT * INTO inv FROM public.fee_invoices WHERE id = NEW.invoice_id FOR UPDATE;
  IF inv.id IS NULL OR inv.school_id <> NEW.school_id OR inv.student_id <> NEW.student_id THEN
    RAISE EXCEPTION 'Payment does not match invoice';
  END IF;
  net_due := inv.amount_due - COALESCE(inv.discount_amount, 0);
  IF NEW.amount <= 0 OR NEW.amount > net_due - inv.amount_paid THEN
    RAISE EXCEPTION 'Payment must be positive and no greater than the outstanding balance';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_fee_defaulters(_school_id uuid, _created_by uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE _count integer;
BEGIN
  IF auth.uid() IS NULL OR _created_by <> auth.uid() OR NOT public.school_permission(auth.uid(), _school_id, 'fees.edit') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.parent_notifications(school_id, parent_id, student_id, type, title, body, meta, created_by)
  SELECT i.school_id, sp.parent_id, i.student_id, 'fee_reminder',
         'Fee reminder: ' || i.title,
         'Outstanding balance: ' || (i.amount_due - COALESCE(i.discount_amount,0) - i.amount_paid)::text,
         jsonb_build_object('invoice_id', i.id, 'balance', i.amount_due - COALESCE(i.discount_amount,0) - i.amount_paid),
         auth.uid()
  FROM public.fee_invoices i
  JOIN public.student_parents sp ON sp.student_id = i.student_id AND sp.is_primary = true
  WHERE i.school_id = _school_id
    AND i.status IN ('unpaid','partial','overdue')
    AND (i.amount_due - COALESCE(i.discount_amount,0) - i.amount_paid) > 0
    AND (i.due_date IS NULL OR i.due_date <= current_date);
  GET DIAGNOSTICS _count = ROW_COUNT;
  UPDATE public.fee_invoices SET status = 'overdue'
  WHERE school_id = _school_id AND status IN ('unpaid','partial')
    AND (amount_due - COALESCE(discount_amount,0) - amount_paid) > 0
    AND due_date < current_date;
  RETURN _count;
END $$;

CREATE OR REPLACE FUNCTION public.protect_fee_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE paid_total numeric;
BEGIN
  NEW.discount_amount := COALESCE(NEW.discount_amount, 0);
  IF NEW.discount_amount < 0 THEN RAISE EXCEPTION 'A discount cannot be negative'; END IF;
  IF NEW.discount_amount > NEW.amount_due THEN RAISE EXCEPTION 'A discount cannot be more than the invoice amount'; END IF;
  IF NEW.discount_amount > 0 AND NULLIF(BTRIM(COALESCE(NEW.discount_reason,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Give a reason for the discount';
  END IF;
  IF NEW.discount_amount = 0 THEN
    NEW.discount_reason := NULL; NEW.discount_kind := NULL;
    NEW.discount_approved_by := NULL; NEW.discount_approved_at := NULL;
  ELSIF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.discount_reason IS DISTINCT FROM OLD.discount_reason THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.discount_approved_by := auth.uid(); NEW.discount_approved_at := now();
    END IF;
  END IF;
  IF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid THEN
    SELECT COALESCE(SUM(amount), 0) INTO paid_total FROM public.fee_payments WHERE invoice_id = NEW.id;
    IF paid_total <> NEW.amount_paid THEN
      RAISE EXCEPTION 'Amount paid can only change through recorded payments';
    END IF;
  END IF;
  IF NEW.amount_due < NEW.amount_paid + NEW.discount_amount THEN
    RAISE EXCEPTION 'The invoice total cannot be less than what has been paid and discounted';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fee_invoices_protect BEFORE UPDATE ON public.fee_invoices
  FOR EACH ROW EXECUTE FUNCTION public.protect_fee_invoice();
