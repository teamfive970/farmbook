-- Notifications: one inbox per farmer.
--
--   * announcements are written by an admin (Ministry or cooperative staff) and
--     copied into the inbox of every farmer in the chosen audience;
--   * reminders are worked out by the server from the farmer's own records
--     (no work recorded lately, money still owed, a harvest ready to share);
--   * system messages (welcome, joined a group) come from the app itself.
--
-- A reminder carries a dedupe_key, so asking for the inbox again never adds
-- the same reminder twice.

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users (id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 3 AND 500),
  audience_type TEXT NOT NULL CHECK (audience_type IN ('all', 'county', 'cooperative')),
  audience_value TEXT,
  audience_label TEXT NOT NULL,
  send_sms BOOLEAN NOT NULL DEFAULT false,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sms_status TEXT NOT NULL DEFAULT 'none' CHECK (sms_status IN ('none', 'sending', 'done', 'unavailable')),
  sms_sent INTEGER NOT NULL DEFAULT 0,
  sms_failed INTEGER NOT NULL DEFAULT 0,
  sms_skipped INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT announcements_audience_value_check CHECK (
    (audience_type = 'all' AND audience_value IS NULL) OR
    (audience_type <> 'all' AND audience_value IS NOT NULL)
  )
);
CREATE INDEX announcements_created_idx ON announcements (created_at DESC);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('announcement', 'reminder', 'system')),
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  announcement_id UUID REFERENCES announcements (id) ON DELETE CASCADE,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  CONSTRAINT notifications_dedupe_unique UNIQUE (farmer_id, dedupe_key)
);
CREATE INDEX notifications_inbox_idx ON notifications (farmer_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (farmer_id) WHERE read_at IS NULL;
CREATE INDEX notifications_announcement_idx ON notifications (announcement_id) WHERE announcement_id IS NOT NULL;

-- Farmers choose whether important messages may also come by SMS.
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS notify_sms BOOLEAN NOT NULL DEFAULT true;
