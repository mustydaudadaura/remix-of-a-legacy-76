ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS review_remark text, ADD COLUMN IF NOT EXISTS reviewed_by uuid, ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE OR REPLACE FUNCTION public.protect_assessment_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _can boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  _can := public.school_permission(auth.uid(), NEW.school_id, 'results.publish');
  IF _can THEN
    IF TG_OP = 'UPDATE' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.review_remark IS DISTINCT FROM OLD.review_remark) THEN
      NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    RAISE EXCEPTION 'Only result approvers can approve results';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'approved' THEN RAISE EXCEPTION 'Approved results are locked. Ask the school admin to return them for correction.'; END IF;
    NEW.review_remark := OLD.review_remark; NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;
  ELSE
    NEW.review_remark := NULL; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_assessment_approval ON public.assessments;
CREATE TRIGGER protect_assessment_approval BEFORE INSERT OR UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.protect_assessment_approval();