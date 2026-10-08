-- Phase 6: Islamic programmes (Tahfiz, Arabic, Islamiyya)

CREATE TABLE public.islamic_programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  programme_type TEXT NOT NULL DEFAULT 'tahfiz' CHECK (programme_type IN ('tahfiz','arabic','islamiyya','other')),
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.islamic_programmes TO authenticated;
GRANT ALL ON public.islamic_programmes TO service_role;
ALTER TABLE public.islamic_programmes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View islamic programmes" ON public.islamic_programmes FOR SELECT TO authenticated
  USING (school_permission(auth.uid(), school_id, 'academics.view'));
CREATE POLICY "Manage islamic programmes" ON public.islamic_programmes FOR ALL TO authenticated
  USING (school_permission(auth.uid(), school_id, 'academics.edit'))
  WITH CHECK (school_permission(auth.uid(), school_id, 'academics.edit'));

CREATE TABLE public.islamic_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES public.islamic_programmes(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','withdrawn')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE (programme_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.islamic_enrollments TO authenticated;
GRANT ALL ON public.islamic_enrollments TO service_role;
ALTER TABLE public.islamic_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View islamic enrollments" ON public.islamic_enrollments FOR SELECT TO authenticated
  USING (school_permission(auth.uid(), school_id, 'academics.view'));
CREATE POLICY "Manage islamic enrollments" ON public.islamic_enrollments FOR ALL TO authenticated
  USING (school_permission(auth.uid(), school_id, 'academics.edit'))
  WITH CHECK (school_permission(auth.uid(), school_id, 'academics.edit'));

CREATE TABLE public.tahfiz_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session TEXT NOT NULL,
  term TEXT NOT NULL,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  surah_from TEXT NOT NULL,
  ayah_from INTEGER NOT NULL DEFAULT 1,
  surah_to TEXT NOT NULL,
  ayah_to INTEGER NOT NULL DEFAULT 1,
  assessment_type TEXT NOT NULL DEFAULT 'memorization' CHECK (assessment_type IN ('memorization','tajweed','revision')),
  score NUMERIC(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  grade TEXT,
  teacher_id UUID,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tahfiz_records TO authenticated;
GRANT ALL ON public.tahfiz_records TO service_role;
ALTER TABLE public.tahfiz_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View tahfiz records" ON public.tahfiz_records FOR SELECT TO authenticated
  USING (school_permission(auth.uid(), school_id, 'academics.view'));
CREATE POLICY "Manage tahfiz records" ON public.tahfiz_records FOR ALL TO authenticated
  USING (school_permission(auth.uid(), school_id, 'academics.edit'))
  WITH CHECK (school_permission(auth.uid(), school_id, 'academics.edit'));

CREATE INDEX idx_islamic_programmes_school ON public.islamic_programmes(school_id);
CREATE INDEX idx_islamic_enrollments_programme ON public.islamic_enrollments(programme_id);
CREATE INDEX idx_islamic_enrollments_student ON public.islamic_enrollments(student_id);
CREATE INDEX idx_tahfiz_records_student ON public.tahfiz_records(student_id, session, term);
CREATE INDEX idx_tahfiz_records_school ON public.tahfiz_records(school_id);

-- Audit trail for islamic programme tables (append-only, via shared trigger)
CREATE TRIGGER audit_islamic_programmes AFTER INSERT OR UPDATE OR DELETE ON public.islamic_programmes
  FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_islamic_enrollments AFTER INSERT OR UPDATE OR DELETE ON public.islamic_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit_tahfiz_records AFTER INSERT OR UPDATE OR DELETE ON public.tahfiz_records
  FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();