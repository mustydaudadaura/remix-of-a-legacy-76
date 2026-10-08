ALTER TABLE public.lesson_notes
  ADD COLUMN IF NOT EXISTS review_score numeric CHECK (review_score IS NULL OR (review_score >= 0 AND review_score <= 100)),
  ADD COLUMN IF NOT EXISTS review_remark text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS teacher_reply text,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

CREATE OR REPLACE FUNCTION public.protect_lesson_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_reviewer boolean := public.school_permission(auth.uid(), NEW.school_id, 'academics.edit');
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT is_reviewer THEN
    NEW.review_score := OLD.review_score; NEW.review_remark := OLD.review_remark;
    NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;
    IF NEW.status NOT IN ('draft','submitted') THEN NEW.status := OLD.status; END IF;
    IF OLD.status = 'approved' THEN
      NEW.plan := OLD.plan; NEW.header := OLD.header; NEW.content := OLD.content; NEW.topic := OLD.topic; NEW.status := OLD.status;
    END IF;
  ELSE
    IF NEW.review_remark IS DISTINCT FROM OLD.review_remark OR NEW.review_score IS DISTINCT FROM OLD.review_score OR NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
      IF NEW.review_remark IS DISTINCT FROM OLD.review_remark THEN NEW.acknowledged_at := NULL; END IF;
    END IF;
  END IF;
  IF NEW.created_by <> auth.uid() THEN
    NEW.teacher_reply := OLD.teacher_reply;
    IF NEW.review_remark IS NOT DISTINCT FROM OLD.review_remark THEN NEW.acknowledged_at := OLD.acknowledged_at; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_lesson_review ON public.lesson_notes;
CREATE TRIGGER protect_lesson_review BEFORE UPDATE ON public.lesson_notes
FOR EACH ROW EXECUTE FUNCTION public.protect_lesson_review();