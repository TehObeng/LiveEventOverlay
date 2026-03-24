// ============================================
// Live Event QR Chat Overlay System — Types
// ============================================

export interface OverlayConfig {
  fontSize: number;
  color: string;
  speed: number;       // px per second
  stroke: string;
  shadow: boolean;
  opacity: number;
  fontFamily: string;
  laneCount: number;
  spawnInterval: number; // ms between spawns
  maxMessages: number;
  maxLifetime: number;   // seconds
}

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  fontSize: 48,
  color: '#FFFFFF',
  speed: 120,
  stroke: '#000000',
  shadow: true,
  opacity: 1,
  fontFamily: 'Arial',
  laneCount: 4,
  spawnInterval: 2000,
  maxMessages: 10,
  maxLifetime: 15,
};

export interface EventData {
  id: string;
  name: string;
  date: string;
  max_chars: number;
  cooldown_seconds: number;
  overlay_config: OverlayConfig;
  is_active: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  event_id: string;
  text: string;
  sender_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  ip_hash: string;
  is_banned: boolean;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface FilterResult {
  ok: boolean;
  reason?: 'blacklist' | 'link' | 'spam' | 'length';
  cleanedText?: string;
}
