
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM (
  'super_admin', 'school_admin', 'teacher', 'student', 'parent', 'accountant'
);

CREATE TYPE public.term_name AS ENUM ('first', 'second', 'third');
CREATE TYPE public.gender_type AS ENUM ('male', 'female');
CREATE TYPE public.assessment_status AS ENUM ('draft', 'submitted', 'approved');

-- =========================================================
-- SCHOOLS (tenants)
-- =========================================================
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  motto TEXT,
  current_session TEXT,
  current_term public.term_name,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.schools TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES (separate table to avoid recursive RLS)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, school_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SECURITY DEFINER HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.get_user_school(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.in_same_school(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id)
      OR public.get_user_school(_user_id) = _school_id
$$;

CREATE OR REPLACE FUNCTION public.is_school_staff(_user_id UUID, _school_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id
          AND school_id = _school_id
          AND role IN ('school_admin','teacher','accountant')
      )
$$;

-- =========================================================
-- CLASSES
-- =========================================================
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT,
  arm TEXT,
  teacher_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SUBJECTS
-- =========================================================
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PARENTS
-- =========================================================
CREATE TABLE public.parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  occupation TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parents TO authenticated;
GRANT ALL ON public.parents TO service_role;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- STUDENTS
-- =========================================================
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID,
  admission_no TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  gender public.gender_type,
  dob DATE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  photo_url TEXT,
  admission_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, admission_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- STUDENT-PARENT links
-- =========================================================
CREATE TABLE public.student_parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  relationship TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, parent_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_parents TO authenticated;
GRANT ALL ON public.student_parents TO service_role;
ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- ASSESSMENTS (CA1, CA2, Exam)
-- =========================================================
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  session TEXT NOT NULL,
  term public.term_name NOT NULL,
  ca1 NUMERIC(5,2) DEFAULT 0 CHECK (ca1 >= 0 AND ca1 <= 20),
  ca2 NUMERIC(5,2) DEFAULT 0 CHECK (ca2 >= 0 AND ca2 <= 20),
  exam NUMERIC(5,2) DEFAULT 0 CHECK (exam >= 0 AND exam <= 60),
  total NUMERIC(5,2) GENERATED ALWAYS AS (COALESCE(ca1,0)+COALESCE(ca2,0)+COALESCE(exam,0)) STORED,
  grade TEXT,
  remark TEXT,
  status public.assessment_status NOT NULL DEFAULT 'draft',
  teacher_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, session, term)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- REPORT CARDS metadata
-- =========================================================
CREATE TABLE public.report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session TEXT NOT NULL,
  term public.term_name NOT NULL,
  pdf_url TEXT,
  position INTEGER,
  total_score NUMERIC(7,2),
  average NUMERIC(5,2),
  principal_remark TEXT,
  teacher_remark TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, session, term)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_cards TO authenticated;
GRANT ALL ON public.report_cards TO service_role;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- TIMESTAMP TRIGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_assessments_updated BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- AUTO GRADE on assessment insert/update (Nigerian WAEC scale)
-- =========================================================
CREATE OR REPLACE FUNCTION public.compute_grade()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE t NUMERIC := COALESCE(NEW.ca1,0)+COALESCE(NEW.ca2,0)+COALESCE(NEW.exam,0);
BEGIN
  NEW.grade := CASE
    WHEN t >= 75 THEN 'A1'
    WHEN t >= 70 THEN 'B2'
    WHEN t >= 65 THEN 'B3'
    WHEN t >= 60 THEN 'C4'
    WHEN t >= 55 THEN 'C5'
    WHEN t >= 50 THEN 'C6'
    WHEN t >= 45 THEN 'D7'
    WHEN t >= 40 THEN 'E8'
    ELSE 'F9' END;
  NEW.remark := CASE
    WHEN t >= 75 THEN 'Excellent'
    WHEN t >= 65 THEN 'Very Good'
    WHEN t >= 55 THEN 'Good'
    WHEN t >= 45 THEN 'Fair'
    WHEN t >= 40 THEN 'Pass'
    ELSE 'Fail' END;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_assessment_grade
BEFORE INSERT OR UPDATE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.compute_grade();

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- schools
CREATE POLICY "Anyone can view schools (for signup)" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Super admins manage schools" ON public.schools FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School admins update own school" ON public.schools FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'school_admin') AND public.get_user_school(auth.uid()) = id);

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_school_staff(auth.uid(), school_id));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins update profiles in school" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id));

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_school_staff(auth.uid(), school_id));
CREATE POLICY "Super admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "School admins assign roles in school" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'school_admin') AND public.get_user_school(auth.uid()) = school_id AND role <> 'super_admin');
CREATE POLICY "School admins delete roles in school" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'school_admin') AND public.get_user_school(auth.uid()) = school_id AND role <> 'super_admin');

-- classes
CREATE POLICY "School members view classes" ON public.classes FOR SELECT TO authenticated
  USING (public.in_same_school(auth.uid(), school_id));
CREATE POLICY "School staff manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id)) WITH CHECK (public.is_school_staff(auth.uid(), school_id));

-- subjects
CREATE POLICY "School members view subjects" ON public.subjects FOR SELECT TO authenticated
  USING (public.in_same_school(auth.uid(), school_id));
CREATE POLICY "School staff manage subjects" ON public.subjects FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id)) WITH CHECK (public.is_school_staff(auth.uid(), school_id));

-- parents
CREATE POLICY "School staff view parents" ON public.parents FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id) OR auth.uid() = user_id);
CREATE POLICY "School staff manage parents" ON public.parents FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id)) WITH CHECK (public.is_school_staff(auth.uid(), school_id));

-- students
CREATE POLICY "School staff view all students" ON public.students FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id));
CREATE POLICY "Student views self" ON public.students FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Parent views own children" ON public.students FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_parents sp
    JOIN public.parents p ON p.id = sp.parent_id
    WHERE sp.student_id = students.id AND p.user_id = auth.uid()
  ));
CREATE POLICY "School staff manage students" ON public.students FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id)) WITH CHECK (public.is_school_staff(auth.uid(), school_id));

-- student_parents
CREATE POLICY "View student-parent links" ON public.student_parents FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id
            AND (public.is_school_staff(auth.uid(), s.school_id) OR s.user_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.parents p WHERE p.id = parent_id AND p.user_id = auth.uid())
  );
CREATE POLICY "Staff manage student-parent links" ON public.student_parents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND public.is_school_staff(auth.uid(), s.school_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND public.is_school_staff(auth.uid(), s.school_id)));

-- assessments
CREATE POLICY "Staff view assessments" ON public.assessments FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id));
CREATE POLICY "Student views own assessments" ON public.assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()));
CREATE POLICY "Parent views child assessments" ON public.assessments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_parents sp
    JOIN public.parents p ON p.id = sp.parent_id
    WHERE sp.student_id = assessments.student_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Staff manage assessments" ON public.assessments FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id)) WITH CHECK (public.is_school_staff(auth.uid(), school_id));

-- report_cards
CREATE POLICY "Staff view report cards" ON public.report_cards FOR SELECT TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id));
CREATE POLICY "Student views own report card" ON public.report_cards FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = auth.uid()) AND published = true);
CREATE POLICY "Parent views child report card" ON public.report_cards FOR SELECT TO authenticated
  USING (published = true AND EXISTS (
    SELECT 1 FROM public.student_parents sp
    JOIN public.parents p ON p.id = sp.parent_id
    WHERE sp.student_id = report_cards.student_id AND p.user_id = auth.uid()
  ));
CREATE POLICY "Staff manage report cards" ON public.report_cards FOR ALL TO authenticated
  USING (public.is_school_staff(auth.uid(), school_id)) WITH CHECK (public.is_school_staff(auth.uid(), school_id));

-- Indexes
CREATE INDEX idx_students_school ON public.students(school_id);
CREATE INDEX idx_students_class ON public.students(class_id);
CREATE INDEX idx_assessments_student ON public.assessments(student_id);
CREATE INDEX idx_assessments_term ON public.assessments(session, term);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_profiles_user ON public.profiles(user_id);
