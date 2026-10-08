CREATE TABLE public.school_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  student_id uuid NOT NULL REFERENCES public.students(id),
  kind text NOT NULL CHECK (kind IN ('transfer','leaving')),
  serial_no text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  issued_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, serial_no)
);
CREATE INDEX ON public.school_certificates(school_id, created_at DESC);
GRANT SELECT, INSERT ON public.school_certificates TO authenticated;
GRANT ALL ON public.school_certificates TO service_role;
ALTER TABLE public.school_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View certificates" ON public.school_certificates FOR SELECT TO authenticated USING (public.school_permission(auth.uid(),school_id,'students.view'));
CREATE POLICY "Issue certificates" ON public.school_certificates FOR INSERT TO authenticated WITH CHECK (public.school_permission(auth.uid(),school_id,'students.edit') AND public.student_school_id(student_id)=school_id AND issued_by=auth.uid());
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.school_certificates FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();