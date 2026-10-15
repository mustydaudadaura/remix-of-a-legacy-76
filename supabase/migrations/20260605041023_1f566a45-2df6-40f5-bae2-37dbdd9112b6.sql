
-- Break recursion between students and student_parents policies via SECURITY DEFINER helpers.

CREATE OR REPLACE FUNCTION public.student_school_id(_student_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.students WHERE id = _student_id
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of_student(_user_id uuid, _student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.student_parents sp
      JOIN public.parents p ON p.id = sp.parent_id
     WHERE sp.student_id = _student_id
       AND p.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_parent_link_owner(_user_id uuid, _parent_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.parents WHERE id = _parent_id AND user_id = _user_id)
$$;

-- students: rewrite parent-view policy without subquery into student_parents
DROP POLICY IF EXISTS "Parent views own children" ON public.students;
CREATE POLICY "Parent views own children"
  ON public.students FOR SELECT
  USING (public.is_parent_of_student(auth.uid(), id));

-- student_parents: rewrite policies to use helpers (no direct ref to students)
DROP POLICY IF EXISTS "Staff manage student-parent links" ON public.student_parents;
CREATE POLICY "Staff manage student-parent links"
  ON public.student_parents FOR ALL
  USING (public.is_school_staff(auth.uid(), public.student_school_id(student_id)))
  WITH CHECK (public.is_school_staff(auth.uid(), public.student_school_id(student_id)));

DROP POLICY IF EXISTS "View student-parent links" ON public.student_parents;
CREATE POLICY "View student-parent links"
  ON public.student_parents FOR SELECT
  USING (
    public.is_school_staff(auth.uid(), public.student_school_id(student_id))
    OR public.is_parent_link_owner(auth.uid(), parent_id)
  );
