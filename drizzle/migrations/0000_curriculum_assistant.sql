CREATE TABLE public.curriculum_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  file_name text,
  summary text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_documents TO authenticated;
GRANT ALL ON public.curriculum_documents TO service_role;
ALTER TABLE public.curriculum_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View curriculum docs" ON public.curriculum_documents FOR SELECT TO authenticated USING (public.school_permission(auth.uid(), school_id, 'academics.view'));
CREATE POLICY "Create curriculum docs" ON public.curriculum_documents FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.school_permission(auth.uid(), school_id, 'academics.view'));
CREATE POLICY "Edit curriculum docs" ON public.curriculum_documents FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.school_permission(auth.uid(), school_id, 'academics.edit')) WITH CHECK (created_by = auth.uid() OR public.school_permission(auth.uid(), school_id, 'academics.edit'));
CREATE POLICY "Delete curriculum docs" ON public.curriculum_documents FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.school_permission(auth.uid(), school_id, 'academics.edit'));
CREATE TRIGGER validate_tenant_links BEFORE INSERT OR UPDATE ON public.curriculum_documents FOR EACH ROW EXECUTE FUNCTION public.validate_school_record_links();
CREATE TRIGGER curriculum_documents_audit AFTER INSERT OR UPDATE OR DELETE ON public.curriculum_documents FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();

CREATE TABLE public.scheme_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.curriculum_documents(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  class_label text,
  term public.term_name,
  week integer CHECK (week IS NULL OR (week >= 1 AND week <= 15)),
  topic text NOT NULL,
  sub_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  lesson_note_id uuid REFERENCES public.lesson_notes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','needs_revision')),
  review_remark text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.scheme_items(document_id);
CREATE INDEX ON public.scheme_items(school_id, class_id, subject_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheme_items TO authenticated;
GRANT ALL ON public.scheme_items TO service_role;
ALTER TABLE public.scheme_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View scheme items" ON public.scheme_items FOR SELECT TO authenticated USING (public.school_permission(auth.uid(), school_id, 'academics.view'));
CREATE POLICY "Create scheme items" ON public.scheme_items FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.school_permission(auth.uid(), school_id, 'academics.view'));
CREATE POLICY "Edit scheme items" ON public.scheme_items FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.school_permission(auth.uid(), school_id, 'academics.edit')) WITH CHECK (created_by = auth.uid() OR public.school_permission(auth.uid(), school_id, 'academics.edit'));
CREATE POLICY "Delete scheme items" ON public.scheme_items FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.school_permission(auth.uid(), school_id, 'academics.edit'));
CREATE TRIGGER validate_tenant_links BEFORE INSERT OR UPDATE ON public.scheme_items FOR EACH ROW EXECUTE FUNCTION public.validate_school_record_links();
CREATE TRIGGER scheme_items_audit AFTER INSERT OR UPDATE OR DELETE ON public.scheme_items FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();

CREATE OR REPLACE FUNCTION public.protect_scheme_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.school_permission(auth.uid(), NEW.school_id, 'academics.edit') THEN
    NEW.review_remark := OLD.review_remark; NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;
    IF NEW.status NOT IN ('draft','submitted') THEN NEW.status := OLD.status; END IF;
    IF OLD.status = 'approved' THEN
      NEW.topic := OLD.topic; NEW.sub_topics := OLD.sub_topics; NEW.objectives := OLD.objectives; NEW.week := OLD.week; NEW.term := OLD.term; NEW.status := OLD.status;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.review_remark IS DISTINCT FROM OLD.review_remark THEN
    NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_scheme_review BEFORE UPDATE ON public.scheme_items FOR EACH ROW EXECUTE FUNCTION public.protect_scheme_review();