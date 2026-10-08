CREATE OR REPLACE FUNCTION public.can_manage_school(_user_id uuid,_school_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_super_admin(_user_id) OR (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND school_id=_school_id AND role='school_admin') AND NOT EXISTS(SELECT 1 FROM public.schools WHERE id=_school_id AND code='DEMO001')) $$;
CREATE OR REPLACE FUNCTION public.school_permission(_user_id uuid,_school_id uuid,_permission text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _module text:=split_part(_permission,'.',1);
BEGIN
 IF _user_id IS NULL THEN RETURN false; END IF;
 IF _module IN ('settings','users','audit') THEN RETURN public.can_manage_school(_user_id,_school_id); END IF;
 IF NOT public.school_module_enabled(_school_id,_module) THEN RETURN false; END IF;
 IF public.can_manage_school(_user_id,_school_id) OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND school_id=_school_id AND role='school_admin') THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND school_id=_school_id AND ((role='teacher' AND _permission=ANY(ARRAY['students.view','academics.view','results.view','results.edit','attendance.view','attendance.edit'])) OR (role='accountant' AND _permission=ANY(ARRAY['students.view','academics.view','fees.view','fees.edit'])))) THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.school_role_assignments a JOIN public.school_custom_roles r ON r.id=a.role_id AND r.school_id=a.school_id WHERE a.user_id=_user_id AND a.school_id=_school_id AND (_permission=ANY(r.permissions) OR (_permission IN ('students.view','academics.view') AND r.permissions && ARRAY['results.view','results.edit','results.publish','attendance.view','attendance.edit','fees.view','fees.edit','communication.view','communication.edit','promotion.edit'])));
END $$;
DROP POLICY "View student-parent links" ON public.student_parents;
CREATE POLICY "Parent reads own links" ON public.student_parents FOR SELECT TO authenticated USING(public.is_parent_link_owner(auth.uid(),parent_id));
CREATE OR REPLACE FUNCTION public.validate_school_record_links() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row_data jsonb:=to_jsonb(NEW); sid uuid; ref_id uuid; related_sid uuid;
BEGIN
 sid:=(row_data->>'school_id')::uuid;
 IF TG_TABLE_NAME='student_parents' THEN
 SELECT school_id INTO sid FROM public.students WHERE id=NEW.student_id;
 SELECT school_id INTO related_sid FROM public.parents WHERE id=NEW.parent_id;
 IF sid IS DISTINCT FROM related_sid THEN RAISE EXCEPTION 'Parent and child must belong to the same school'; END IF;
 RETURN NEW;
 END IF;
 ref_id:=(row_data->>'student_id')::uuid;
 IF ref_id IS NOT NULL THEN SELECT school_id INTO related_sid FROM public.students WHERE id=ref_id; IF related_sid IS DISTINCT FROM sid THEN RAISE EXCEPTION 'Student belongs to another school'; END IF; END IF;
 ref_id:=(row_data->>'class_id')::uuid;
 IF ref_id IS NOT NULL THEN SELECT school_id INTO related_sid FROM public.classes WHERE id=ref_id; IF related_sid IS DISTINCT FROM sid THEN RAISE EXCEPTION 'Class belongs to another school'; END IF; END IF;
 ref_id:=(row_data->>'subject_id')::uuid;
 IF ref_id IS NOT NULL THEN SELECT school_id INTO related_sid FROM public.subjects WHERE id=ref_id; IF related_sid IS DISTINCT FROM sid THEN RAISE EXCEPTION 'Subject belongs to another school'; END IF; END IF;
 ref_id:=(row_data->>'parent_id')::uuid;
 IF ref_id IS NOT NULL THEN SELECT school_id INTO related_sid FROM public.parents WHERE id=ref_id; IF related_sid IS DISTINCT FROM sid THEN RAISE EXCEPTION 'Parent belongs to another school'; END IF; END IF;
 IF TG_OP='UPDATE' AND NEW.school_id IS DISTINCT FROM OLD.school_id THEN RAISE EXCEPTION 'School ownership cannot be changed'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_school_record_links() FROM PUBLIC;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['students','subjects','assessments','report_cards','attendance','fee_items','fee_invoices','fee_payments','parent_notifications','student_parents'] LOOP EXECUTE format('CREATE TRIGGER validate_tenant_links BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.validate_school_record_links()',t); END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.validate_student_promotion_access() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF auth.uid() IS NOT NULL AND NEW.class_id IS DISTINCT FROM OLD.class_id AND NOT public.school_permission(auth.uid(),OLD.school_id,'promotion.edit') THEN RAISE EXCEPTION 'Promotion permission required'; END IF; RETURN NEW; END $$;
CREATE TRIGGER student_promotion_access BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.validate_student_promotion_access();
DROP POLICY "Permission update" ON public.students;
CREATE POLICY "Student edit or promotion" ON public.students FOR UPDATE TO authenticated USING(public.school_permission(auth.uid(),school_id,'students.edit') OR public.school_permission(auth.uid(),school_id,'promotion.edit')) WITH CHECK(public.school_permission(auth.uid(),school_id,'students.edit') OR public.school_permission(auth.uid(),school_id,'promotion.edit'));
CREATE OR REPLACE FUNCTION public.validate_payment_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE inv public.fee_invoices%ROWTYPE; BEGIN SELECT * INTO inv FROM public.fee_invoices WHERE id=NEW.invoice_id FOR UPDATE; IF inv.id IS NULL OR inv.school_id<>NEW.school_id OR inv.student_id<>NEW.student_id THEN RAISE EXCEPTION 'Payment does not match invoice'; END IF; IF NEW.amount<=0 OR NEW.amount>inv.amount_due-inv.amount_paid THEN RAISE EXCEPTION 'Payment must be positive and no greater than the outstanding balance'; END IF; RETURN NEW; END $$;
CREATE TRIGGER fee_payment_integrity BEFORE INSERT ON public.fee_payments FOR EACH ROW EXECUTE FUNCTION public.validate_payment_integrity();
CREATE OR REPLACE FUNCTION public.immutable_fee_payment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Recorded payments cannot be changed or deleted'; END $$;
CREATE TRIGGER fee_payment_immutable BEFORE UPDATE OR DELETE ON public.fee_payments FOR EACH ROW EXECUTE FUNCTION public.immutable_fee_payment();
CREATE TRIGGER fee_payments_audit AFTER INSERT ON public.fee_payments FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER fee_invoices_audit AFTER INSERT OR UPDATE ON public.fee_invoices FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER assessment_changes_audit AFTER INSERT OR UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();
CREATE TRIGGER report_changes_audit AFTER INSERT OR UPDATE ON public.report_cards FOR EACH ROW EXECUTE FUNCTION public.capture_school_audit();