CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _school_id uuid;
  _school_code text;
BEGIN
  _school_id := NULLIF(NEW.raw_user_meta_data->>'school_id', '')::uuid;
  _school_code := NULLIF(NEW.raw_user_meta_data->>'school_code', '');

  IF _school_id IS NULL AND _school_code IS NOT NULL THEN
    SELECT id INTO _school_id FROM public.schools WHERE code = upper(_school_code) LIMIT 1;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    _school_id
  )
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        school_id = COALESCE(public.profiles.school_id, EXCLUDED.school_id);
  RETURN NEW;
END;
$function$;