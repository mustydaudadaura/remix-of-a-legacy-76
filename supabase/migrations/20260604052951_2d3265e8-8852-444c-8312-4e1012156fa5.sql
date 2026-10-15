
-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM ('present','absent','late','excused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('unpaid','partial','paid','overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.parent_notification_type AS ENUM ('news','fee_reminder','defaulter','message','general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ATTENDANCE
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  date date NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);
CREATE INDEX IF NOT EXISTS attendance_school_date_idx ON public.attendance(school_id, date);
CREATE INDEX IF NOT EXISTS attendance_student_date_idx ON public.attendance(student_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage school attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id))
  WITH CHECK (public.is_school_staff(auth.uid(), school_id));

CREATE TRIGGER attendance_updated_at BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FEE ITEMS
CREATE TABLE IF NOT EXISTS public.fee_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  session text NOT NULL,
  term public.term_name NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_items TO authenticated;
GRANT ALL ON public.fee_items TO service_role;
ALTER TABLE public.fee_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage fee items" ON public.fee_items
  FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id))
  WITH CHECK (public.is_school_staff(auth.uid(), school_id));
CREATE TRIGGER fee_items_updated_at BEFORE UPDATE ON public.fee_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FEE INVOICES
CREATE TABLE IF NOT EXISTS public.fee_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_item_id uuid REFERENCES public.fee_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  session text NOT NULL,
  term public.term_name NOT NULL,
  amount_due numeric(12,2) NOT NULL CHECK (amount_due >= 0),
  amount_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status public.invoice_status NOT NULL DEFAULT 'unpaid',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fee_invoices_student_idx ON public.fee_invoices(student_id);
CREATE INDEX IF NOT EXISTS fee_invoices_school_idx ON public.fee_invoices(school_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_invoices TO authenticated;
GRANT ALL ON public.fee_invoices TO service_role;
ALTER TABLE public.fee_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage fee invoices" ON public.fee_invoices
  FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id))
  WITH CHECK (public.is_school_staff(auth.uid(), school_id));
CREATE TRIGGER fee_invoices_updated_at BEFORE UPDATE ON public.fee_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence for receipt numbers
CREATE SEQUENCE IF NOT EXISTS public.receipt_seq START 1000;

-- FEE PAYMENTS
CREATE TABLE IF NOT EXISTS public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.fee_invoices(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'cash',
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  receipt_no text NOT NULL UNIQUE DEFAULT ('RCP-' || lpad(nextval('public.receipt_seq')::text, 6, '0')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fee_payments_invoice_idx ON public.fee_payments(invoice_id);
CREATE INDEX IF NOT EXISTS fee_payments_student_idx ON public.fee_payments(student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_payments TO authenticated;
GRANT ALL ON public.fee_payments TO service_role;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage fee payments" ON public.fee_payments
  FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id))
  WITH CHECK (public.is_school_staff(auth.uid(), school_id));

-- Update invoice on payment
CREATE OR REPLACE FUNCTION public.apply_payment_to_invoice()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE inv public.fee_invoices%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.fee_invoices WHERE id = NEW.invoice_id FOR UPDATE;
  UPDATE public.fee_invoices
     SET amount_paid = inv.amount_paid + NEW.amount,
         status = CASE
           WHEN inv.amount_paid + NEW.amount >= inv.amount_due THEN 'paid'::public.invoice_status
           WHEN inv.amount_paid + NEW.amount > 0 THEN 'partial'::public.invoice_status
           ELSE 'unpaid'::public.invoice_status
         END
   WHERE id = NEW.invoice_id;
  RETURN NEW;
END $$;

CREATE TRIGGER fee_payments_apply AFTER INSERT ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.apply_payment_to_invoice();

-- PARENT NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.parent_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.parents(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  type public.parent_notification_type NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pn_parent_idx ON public.parent_notifications(parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pn_school_idx ON public.parent_notifications(school_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_notifications TO authenticated;
GRANT ALL ON public.parent_notifications TO service_role;
ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage parent notifications" ON public.parent_notifications
  FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id))
  WITH CHECK (public.is_school_staff(auth.uid(), school_id));

-- Helper: create reminders for unpaid/overdue invoices
CREATE OR REPLACE FUNCTION public.notify_fee_defaulters(_school_id uuid, _created_by uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count integer := 0;
BEGIN
  WITH defaulters AS (
    SELECT i.id AS invoice_id, i.student_id, i.school_id, i.title, i.amount_due, i.amount_paid, i.due_date,
           sp.parent_id
      FROM public.fee_invoices i
      JOIN public.student_parents sp ON sp.student_id = i.student_id AND sp.is_primary = true
     WHERE i.school_id = _school_id
       AND i.status IN ('unpaid','partial','overdue')
       AND (i.due_date IS NULL OR i.due_date <= now()::date)
  )
  INSERT INTO public.parent_notifications (school_id, parent_id, student_id, type, title, body, meta, created_by)
  SELECT school_id, parent_id, student_id, 'fee_reminder', 'Fee reminder: ' || title,
         'Outstanding balance: ' || (amount_due - amount_paid)::text,
         jsonb_build_object('invoice_id', invoice_id, 'balance', amount_due - amount_paid),
         _created_by
    FROM defaulters;
  GET DIAGNOSTICS _count = ROW_COUNT;

  -- mark overdue
  UPDATE public.fee_invoices SET status='overdue'
   WHERE school_id=_school_id AND status IN ('unpaid','partial')
     AND due_date IS NOT NULL AND due_date < now()::date;

  RETURN _count;
END $$;

-- Public verification of parent by phone (used by phone-only login on server)
CREATE OR REPLACE FUNCTION public.find_parent_by_phone(_phone text)
RETURNS TABLE(parent_id uuid, school_id uuid, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, school_id, full_name
    FROM public.parents
   WHERE regexp_replace(phone, '\D', '', 'g') = regexp_replace(_phone, '\D', '', 'g')
   LIMIT 1
$$;
