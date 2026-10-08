CREATE TABLE public.school_controls (
 school_id uuid PRIMARY KEY REFERENCES public.schools(id),
 enabled_modules text[] NOT NULL DEFAULT ARRAY['students','academics','promotion','results','attendance','fees','communication'],
 enabled_sections text[] NOT NULL DEFAULT ARRAY['nursery','primary','secondary'],
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.school_controls TO authenticated;
GRANT ALL ON public.school_controls TO service_role;
ALTER TABLE public.school_controls ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.school_custom_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80), permissions text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(school_id,name), UNIQUE(id,school_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_custom_roles TO authenticated;
GRANT ALL ON public.school_custom_roles TO service_role;
ALTER TABLE public.school_custom_roles ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.school_role_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id),
 role_id uuid NOT NULL, user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(role_id,school_id) REFERENCES public.school_custom_roles(id,school_id), UNIQUE(role_id,user_id)
);
GRANT SELECT, INSERT, DELETE ON public.school_role_assignments TO authenticated;
GRANT ALL ON public.school_role_assignments TO service_role;
ALTER TABLE public.school_role_assignments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.school_audit_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id),
 actor_id uuid, action text NOT NULL, entity text NOT NULL, record_id text,
 old_value jsonb, new_value jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.school_audit_logs TO authenticated;
GRANT ALL ON public.school_audit_logs TO service_role;
ALTER TABLE public.school_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX school_audit_logs_school_created ON public.school_audit_logs(school_id,created_at DESC);
CREATE INDEX school_role_assignments_user_school ON public.school_role_assignments(user_id,school_id);
CREATE OR REPLACE FUNCTION public.can_manage_school(_user_id uuid,_school_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_super_admin(_user_id) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND school_id=_school_id AND role='school_admin')
$$;
CREATE OR REPLACE FUNCTION public.school_module_enabled(_school_id uuid,_module text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _module=ANY(COALESCE((SELECT enabled_modules FROM public.school_controls WHERE school_id=_school_id),ARRAY['students','academics','promotion','results','attendance','fees','communication']))
$$;
CREATE OR REPLACE FUNCTION public.school_permission(_user_id uuid,_school_id uuid,_permission text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _module text := split_part(_permission,'.',1);
BEGIN
 IF _user_id IS NULL THEN RETURN false; END IF;
 IF _module IN ('settings','users','audit') THEN RETURN public.can_manage_school(_user_id,_school_id); END IF;
 IF NOT public.school_module_enabled(_school_id,_module) THEN RETURN false; END IF;
 IF public.can_manage_school(_user_id,_school_id) THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND school_id=_school_id AND (
 (role='teacher' AND _permission=ANY(ARRAY['students.view','academics.view','results.view','results.edit','attendance.view','attendance.edit'])) OR
 (role='accountant' AND _permission=ANY(ARRAY['students.view','academics.view','fees.view','fees.edit']))
 )) THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.school_role_assignments a JOIN public.school_custom_roles r ON r.id=a.role_id AND r.school_id=a.school_id
 WHERE a.user_id=_user_id AND a.school_id=_school_id AND _permission=ANY(r.permissions));
END $$;
REVOKE ALL ON FUNCTION public.can_manage_school(uuid,uuid),public.school_module_enabled(uuid,text),public.school_permission(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_school(uuid,uuid),public.school_module_enabled(uuid,text),public.school_permission(uuid,uuid,text) TO authenticated,service_role;
CREATE POLICY "School members read controls" ON public.school_controls FOR SELECT TO authenticated USING(public.can_manage_school(auth.uid(),school_id) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND school_id=school_controls.school_id) OR EXISTS(SELECT 1 FROM public.school_role_assignments WHERE user_id=auth.uid() AND school_id=school_controls.school_id));
CREATE POLICY "Admins configure school" ON public.school_controls FOR ALL TO authenticated USING(public.can_manage_school(auth.uid(),school_id)) WITH CHECK(public.can_manage_school(auth.uid(),school_id));
CREATE POLICY "Admins manage custom roles" ON public.school_custom_roles FOR ALL TO authenticated USING(public.can_manage_school(auth.uid(),school_id)) WITH CHECK(public.can_manage_school(auth.uid(),school_id));
CREATE POLICY "Read assigned custom roles" ON public.school_custom_roles FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.school_role_assignments WHERE role_id=school_custom_roles.id AND user_id=auth.uid()));
CREATE POLICY "Read own custom assignments" ON public.school_role_assignments FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.can_manage_school(auth.uid(),school_id));
CREATE POLICY "Admins assign custom roles" ON public.school_role_assignments FOR INSERT TO authenticated WITH CHECK(public.can_manage_school(auth.uid(),school_id) AND EXISTS(SELECT 1 FROM public.profiles WHERE user_id=school_role_assignments.user_id AND school_id=school_role_assignments.school_id) AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=school_role_assignments.user_id AND (role='super_admin' OR (role='school_admin' AND school_id=school_role_assignments.school_id))));
CREATE POLICY "Admins remove custom assignments" ON public.school_role_assignments FOR DELETE TO authenticated USING(public.can_manage_school(auth.uid(),school_id));
CREATE POLICY "Admins read school audit" ON public.school_audit_logs FOR SELECT TO authenticated USING(public.can_manage_school(auth.uid(),school_id));
CREATE OR REPLACE FUNCTION public.validate_school_controls() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT NEW.enabled_modules <@ ARRAY['students','academics','promotion','results','attendance','fees','communication']::text[] THEN RAISE EXCEPTION 'Unknown school module'; END IF;
 IF cardinality(NEW.enabled_sections)=0 OR NOT NEW.enabled_sections <@ ARRAY['nursery','primary','secondary']::text[] THEN RAISE EXCEPTION 'Select supported sections'; END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE TRIGGER validate_school_controls BEFORE INSERT OR UPDATE ON public.school_controls FOR EACH ROW EXECUTE FUNCTION public.validate_school_controls();
CREATE OR REPLACE FUNCTION public.validate_custom_permissions() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT NEW.permissions <@ ARRAY['students.view','students.edit','academics.view','academics.edit','promotion.edit','results.view','results.edit','results.publish','attendance.view','attendance.edit','fees.view','fees.edit','communication.view','communication.edit']::text[] THEN RAISE EXCEPTION 'Unsupported or privileged permission'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_custom_permissions BEFORE INSERT OR UPDATE ON public.school_custom_roles FOR EACH ROW EXECUTE FUNCTION public.validate_custom_permissions();
CREATE OR REPLACE FUNCTION public.capture_school_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _old jsonb; _new jsonb; _sid uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN _old:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN _new:=to_jsonb(NEW); END IF;
 _sid:=COALESCE((_new->>'school_id')::uuid,(_old->>'school_id')::uuid);
 IF TG_TABLE_NAME='schools' THEN _sid:=COALESCE((_new->>'id')::uuid,(_old->>'id')::uuid); END IF;
 IF _sid IS NOT NULL THEN INSERT INTO public.school_audit_logs(school_id,actor_id,action,entity,record_id,old_value,new_value)
 VALUES(_sid,auth.uid(),TG_OP,TG_TABLE_NAME,COALESCE(_new->>'id',_old->>'id',_sid::text),_old,_new); END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION public.capture_school_audit() FROM PUBLIC;
CREATE TRIGGER school_controls_audit AFTER INSERT OR UPDATE OR DELETE ON public.school_controls FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER school_custom_roles_audit AFTER INSERT OR UPDATE OR DELETE ON public.school_custom_roles FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER school_role_assignments_audit AFTER INSERT OR UPDATE OR DELETE ON public.school_role_assignments FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER school_user_roles_audit AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER school_branding_audit AFTER INSERT OR UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE OR REPLACE FUNCTION public.immutable_school_audit() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Audit history is append-only'; END $$;
CREATE TRIGGER school_audit_immutable BEFORE UPDATE OR DELETE ON public.school_audit_logs FOR EACH ROW EXECUTE FUNCTION public.immutable_school_audit();
CREATE OR REPLACE FUNCTION public.protect_profile_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN
 IF TG_OP='INSERT' AND (NEW.user_id<>auth.uid() OR NEW.school_id IS NOT NULL) THEN RAISE EXCEPTION 'School affiliation requires administrator approval'; END IF;
 IF TG_OP='UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.school_id IS DISTINCT FROM OLD.school_id) AND NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Only super administrators may change school affiliation'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER profile_identity_guard BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_identity();
DROP POLICY "School admins assign roles in school" ON public.user_roles;
DROP POLICY "School admins delete roles in school" ON public.user_roles;
CREATE POLICY "School admins assign operational staff" ON public.user_roles FOR INSERT TO authenticated WITH CHECK(public.can_manage_school(auth.uid(),school_id) AND role IN ('teacher','accountant') AND EXISTS(SELECT 1 FROM public.profiles WHERE user_id=user_roles.user_id AND school_id=user_roles.school_id));
CREATE POLICY "School admins remove operational staff" ON public.user_roles FOR DELETE TO authenticated USING(public.can_manage_school(auth.uid(),school_id) AND role IN ('teacher','accountant'));
DROP POLICY "Admins update profiles in school" ON public.profiles;
CREATE POLICY "Admins update approved school profiles" ON public.profiles FOR UPDATE TO authenticated USING(public.can_manage_school(auth.uid(),school_id)) WITH CHECK(public.can_manage_school(auth.uid(),school_id));
DROP POLICY "School admins update own school" ON public.schools;
CREATE POLICY "School admins update authorized school" ON public.schools FOR UPDATE TO authenticated USING(public.can_manage_school(auth.uid(),id)) WITH CHECK(public.can_manage_school(auth.uid(),id));
DO $$ DECLARE p record; _module text; _edit text; BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('students','parents','student_parents','classes','subjects','assessments','report_cards','attendance','fee_items','fee_invoices','fee_payments','notifications','parent_notifications') AND (policyname ILIKE '%staff%' OR policyname='School members view classes') LOOP
 EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP;
 FOR p IN SELECT * FROM (VALUES ('students','students'),('parents','students'),('classes','academics'),('subjects','academics'),('assessments','results'),('report_cards','results'),('attendance','attendance'),('fee_items','fees'),('fee_invoices','fees'),('fee_payments','fees'),('notifications','communication'),('parent_notifications','communication')) AS t(tablename,module) LOOP
 _module:=p.module; _edit:=CASE WHEN p.tablename='report_cards' THEN 'results.publish' ELSE _module||'.edit' END;
 EXECUTE format('CREATE POLICY "Permission read" ON public.%I FOR SELECT TO authenticated USING(public.school_permission(auth.uid(),school_id,%L))',p.tablename,_module||'.view');
 EXECUTE format('CREATE POLICY "Permission insert" ON public.%I FOR INSERT TO authenticated WITH CHECK(public.school_permission(auth.uid(),school_id,%L))',p.tablename,_edit);
 EXECUTE format('CREATE POLICY "Permission update" ON public.%I FOR UPDATE TO authenticated USING(public.school_permission(auth.uid(),school_id,%L)) WITH CHECK(public.school_permission(auth.uid(),school_id,%L))',p.tablename,_edit,_edit);
 IF p.tablename NOT IN ('fee_payments','fee_invoices','assessments','report_cards') THEN EXECUTE format('CREATE POLICY "Permission delete" ON public.%I FOR DELETE TO authenticated USING(public.school_permission(auth.uid(),school_id,%L))',p.tablename,_edit); END IF;
 END LOOP;
END $$;
CREATE POLICY "Permission read student links" ON public.student_parents FOR SELECT TO authenticated USING(public.school_permission(auth.uid(),public.student_school_id(student_id),'students.view') OR public.school_permission(auth.uid(),public.student_school_id(student_id),'fees.view') OR public.school_permission(auth.uid(),public.student_school_id(student_id),'communication.view'));
CREATE POLICY "Permission insert student links" ON public.student_parents FOR INSERT TO authenticated WITH CHECK(public.school_permission(auth.uid(),public.student_school_id(student_id),'students.edit'));
CREATE POLICY "Permission update student links" ON public.student_parents FOR UPDATE TO authenticated USING(public.school_permission(auth.uid(),public.student_school_id(student_id),'students.edit')) WITH CHECK(public.school_permission(auth.uid(),public.student_school_id(student_id),'students.edit'));
CREATE POLICY "Permission delete student links" ON public.student_parents FOR DELETE TO authenticated USING(public.school_permission(auth.uid(),public.student_school_id(student_id),'students.edit'));
CREATE POLICY "Finance communication parent directory" ON public.parents FOR SELECT TO authenticated USING(public.school_permission(auth.uid(),school_id,'fees.view') OR public.school_permission(auth.uid(),school_id,'communication.view'));
CREATE POLICY "Finance parent payment notices" ON public.parent_notifications FOR INSERT TO authenticated WITH CHECK(public.school_permission(auth.uid(),school_id,'fees.edit') AND type IN ('general','fee_reminder','defaulter'));
CREATE POLICY "Finance invoice reconciliation" ON public.fee_invoices FOR UPDATE TO authenticated USING(public.school_permission(auth.uid(),school_id,'fees.edit')) WITH CHECK(public.school_permission(auth.uid(),school_id,'fees.edit'));
CREATE OR REPLACE FUNCTION public.notify_fee_defaulters(_school_id uuid,_created_by uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _count integer;
BEGIN
 IF auth.uid() IS NULL OR _created_by<>auth.uid() OR NOT public.school_permission(auth.uid(),_school_id,'fees.edit') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 INSERT INTO public.parent_notifications(school_id,parent_id,student_id,type,title,body,meta,created_by)
 SELECT i.school_id,sp.parent_id,i.student_id,'fee_reminder','Fee reminder: '||i.title,'Outstanding balance: '||(i.amount_due-i.amount_paid)::text,jsonb_build_object('invoice_id',i.id,'balance',i.amount_due-i.amount_paid),auth.uid()
 FROM public.fee_invoices i JOIN public.student_parents sp ON sp.student_id=i.student_id AND sp.is_primary=true
 WHERE i.school_id=_school_id AND i.status IN ('unpaid','partial','overdue') AND (i.due_date IS NULL OR i.due_date<=current_date);
 GET DIAGNOSTICS _count=ROW_COUNT;
 UPDATE public.fee_invoices SET status='overdue' WHERE school_id=_school_id AND status IN ('unpaid','partial') AND due_date<current_date;
 RETURN _count;
END $$;
REVOKE ALL ON FUNCTION public.notify_fee_defaulters(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_fee_defaulters(uuid,uuid) TO authenticated,service_role;