CREATE TABLE public.teacher_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 teacher_id uuid NOT NULL,
 class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
 subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
 is_class_teacher boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE NULLS NOT DISTINCT (teacher_id, class_id, subject_id)
);
CREATE TABLE public.timetable_slots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
 subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
 teacher_id uuid,
 day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
 start_time time NOT NULL,
 end_time time NOT NULL,
 room text,
 label text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (end_time > start_time)
);
CREATE TABLE public.assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
 subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
 title text NOT NULL CHECK (length(title) BETWEEN 2 AND 200),
 instructions text,
 due_date date,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.teacher_allocations(school_id, teacher_id);
CREATE INDEX ON public.timetable_slots(school_id, class_id, day_of_week);
CREATE INDEX ON public.assignments(school_id, class_id);

CREATE OR REPLACE FUNCTION public.teaches_class(_user_id uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS(SELECT 1 FROM public.teacher_allocations WHERE teacher_id=_user_id AND class_id=_class_id) $$;

CREATE OR REPLACE FUNCTION public.parent_has_child_in_class(_user_id uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS(SELECT 1 FROM public.students s JOIN public.student_parents sp ON sp.student_id=s.id JOIN public.parents p ON p.id=sp.parent_id WHERE s.class_id=_class_id AND p.user_id=_user_id)
 OR EXISTS(SELECT 1 FROM public.students WHERE class_id=_class_id AND user_id=_user_id) $$;

ALTER TABLE public.teacher_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_allocations, public.timetable_slots, public.assignments TO authenticated;
GRANT ALL ON public.teacher_allocations, public.timetable_slots, public.assignments TO service_role;

CREATE POLICY "View allocations" ON public.teacher_allocations FOR SELECT TO authenticated USING (public.school_permission(auth.uid(),school_id,'academics.view'));
CREATE POLICY "Manage allocations" ON public.teacher_allocations FOR ALL TO authenticated USING (public.school_permission(auth.uid(),school_id,'academics.edit')) WITH CHECK (public.school_permission(auth.uid(),school_id,'academics.edit'));

CREATE POLICY "View timetable" ON public.timetable_slots FOR SELECT TO authenticated USING (public.school_permission(auth.uid(),school_id,'academics.view') OR public.parent_has_child_in_class(auth.uid(),class_id));
CREATE POLICY "Manage timetable" ON public.timetable_slots FOR ALL TO authenticated USING (public.school_permission(auth.uid(),school_id,'academics.edit')) WITH CHECK (public.school_permission(auth.uid(),school_id,'academics.edit'));

CREATE POLICY "View assignments" ON public.assignments FOR SELECT TO authenticated USING (public.school_permission(auth.uid(),school_id,'academics.view') OR public.parent_has_child_in_class(auth.uid(),class_id));
CREATE POLICY "Create assignments" ON public.assignments FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND public.school_module_enabled(school_id,'academics') AND (public.school_permission(auth.uid(),school_id,'academics.edit') OR public.teaches_class(auth.uid(),class_id)));
CREATE POLICY "Edit assignments" ON public.assignments FOR UPDATE TO authenticated USING (public.school_permission(auth.uid(),school_id,'academics.edit') OR (created_by=auth.uid() AND public.teaches_class(auth.uid(),class_id))) WITH CHECK (public.school_permission(auth.uid(),school_id,'academics.edit') OR (created_by=auth.uid() AND public.teaches_class(auth.uid(),class_id)));
CREATE POLICY "Delete assignments" ON public.assignments FOR DELETE TO authenticated USING (public.school_permission(auth.uid(),school_id,'academics.edit') OR (created_by=auth.uid() AND public.teaches_class(auth.uid(),class_id)));

CREATE TRIGGER validate_tenant_links BEFORE INSERT OR UPDATE ON public.teacher_allocations FOR EACH ROW EXECUTE FUNCTION public.validate_school_record_links();
CREATE TRIGGER validate_tenant_links BEFORE INSERT OR UPDATE ON public.timetable_slots FOR EACH ROW EXECUTE FUNCTION public.validate_school_record_links();
CREATE TRIGGER validate_tenant_links BEFORE INSERT OR UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.validate_school_record_links();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.teacher_allocations FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.timetable_slots FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER audit AFTER INSERT OR UPDATE OR DELETE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER assignments_updated BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();