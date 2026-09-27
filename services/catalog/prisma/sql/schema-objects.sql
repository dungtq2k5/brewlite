-- rdm-spec §5, catalog C-1 rows. Idempotent — safe to run on every deploy (conventions §7.1).

-- C-1: a category name is unique among LIVE rows, per language.
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_en_live_key
  ON categories (lower(name_en)) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS categories_name_vi_live_key
  ON categories (lower(name_vi)) WHERE deleted_at IS NULL;

-- C-1: deleted_at and deleted_by_id move together (conventions §7.3).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_deleted_by_ck'
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_deleted_by_ck
      CHECK ((deleted_at IS NULL) = (deleted_by_id IS NULL));
  END IF;
END $$;
