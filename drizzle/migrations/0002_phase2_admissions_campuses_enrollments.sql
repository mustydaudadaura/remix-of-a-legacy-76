CREATE TABLE public.campuses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 name text NOT NULL, address text, phone text,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(school_id,name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campuses TO authenticated;
GRANT ALL ON public.campuses TO service_role;
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view campuses" ON public.campuses FOR SELECT TO authenticated USING (public.is_school_staff(auth.uid(),school_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Managers manage campuses" ON public.campuses FOR ALL TO authenticated USING (public.school_permission(auth.uid(),school_id,'settings.edit')) WITH CHECK (public.school_permission(auth.uid(),school_id,'settings.edit'));

ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS lga text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS allergies text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.students ADD CONSTRAINT students_status_check CHECK (status IN ('active','graduated','withdrawn','suspended')) NOT VALID;

CREATE TABLE public.admissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 application_no text NOT NULL,
 first_name text NOT NULL, last_name text NOT NULL, middle_name text,
 gender public.gender_type, dob date,
 class_applied_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
 previous_school text, state_of_origin text,
 parent_name text, parent_phone text, parent_email text, relationship text,
 stage text NOT NULL DEFAULT 'applied' CHECK (stage IN ('inquiry','applied','screened','accepted','rejected','enrolled')),
 entrance_score numeric CHECK (entrance_score IS NULL OR (entrance_score>=0 AND entrance_score<=100)),
 notes text,
 student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(school_id,application_no));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admissions TO authenticated;
GRANT ALL ON public.admissions TO service_role;
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View admissions" ON public.admissions FOR SELECT TO authenticated USING (public.school_permission(auth.uid(),school_id,'students.view'));
CREATE POLICY "Manage admissions" ON public.admissions FOR ALL TO authenticated USING (public.school_permission(auth.uid(),school_id,'students.edit')) WITH CHECK (public.school_permission(auth.uid(),school_id,'students.edit'));
CREATE TRIGGER admissions_updated BEFORE UPDATE ON public.admissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER admissions_audit AFTER INSERT OR UPDATE OR DELETE ON public.admissions FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER campuses_audit AFTER INSERT OR UPDATE OR DELETE ON public.campuses FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();

CREATE TABLE public.student_enrollments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
 class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
 session text,
 event text NOT NULL DEFAULT 'class_change',
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.student_enrollments TO authenticated;
GRANT ALL ON public.student_enrollments TO service_role;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View enrollment history" ON public.student_enrollments FOR SELECT TO authenticated USING (public.school_permission(auth.uid(),school_id,'students.view'));
CREATE INDEX ON public.student_enrollments(student_id, created_at);

CREATE OR REPLACE FUNCTION public.record_student_enrollment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.class_id IS DISTINCT FROM OLD.class_id OR NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO public.student_enrollments(school_id,student_id,class_id,session,event,created_by)
  VALUES(NEW.school_id,NEW.id,NEW.class_id,(SELECT current_session FROM public.schools WHERE id=NEW.school_id),
   CASE WHEN TG_OP='INSERT' THEN 'admitted' WHEN NEW.status IS DISTINCT FROM OLD.status THEN NEW.status ELSE 'class_change' END, auth.uid());
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER students_enrollment_history AFTER INSERT OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.record_student_enrollment();

INSERT INTO public.student_enrollments(school_id,student_id,class_id,session,event,created_at)
SELECT s.school_id,s.id,s.class_id,sc.current_session,'admitted',s.created_at FROM public.students s JOIN public.schools sc ON sc.id=s.school_id;