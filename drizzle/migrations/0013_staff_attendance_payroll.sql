CREATE OR REPLACE FUNCTION public.school_permission(_user_id uuid, _school_id uuid, _permission text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _module text:=split_part(_permission,'.',1);
BEGIN
 IF _user_id IS NULL THEN RETURN false; END IF;
 IF _module IN ('settings','users','audit') THEN RETURN public.can_manage_school(_user_id,_school_id); END IF;
 IF _permission='payroll.approve' THEN RETURN public.can_manage_school(_user_id,_school_id) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND school_id=_school_id AND role='school_admin'); END IF;
 IF _module NOT IN ('staffatt','payroll') AND NOT public.school_module_enabled(_school_id,_module) THEN RETURN false; END IF;
 IF public.can_manage_school(_user_id,_school_id) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND school_id=_school_id AND role='school_admin') THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND school_id=_school_id AND ((role='teacher' AND _permission=ANY(ARRAY['students.view','academics.view','results.view','results.edit','attendance.view','attendance.edit'])) OR (role='accountant' AND _permission=ANY(ARRAY['students.view','academics.view','fees.view','fees.edit','payroll.view'])))) THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.school_role_assignments a JOIN public.school_custom_roles r ON r.id=a.role_id AND r.school_id=a.school_id WHERE a.user_id=_user_id AND a.school_id=_school_id AND (_permission=ANY(r.permissions) OR (_permission IN ('students.view','academics.view') AND r.permissions && ARRAY['results.view','results.edit','results.publish','attendance.view','attendance.edit','fees.view','fees.edit','communication.view','communication.edit','promotion.edit'])));
END $function$;

CREATE OR REPLACE FUNCTION public.validate_custom_permissions()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
 IF NOT NEW.permissions <@ ARRAY['students.view','students.edit','academics.view','academics.edit','promotion.edit','results.view','results.edit','results.publish','attendance.view','attendance.edit','fees.view','fees.edit','communication.view','communication.edit','staffatt.view','staffatt.edit','staffatt.kiosk','payroll.view','payroll.edit']::text[] THEN RAISE EXCEPTION 'Unsupported or privileged permission'; END IF;
 RETURN NEW;
END $function$;

ALTER TABLE public.staff_salary_settings ADD COLUMN IF NOT EXISTS salary_type text NOT NULL DEFAULT 'monthly' CHECK (salary_type IN ('monthly','weekly'));
ALTER TABLE public.staff_salary_settings ADD COLUMN IF NOT EXISTS other_deductions numeric NOT NULL DEFAULT 0 CHECK (other_deductions >= 0);
ALTER TABLE public.staff_salary_settings ADD COLUMN IF NOT EXISTS effective_from date;

CREATE TABLE public.staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  staff_no text,
  department text,
  category text NOT NULL DEFAULT 'teaching',
  photo_url text,
  pin_hash text,
  active boolean NOT NULL DEFAULT true,
  attendance_exempt boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id),
  UNIQUE (school_id, pin_hash)
);
CREATE TABLE public.staff_department_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  department text, category text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.attendance_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  report_time time NOT NULL DEFAULT '07:30',
  grace_minutes integer NOT NULL DEFAULT 15 CHECK (grace_minutes BETWEEN 0 AND 240),
  closing_time time NOT NULL DEFAULT '14:00',
  min_hours numeric NOT NULL DEFAULT 6 CHECK (min_hours BETWEEN 0 AND 24),
  late_threshold_minutes integer NOT NULL DEFAULT 30 CHECK (late_threshold_minutes >= 0),
  early_departure_minutes integer NOT NULL DEFAULT 15 CHECK (early_departure_minutes >= 0),
  working_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  radius_m integer NOT NULL DEFAULT 150 CHECK (radius_m BETWEEN 20 AND 5000),
  gps_phone boolean NOT NULL DEFAULT true,
  gps_kiosk boolean NOT NULL DEFAULT false,
  penalties jsonb NOT NULL DEFAULT '{"late":0,"late_extra":0,"absence":0,"early":0,"missing_checkout":0}'::jsonb,
  apply_penalties_in_payroll boolean NOT NULL DEFAULT false,
  leave_requires_approval boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL,
  check_in_at timestamptz,
  check_out_at timestamptz,
  in_lat double precision, in_lng double precision, in_accuracy double precision, in_distance_m double precision, in_verified boolean, in_method text,
  out_lat double precision, out_lng double precision, out_accuracy double precision, out_distance_m double precision, out_verified boolean, out_method text,
  status text NOT NULL DEFAULT 'present',
  late_minutes integer NOT NULL DEFAULT 0,
  early_minutes integer NOT NULL DEFAULT 0,
  worked_minutes integer NOT NULL DEFAULT 0,
  corrected_by uuid, correction_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, date),
  CHECK (check_out_at IS NULL OR (check_in_at IS NOT NULL AND check_out_at >= check_in_at))
);
CREATE INDEX staff_attendance_school_date ON public.staff_attendance(school_id, date);
CREATE TABLE public.attendance_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid,
  device_user_id uuid,
  action text NOT NULL,
  method text NOT NULL,
  result text NOT NULL,
  lat double precision, lng double precision, accuracy double precision, distance_m double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attendance_attempts_device ON public.attendance_attempts(device_user_id, created_at);
CREATE TABLE public.staff_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'school' CHECK (kind IN ('public','school','event')),
  start_date date NOT NULL, end_date date NOT NULL CHECK (end_date >= start_date),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  paid boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  leave_type_id uuid REFERENCES public.leave_types(id),
  start_date date NOT NULL, end_date date NOT NULL CHECK (end_date >= start_date),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid, reviewed_at timestamptz, review_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.attendance_exemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'permission' CHECK (kind IN ('official_assignment','permission','sick','event','other')),
  start_date date NOT NULL, end_date date NOT NULL CHECK (end_date >= start_date),
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('late','late_extra','absence','early','missing_checkout')),
  amount numeric NOT NULL CHECK (amount >= 0),
  minutes integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','waived','applied')),
  waived_by uuid, waive_reason text,
  payroll_record_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, date, kind)
);
CREATE TABLE public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('monthly','weekly','custom')),
  start_date date NOT NULL, end_date date NOT NULL CHECK (end_date >= start_date),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','approved','paid')),
  version integer NOT NULL DEFAULT 0,
  created_by uuid, reviewed_by uuid, approved_by uuid, paid_by uuid,
  generated_at timestamptz, reviewed_at timestamptz, approved_at timestamptz, paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  staff_name text,
  basic numeric NOT NULL DEFAULT 0, allowances numeric NOT NULL DEFAULT 0,
  days_present integer NOT NULL DEFAULT 0, days_absent integer NOT NULL DEFAULT 0, days_exempt integer NOT NULL DEFAULT 0,
  late_count integer NOT NULL DEFAULT 0,
  late_penalty numeric NOT NULL DEFAULT 0, absence_penalty numeric NOT NULL DEFAULT 0, other_penalty numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  gross numeric NOT NULL DEFAULT 0, total_deductions numeric NOT NULL DEFAULT 0, net numeric NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, user_id)
);
CREATE TABLE public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.payroll_records(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('earning','allowance','deduction','penalty')),
  label text NOT NULL,
  amount numeric NOT NULL
);

GRANT SELECT ON public.staff_profiles, public.staff_department_history, public.attendance_settings, public.staff_attendance, public.attendance_attempts, public.staff_holidays, public.leave_types, public.leave_requests, public.attendance_exemptions, public.staff_penalties, public.payroll_periods, public.payroll_records, public.payroll_items TO authenticated;
REVOKE SELECT ON public.staff_profiles FROM authenticated;
GRANT SELECT (id, school_id, user_id, staff_no, department, category, photo_url, active, attendance_exempt, created_at, updated_at) ON public.staff_profiles TO authenticated;
GRANT INSERT (school_id, user_id, staff_no, department, category, photo_url, active, attendance_exempt), UPDATE (staff_no, department, category, photo_url, active, attendance_exempt, updated_at) ON public.staff_profiles TO authenticated;
GRANT INSERT, UPDATE ON public.attendance_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.staff_holidays, public.leave_types TO authenticated;
GRANT INSERT ON public.leave_requests TO authenticated;
GRANT INSERT, DELETE ON public.attendance_exemptions TO authenticated;
GRANT INSERT ON public.payroll_periods TO authenticated;
GRANT ALL ON public.staff_profiles, public.staff_department_history, public.attendance_settings, public.staff_attendance, public.attendance_attempts, public.staff_holidays, public.leave_types, public.leave_requests, public.attendance_exemptions, public.staff_penalties, public.payroll_periods, public.payroll_records, public.payroll_items TO service_role;

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_department_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_exemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY sp_read ON public.staff_profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.school_permission(auth.uid(), school_id, 'staffatt.view'));
CREATE POLICY sp_insert ON public.staff_profiles FOR INSERT TO authenticated WITH CHECK (public.school_permission(auth.uid(), school_id, 'staffatt.edit'));
CREATE POLICY sp_update ON public.staff_profiles FOR UPDATE TO authenticated USING (public.school_permission(auth.uid(), school_id, 'staffatt.edit')) WITH CHECK (public.school_permission(auth.uid(), school_id, 'staffatt.edit'));
CREATE POLICY sdh_read ON public.staff_department_history FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.school_permission(auth.uid(), school_id, 'staffatt.view'));
CREATE POLICY as_read ON public.attendance_settings FOR SELECT TO authenticated USING (public.is_school_staff(auth.uid(), school_id) OR public.school_permission(auth.uid(), school_id, 'staffatt.view'));
CREATE POLICY as_insert ON public.attendance_settings FOR INSERT TO authenticated WITH CHECK (public.school_permission(auth.uid(), school_id, 'staffatt.edit'));
CREATE POLICY as_update ON public.attendance_settings FOR UPDATE TO authenticated USING (public.school_permission(auth.uid(), school_id, 'staffatt.edit')) WITH CHECK (public.school_permission(auth.uid(), school_id, 'staffatt.edit'));
CREATE POLICY sa_read ON public.staff_attendance FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.school_permission(auth.uid(), school_id, 'staffatt.view'));
CREATE POLICY aa_read ON public.attendance_attempts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.school_permission(auth.uid(), school_id, 'staffatt.view'));
CREATE POLICY sh_read ON public.staff_holidays FOR SELECT TO authenticated USING (public.is_school_staff(auth.uid(), school_id) OR public.school_permission(auth.uid(), school_id, 'staffatt.view'));
CREATE POLICY sh_write ON public.staff_holidays FOR ALL TO authenticated USING (public.school_permission(auth.uid(), school_id, 'staffatt.edit')) WITH CHECK (public.school_permission(auth.uid(), school_id, 'staffatt.edit'));
CREATE POLICY lt_read ON public.leave_types FOR SELECT TO authenticated USING (public.is_school_staff(auth.uid(), school_id) OR public.school_permission(auth.uid(), school_id, 'staffatt.view'));
CREATE POLICY lt_write ON public.leave_types FOR ALL TO authenticated USING (public.school_permission(auth.uid(), school_id, 'staffatt.edit')) WITH CHECK (public.school_permission(auth.uid(), school_id, 'staffatt.edit'));
CREATE POLICY lr_read ON public.leave_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.school_permission(auth.uid(), school_id, 'staffatt.view'));
CREATE POLICY lr_insert ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending' AND reviewed_by IS NULL AND public.is_school_staff(auth.uid(), school_id));
CREATE POLICY ae_read ON public.attendance_exemptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.school_permission(auth.uid(), school_id, 'staffatt.view'));
CREATE POLICY ae_insert ON public.attendance_exemptions FOR INSERT TO authenticated WITH CHECK (public.school_permission(auth.uid(), school_id, 'staffatt.edit') AND (user_id <> auth.uid() OR public.is_super_admin(auth.uid())));
CREATE POLICY ae_delete ON public.attendance_exemptions FOR DELETE TO authenticated USING (public.school_permission(auth.uid(), school_id, 'staffatt.edit') AND (user_id <> auth.uid() OR public.is_super_admin(auth.uid())));
CREATE POLICY pen_read ON public.staff_penalties FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.school_permission(auth.uid(), school_id, 'staffatt.view'));
CREATE POLICY pp_read ON public.payroll_periods FOR SELECT TO authenticated USING (public.school_permission(auth.uid(), school_id, 'payroll.view'));
CREATE POLICY pp_insert ON public.payroll_periods FOR INSERT TO authenticated WITH CHECK (public.school_permission(auth.uid(), school_id, 'payroll.edit') AND status = 'draft');
CREATE POLICY pr_read ON public.payroll_records FOR SELECT TO authenticated USING (public.school_permission(auth.uid(), school_id, 'payroll.view') OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.payroll_periods p WHERE p.id = period_id AND p.status = 'paid')));
CREATE POLICY pi_read ON public.payroll_items FOR SELECT TO authenticated USING (public.school_permission(auth.uid(), school_id, 'payroll.view'));

CREATE OR REPLACE FUNCTION public.track_staff_department() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.department IS DISTINCT FROM OLD.department OR NEW.category IS DISTINCT FROM OLD.category THEN
  INSERT INTO public.staff_department_history(school_id,user_id,department,category,changed_by) VALUES (NEW.school_id,NEW.user_id,NEW.department,NEW.category,auth.uid());
 END IF;
 NEW.updated_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER staff_profiles_dept BEFORE INSERT OR UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.track_staff_department();

CREATE TRIGGER audit_staff_profiles AFTER INSERT OR UPDATE OR DELETE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_attendance_settings AFTER INSERT OR UPDATE OR DELETE ON public.attendance_settings FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_staff_attendance AFTER INSERT OR UPDATE OR DELETE ON public.staff_attendance FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_staff_holidays AFTER INSERT OR UPDATE OR DELETE ON public.staff_holidays FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_leave_types AFTER INSERT OR UPDATE OR DELETE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_leave_requests AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_attendance_exemptions AFTER INSERT OR UPDATE OR DELETE ON public.attendance_exemptions FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_staff_penalties AFTER INSERT OR UPDATE OR DELETE ON public.staff_penalties FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_payroll_periods AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_payroll_records AFTER INSERT OR UPDATE OR DELETE ON public.payroll_records FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_staff_salary_settings_v2 AFTER INSERT OR UPDATE OR DELETE ON public.staff_salary_settings FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();