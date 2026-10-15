DO $$ BEGIN
  CREATE TYPE public.class_section AS ENUM ('nursery','primary','secondary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS section public.class_section;

-- Best-effort backfill from existing level text
UPDATE public.classes SET section = 'nursery'
  WHERE section IS NULL AND level ILIKE '%nursery%' OR level ILIKE '%creche%' OR level ILIKE '%kg%' OR level ILIKE '%pre%';
UPDATE public.classes SET section = 'primary'
  WHERE section IS NULL AND (level ILIKE '%primary%' OR level ILIKE 'pry%' OR name ILIKE 'pry%' OR name ILIKE 'primary%');
UPDATE public.classes SET section = 'secondary'
  WHERE section IS NULL AND (level ILIKE '%secondary%' OR level ILIKE '%jss%' OR level ILIKE '%sss%' OR name ILIKE 'jss%' OR name ILIKE 'sss%');
