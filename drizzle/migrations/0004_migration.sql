CREATE TABLE public.lesson_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
 subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
 topic text NOT NULL CHECK (length(topic) BETWEEN 2 AND 200),
 term term_name,
 week smallint CHECK (week BETWEEN 1 AND 15),
 duration_minutes smallint,
 content text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved')),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.lesson_notes(school_id, created_by);
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_notes TO authenticated;
GRANT ALL ON public.lesson_notes TO service_role;
CREATE POLICY "View lesson notes" ON public.lesson_notes FOR SELECT TO authenticated USING (created_by=auth.uid() OR public.school_permission(auth.uid(),school_id,'academics.edit'));
CREATE POLICY "Create lesson notes" ON public.lesson_notes FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND public.school_permission(auth.uid(),school_id,'academics.view'));
CREATE POLICY "Edit lesson notes" ON public.lesson_notes FOR UPDATE TO authenticated USING (created_by=auth.uid() OR public.school_permission(auth.uid(),school_id,'academics.edit')) WITH CHECK (created_by=auth.uid() OR public.school_permission(auth.uid(),school_id,'academics.edit'));
CREATE POLICY "Delete lesson notes" ON public.lesson_notes FOR DELETE TO authenticated USING (created_by=auth.uid() OR public.school_permission(auth.uid(),school_id,'academics.edit'));
CREATE TRIGGER validate_tenant_links BEFORE INSERT OR UPDATE ON public.lesson_notes FOR EACH ROW EXECUTE FUNCTION public.validate_school_record_links();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.lesson_notes FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER lesson_notes_updated BEFORE UPDATE ON public.lesson_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();