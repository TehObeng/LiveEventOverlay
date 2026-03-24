import { DEFAULT_OVERLAY_CONFIG } from './types.ts';
import type {
  EventData,
  Message,
  OverlayConfig,
  PublicApprovedMessage,
  PublicEventData,
} from './types.ts';

export function normalizeOverlayConfig(config: Partial<OverlayConfig> | null | undefined): OverlayConfig {
  return {
    ...DEFAULT_OVERLAY_CONFIG,
    ...(config || {}),
  };
}

export function toPublicEvent(event: Pick<EventData, 'id' | 'name' | 'max_chars' | 'cooldown_seconds' | 'overlay_config' | 'is_active' | 'overlay_cleared_at'>): PublicEventData {
  return {
    id: event.id,
    name: event.name,
    max_chars: event.max_chars,
    cooldown_seconds: event.cooldown_seconds,
    overlay_config: normalizeOverlayConfig(event.overlay_config),
    is_active: event.is_active,
    overlay_cleared_at: event.overlay_cleared_at,
  };
}

export function toPublicApprovedMessage(message: Pick<Message, 'id' | 'text' | 'sender_name' | 'approved_at'>): PublicApprovedMessage {
  return {
    id: message.id,
    text: message.text,
    sender_name: message.sender_name,
    approved_at: message.approved_at,
  };
}
