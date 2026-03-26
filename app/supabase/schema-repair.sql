-- ============================================
-- Live Chat Overlay System - Schema Repair
-- Use this when an existing database is missing newer columns.
-- Safe to run multiple times.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- EVENTS TABLE REPAIR
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  max_chars INTEGER NOT NULL DEFAULT 100,
  cooldown_seconds INTEGER NOT NULL DEFAULT 10,
  overlay_config JSONB NOT NULL DEFAULT '{
    "fontSize": 48,
    "color": "#FFFFFF",
    "speed": 120,
    "stroke": "#000000",
    "strokeWidth": 2,
    "shadow": true,
    "opacity": 1,
    "fontFamily": "Arial",
    "laneCount": 4,
    "spawnInterval": 2000,
    "maxMessages": 10,
    "maxLifetime": 15,
    "scrollDirection": "rtl",
    "scrollType": "danmaku",
    "gapHorizontal": 80,
    "gapVertical": 10,
    "bgColor": "#000000",
    "bgOpacity": 0,
    "speedVariance": 0.3
  }'::jsonb,
  auto_approve BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  overlay_cleared_at TIMESTAMPTZ
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS max_chars INTEGER NOT NULL DEFAULT 100;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER NOT NULL DEFAULT 10;
ALTER TABLE events ADD COLUMN IF NOT EXISTS overlay_config JSONB NOT NULL DEFAULT '{
  "fontSize": 48,
  "color": "#FFFFFF",
  "speed": 120,
  "stroke": "#000000",
  "strokeWidth": 2,
  "shadow": true,
  "opacity": 1,
  "fontFamily": "Arial",
  "laneCount": 4,
  "spawnInterval": 2000,
  "maxMessages": 10,
  "maxLifetime": 15,
  "scrollDirection": "rtl",
  "scrollType": "danmaku",
  "gapHorizontal": 80,
  "gapVertical": 10,
  "bgColor": "#000000",
  "bgOpacity": 0,
  "speedVariance": 0.3
}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS auto_approve BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE events ADD COLUMN IF NOT EXISTS overlay_cleared_at TIMESTAMPTZ;

UPDATE events
SET overlay_config = COALESCE(overlay_config, '{
  "fontSize": 48,
  "color": "#FFFFFF",
  "speed": 120,
  "stroke": "#000000",
  "strokeWidth": 2,
  "shadow": true,
  "opacity": 1,
  "fontFamily": "Arial",
  "laneCount": 4,
  "spawnInterval": 2000,
  "maxMessages": 10,
  "maxLifetime": 15,
  "scrollDirection": "rtl",
  "scrollType": "danmaku",
  "gapHorizontal": 80,
  "gapVertical": 10,
  "bgColor": "#000000",
  "bgOpacity": 0,
  "speedVariance": 0.3
}'::jsonb);

UPDATE events SET auto_approve = true WHERE auto_approve IS NULL;
UPDATE events SET is_active = true WHERE is_active IS NULL;
UPDATE events SET created_at = NOW() WHERE created_at IS NULL;

ALTER TABLE events ALTER COLUMN overlay_config SET DEFAULT '{
  "fontSize": 48,
  "color": "#FFFFFF",
  "speed": 120,
  "stroke": "#000000",
  "strokeWidth": 2,
  "shadow": true,
  "opacity": 1,
  "fontFamily": "Arial",
  "laneCount": 4,
  "spawnInterval": 2000,
  "maxMessages": 10,
  "maxLifetime": 15,
  "scrollDirection": "rtl",
  "scrollType": "danmaku",
  "gapHorizontal": 80,
  "gapVertical": 10,
  "bgColor": "#000000",
  "bgOpacity": 0,
  "speedVariance": 0.3
}'::jsonb;

-- ============================================
-- MESSAGES TABLE REPAIR
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sender_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  risk_level TEXT CHECK (risk_level IN ('safe', 'risky') OR risk_level IS NULL),
  ip_hash TEXT,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS risk_level TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ip_hash TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE messages ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS approved_by TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_status_check'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_risk_level_check'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_risk_level_check
      CHECK (risk_level IN ('safe', 'risky') OR risk_level IS NULL);
  END IF;
END $$;

UPDATE messages SET status = 'pending' WHERE status IS NULL;
UPDATE messages SET is_banned = false WHERE is_banned IS NULL;
UPDATE messages SET created_at = NOW() WHERE created_at IS NULL;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_messages_event_id ON messages(event_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_event_status ON messages(event_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_ip_hash ON messages(ip_hash);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ============================================
-- RLS / POLICIES
-- ============================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read events" ON events;
DROP POLICY IF EXISTS "Authenticated users can manage events" ON events;
DROP POLICY IF EXISTS "Authenticated users can read messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can delete messages" ON messages;

CREATE POLICY "Authenticated users can read events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage events"
  ON events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read messages"
  ON messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete messages"
  ON messages FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- REALTIME MEMBERSHIP
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class pc ON pc.oid = pr.prrelid
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND pn.nspname = 'public'
      AND pc.relname = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;



-- ============================================
-- ADMIN USERS + SITE CONTENT REPAIR
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS created_by UUID;

UPDATE admin_users SET role = 'admin' WHERE role IS NULL;
UPDATE admin_users SET is_active = true WHERE is_active IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_users_role_check'
  ) THEN
    ALTER TABLE admin_users
      ADD CONSTRAINT admin_users_role_check
      CHECK (role IN ('admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS site_content (
  key TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

ALTER TABLE site_content ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS updated_by UUID;

CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_site_content_updated_at ON site_content;
CREATE TRIGGER trg_site_content_updated_at
  BEFORE UPDATE ON site_content
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

INSERT INTO site_content (key, content)
VALUES ('landing_page', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read admin_users" ON admin_users;
DROP POLICY IF EXISTS "Authenticated users can manage admin_users" ON admin_users;
DROP POLICY IF EXISTS "Authenticated users can read site_content" ON site_content;
DROP POLICY IF EXISTS "Authenticated users can manage site_content" ON site_content;

CREATE POLICY "Authenticated users can read admin_users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage admin_users"
  ON admin_users FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read site_content"
  ON site_content FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage site_content"
  ON site_content FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- DONE
-- ============================================
SELECT 'schema repair complete' AS status;
