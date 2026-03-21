-- ============================================
-- Live Event QR Chat Overlay System — Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- EVENTS TABLE
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
    "shadow": true,
    "opacity": 1,
    "fontFamily": "Arial",
    "laneCount": 4,
    "spawnInterval": 2000,
    "maxMessages": 10,
    "maxLifetime": 15
  }'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sender_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ip_hash TEXT,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_messages_event_id ON messages(event_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_event_status ON messages(event_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_ip_hash ON messages(ip_hash);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on both tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Events: anyone can read active events, only authenticated users can manage
CREATE POLICY "Anyone can read active events"
  ON events FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can manage events"
  ON events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Messages: anyone can insert, only authenticated users can read/update
CREATE POLICY "Anyone can insert messages"
  ON messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read messages"
  ON messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- ENABLE REALTIME
-- ============================================

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
