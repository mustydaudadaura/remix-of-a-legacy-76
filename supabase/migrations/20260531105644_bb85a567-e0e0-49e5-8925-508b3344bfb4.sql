
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS stamp_url TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS branch_name TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url TEXT,
  ADD COLUMN IF NOT EXISTS principal_name TEXT,
  ADD COLUMN IF NOT EXISTS principal_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#0a6d3b';

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS house TEXT,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS genotype TEXT,
  ADD COLUMN IF NOT EXISTS medical_notes TEXT,
  ADD COLUMN IF NOT EXISTS previous_school TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS next_resumption_date DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS state_of_origin TEXT,
  ADD COLUMN IF NOT EXISTS religion TEXT;

ALTER TABLE public.assessments DROP CONSTRAINT IF EXISTS assessments_score_bounds;
ALTER TABLE public.assessments ADD CONSTRAINT assessments_score_bounds CHECK (
  COALESCE(ca1,0) >= 0 AND COALESCE(ca1,0) <= 20 AND
  COALESCE(ca2,0) >= 0 AND COALESCE(ca2,0) <= 20 AND
  COALESCE(exam,0) >= 0 AND COALESCE(exam,0) <= 60
);

CREATE OR REPLACE FUNCTION public.compute_grade()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t NUMERIC := COALESCE(NEW.ca1,0)+COALESCE(NEW.ca2,0)+COALESCE(NEW.exam,0);
BEGIN
  NEW.total := t;
  NEW.grade := CASE WHEN t >= 70 THEN 'A' WHEN t >= 60 THEN 'B' WHEN t >= 50 THEN 'C' WHEN t >= 45 THEN 'D' ELSE 'F' END;
  NEW.remark := CASE WHEN t >= 70 THEN 'Excellent' WHEN t >= 60 THEN 'Very Good' WHEN t >= 50 THEN 'Good' WHEN t >= 45 THEN 'Fair' ELSE 'Fail' END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_compute_grade ON public.assessments;
CREATE TRIGGER trg_compute_grade BEFORE INSERT OR UPDATE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.compute_grade();

ALTER TABLE public.report_cards
  ADD COLUMN IF NOT EXISTS class_id UUID,
  ADD COLUMN IF NOT EXISTS gpa NUMERIC,
  ADD COLUMN IF NOT EXISTS subjects_count INTEGER,
  ADD COLUMN IF NOT EXISTS days_present INTEGER,
  ADD COLUMN IF NOT EXISTS days_absent INTEGER,
  ADD COLUMN IF NOT EXISTS days_total INTEGER,
  ADD COLUMN IF NOT EXISTS psychomotor JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS affective JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(8),'hex'),
  ADD COLUMN IF NOT EXISTS next_resumption_date DATE,
  ADD COLUMN IF NOT EXISTS class_size INTEGER;

CREATE INDEX IF NOT EXISTS idx_report_cards_verify ON public.report_cards(verification_code);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  user_id UUID,
  channel TEXT NOT NULL DEFAULT 'in_app',
  title TEXT NOT NULL,
  body TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  delivered BOOLEAN DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_school_staff(auth.uid(), school_id));

DROP POLICY IF EXISTS "Staff manage notifications" ON public.notifications;
CREATE POLICY "Staff manage notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id))
  WITH CHECK (public.is_school_staff(auth.uid(), school_id));

DROP POLICY IF EXISTS "Users mark own read" ON public.notifications;
CREATE POLICY "Users mark own read" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_school ON public.notifications(school_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.verify_report_card(_code TEXT)
RETURNS TABLE(
  student_name TEXT, admission_no TEXT, class_name TEXT,
  "session" TEXT, term term_name, total_score NUMERIC, average NUMERIC,
  "position" INTEGER, school_name TEXT, published BOOLEAN
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (s.first_name||' '||COALESCE(s.middle_name,'')||' '||s.last_name),
    s.admission_no, c.name,
    rc.session, rc.term, rc.total_score, rc.average, rc.position,
    sch.name, rc.published
  FROM public.report_cards rc
  JOIN public.students s ON s.id = rc.student_id
  LEFT JOIN public.classes c ON c.id = rc.class_id
  JOIN public.schools sch ON sch.id = rc.school_id
  WHERE rc.verification_code = _code AND rc.published = true
$$;
GRANT EXECUTE ON FUNCTION public.verify_report_card(TEXT) TO anon, authenticated;

-- Storage bucket for school assets (logos, stamps, signatures, student photos)
INSERT INTO storage.buckets (id, name, public) VALUES ('school-assets', 'school-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read school-assets" ON storage.objects;
CREATE POLICY "Public read school-assets" ON storage.objects FOR SELECT USING (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "Authenticated upload school-assets" ON storage.objects;
CREATE POLICY "Authenticated upload school-assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "Authenticated update school-assets" ON storage.objects;
CREATE POLICY "Authenticated update school-assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'school-assets');
