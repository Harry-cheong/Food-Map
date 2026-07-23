-- Add personal list status (to_try | tried) to existing user_fav rows.
-- Safe to re-run.

ALTER TABLE user_fav
    ADD COLUMN IF NOT EXISTS list_status TEXT NOT NULL DEFAULT 'to_try';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_fav_list_status_valid'
    ) THEN
        ALTER TABLE user_fav
            ADD CONSTRAINT user_fav_list_status_valid
            CHECK (list_status IN ('to_try', 'tried'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_fav_list_status
    ON user_fav (submitted_by_user_id, list_status);
