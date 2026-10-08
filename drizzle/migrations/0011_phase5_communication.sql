ALTER TABLE public.parent_notifications ADD COLUMN IF NOT EXISTS visible_from timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS parent_notifications_parent_visible_idx ON public.parent_notifications(parent_id, visible_from DESC);

CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  type text NOT NULL DEFAULT 'news' CHECK (type IN ('news','message','general')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 140),
  body text NOT NULL CHECK (char_length(body) BETWEEN 2 AND 4000),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_templates_read ON public.message_templates FOR SELECT TO authenticated
  USING (public.school_permission(auth.uid(), school_id, 'communication.edit'));
CREATE POLICY message_templates_insert ON public.message_templates FOR INSERT TO authenticated
  WITH CHECK (public.school_permission(auth.uid(), school_id, 'communication.edit') AND created_by = auth.uid());
CREATE POLICY message_templates_update ON public.message_templates FOR UPDATE TO authenticated
  USING (public.school_permission(auth.uid(), school_id, 'communication.edit'))
  WITH CHECK (public.school_permission(auth.uid(), school_id, 'communication.edit'));
CREATE POLICY message_templates_delete ON public.message_templates FOR DELETE TO authenticated
  USING (public.school_permission(auth.uid(), school_id, 'communication.edit'));
CREATE TRIGGER message_templates_updated_at BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER message_templates_audit AFTER INSERT OR UPDATE OR DELETE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION capture_school_audit();

CREATE TABLE public.parent_preferences (
  parent_id uuid PRIMARY KEY REFERENCES public.parents(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  muted_types text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (muted_types <@ ARRAY['news','general']::text[])
);
GRANT SELECT ON public.parent_preferences TO authenticated;
GRANT ALL ON public.parent_preferences TO service_role;
ALTER TABLE public.parent_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY parent_preferences_staff_read ON public.parent_preferences FOR SELECT TO authenticated
  USING (public.school_permission(auth.uid(), school_id, 'communication.edit'));