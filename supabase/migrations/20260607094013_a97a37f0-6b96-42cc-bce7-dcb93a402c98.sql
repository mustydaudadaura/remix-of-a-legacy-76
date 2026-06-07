DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_cards_class_id_fkey'
      AND conrelid = 'public.report_cards'::regclass
  ) THEN
    ALTER TABLE public.report_cards
      ADD CONSTRAINT report_cards_class_id_fkey
      FOREIGN KEY (class_id)
      REFERENCES public.classes(id)
      ON DELETE SET NULL;
  END IF;
END $$;