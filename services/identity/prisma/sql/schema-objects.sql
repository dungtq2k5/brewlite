-- rdm-spec §5, identity I-1 rows. Idempotent — safe to run on every deploy (conventions §7.1).

-- I-1: email is normalised — trimmed and lower-cased (rdm-spec §2.3).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_email_lower_ck'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_email_lower_ck
      CHECK (email = lower(trim(email)));
  END IF;
END $$;

-- I-1: role is one of the three fixed roles.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_ck'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_ck
      CHECK (role IN ('CUSTOMER', 'STAFF', 'ADMIN'));
  END IF;
END $$;

-- I-1: every account has a way in — a password or a Firebase link.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_has_credential_ck'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_has_credential_ck
      CHECK (password_hash IS NOT NULL OR firebase_uid IS NOT NULL);
  END IF;
END $$;

-- I-1: an end date needs a lock (rdm-spec §2.9).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_locked_until_ck'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_locked_until_ck
      CHECK (locked_until IS NULL OR is_locked);
  END IF;
END $$;

-- I-1: locked ⇔ a reason (rdm-spec §2.9).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_lock_reason_ck'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_lock_reason_ck
      CHECK (is_locked = (lock_reason IS NOT NULL));
  END IF;
END $$;

-- I-1: the identity variant (rdm-spec §2.9) — deleted_by_id is a real FK here (SET NULL),
-- so the general "(deleted_at IS NULL) = (deleted_by_id IS NULL)" form would break it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_deleted_by_ck'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_deleted_by_ck
      CHECK (deleted_by_id IS NULL OR deleted_at IS NOT NULL);
  END IF;
END $$;

-- I-1: preferred_locale is one of the two supported locales.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_locale_ck'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_locale_ck
      CHECK (preferred_locale IN ('en', 'vi'));
  END IF;
END $$;
