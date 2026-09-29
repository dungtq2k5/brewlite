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

-- C-2: a product name is unique among LIVE rows, per language.
CREATE UNIQUE INDEX IF NOT EXISTS products_name_en_live_key
  ON products (lower(name_en)) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_name_vi_live_key
  ON products (lower(name_vi)) WHERE deleted_at IS NULL;

-- C-2, C-4: deleted_at and deleted_by_id move together (conventions §7.3).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_deleted_by_ck'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_deleted_by_ck
      CHECK ((deleted_at IS NULL) = (deleted_by_id IS NULL));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'toppings_deleted_by_ck'
  ) THEN
    ALTER TABLE toppings
      ADD CONSTRAINT toppings_deleted_by_ck
      CHECK ((deleted_at IS NULL) = (deleted_by_id IS NULL));
  END IF;
END $$;

-- C-2: both descriptions or neither.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_description_pair_ck'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_description_pair_ck
      CHECK ((description_en IS NULL) = (description_vi IS NULL));
  END IF;
END $$;

-- C-2: base_price_vnd bounds — MAX_PRICE_VND (10,000,000) in @brewlite/contracts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_price_ck'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_price_ck
      CHECK (base_price_vnd BETWEEN 0 AND 10000000);
  END IF;
END $$;

-- C-2: stock_qty is the floor under optimistic locking.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_ck'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_stock_ck
      CHECK (stock_qty IS NULL OR stock_qty >= 0);
  END IF;
END $$;

-- C-2: the menu query — live products ordered within a category.
CREATE INDEX IF NOT EXISTS products_menu_idx
  ON products (category_id, sort_order) WHERE deleted_at IS NULL;

-- C-3: size is one of S | M | L; price_delta_vnd bounds — MAX_PRICE_VND in @brewlite/contracts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_sizes_size_ck'
  ) THEN
    ALTER TABLE product_sizes
      ADD CONSTRAINT product_sizes_size_ck
      CHECK (size IN ('S', 'M', 'L'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_sizes_delta_ck'
  ) THEN
    ALTER TABLE product_sizes
      ADD CONSTRAINT product_sizes_delta_ck
      CHECK (price_delta_vnd BETWEEN 0 AND 10000000);
  END IF;
END $$;

-- C-4: a topping name is unique among LIVE rows, per language.
CREATE UNIQUE INDEX IF NOT EXISTS toppings_name_en_live_key
  ON toppings (lower(name_en)) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS toppings_name_vi_live_key
  ON toppings (lower(name_vi)) WHERE deleted_at IS NULL;

-- C-4: price_vnd bounds — MAX_PRICE_VND in @brewlite/contracts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'toppings_price_ck'
  ) THEN
    ALTER TABLE toppings
      ADD CONSTRAINT toppings_price_ck
      CHECK (price_vnd BETWEEN 0 AND 10000000);
  END IF;
END $$;

-- C-6: qty > 0, status is one of the three values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_reservations_qty_ck'
  ) THEN
    ALTER TABLE stock_reservations
      ADD CONSTRAINT stock_reservations_qty_ck
      CHECK (qty > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_reservations_status_ck'
  ) THEN
    ALTER TABLE stock_reservations
      ADD CONSTRAINT stock_reservations_status_ck
      CHECK (status IN ('HELD', 'CONFIRMED', 'RELEASED'));
  END IF;
END $$;

-- C-6: the orphan sweep's query (05b).
CREATE INDEX IF NOT EXISTS stock_reservations_held_idx
  ON stock_reservations (created_at) WHERE status = 'HELD';
