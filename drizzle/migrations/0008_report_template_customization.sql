ALTER TABLE public.schools ADD COLUMN report_template jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE FUNCTION public.validate_report_template() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text; v jsonb; palette text[] := ARRAY['emerald','forest','green','lime','olive','teal','turquoise','cyan','sky','blue','navy','indigo','violet','purple','plum','magenta','pink','rose','red','crimson','orange','amber','gold','brown','slate','charcoal'];
BEGIN
 IF jsonb_typeof(NEW.report_template) <> 'object' THEN RAISE EXCEPTION 'Invalid report template'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(NEW.report_template) LOOP
  IF k='positions' THEN
   IF jsonb_typeof(v)<>'string' OR (v#>>'{}') NOT IN ('none','class','subject','both') THEN RAISE EXCEPTION 'Invalid position setting'; END IF;
  ELSIF k IN ('border','heading','table','rows','biodata','development','comments') THEN
   IF jsonb_typeof(v)<>'string' OR NOT ((v#>>'{}')=ANY(palette)) THEN RAISE EXCEPTION 'Invalid report colour'; END IF;
  ELSE RAISE EXCEPTION 'Unknown report setting'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_report_template BEFORE INSERT OR UPDATE OF report_template ON public.schools FOR EACH ROW EXECUTE FUNCTION public.validate_report_template();
CREATE FUNCTION public.report_subject_positions(_report_id uuid) RETURNS TABLE(subject_id uuid, subject_position bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.report_cards;
BEGIN
 SELECT * INTO r FROM public.report_cards WHERE id=_report_id;
 IF r.id IS NULL THEN RETURN; END IF;
 IF NOT (auth.role()='service_role' OR public.school_permission(auth.uid(),r.school_id,'results.view') OR (r.published AND (public.is_parent_of_student(auth.uid(),r.student_id) OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=r.student_id AND s.user_id=auth.uid())))) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 RETURN QUERY SELECT ranked.subject_id,ranked.pos FROM (
 SELECT a.subject_id,a.student_id,rank() OVER(PARTITION BY a.subject_id ORDER BY a.total DESC) pos
 FROM public.assessments a WHERE a.school_id=r.school_id AND a.class_id=r.class_id AND a.session=r.session AND a.term=r.term AND a.status='approved'
 ) ranked WHERE ranked.student_id=r.student_id;
END $$;
REVOKE ALL ON FUNCTION public.report_subject_positions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_subject_positions(uuid) TO authenticated,service_role;