// ============================================
// Live Event QR Chat Overlay System - Types
// ============================================

export type ScrollDirection = 'rtl' | 'ltr' | 'ttb' | 'btt';
export type ScrollType = 'danmaku' | 'tiktok';

export interface OverlayConfig {
  fontSize: number;
  color: string;
  speed: number;            // px per second
  stroke: string;
  strokeWidth: number;      // px (0-5)
  shadow: boolean;
  opacity: number;
  fontFamily: string;
  laneCount: number;
  spawnInterval: number;    // ms between spawns
  maxMessages: number;
  maxLifetime: number;      // seconds
  scrollDirection: ScrollDirection;
  scrollType: ScrollType;
  gapHorizontal: number;    // px gap between messages horizontally
  gapVertical: number;      // px gap between lanes vertically
  bgColor: string;          // overlay background color
  bgOpacity: number;        // overlay bg opacity (0 = transparent)
  speedVariance: number;    // 0-1; speed randomization (0 = no variance, 1 = +/-100%)
}

export const DEFAULT_OVERLAY_CONFIG: OverlayConfig = {
  fontSize: 48,
  color: '#FFFFFF',
  speed: 120,
  stroke: '#000000',
  strokeWidth: 2,
  shadow: true,
  opacity: 1,
  fontFamily: 'Arial',
  laneCount: 4,
  spawnInterval: 2000,
  maxMessages: 10,
  maxLifetime: 15,
  scrollDirection: 'rtl',
  scrollType: 'danmaku',
  gapHorizontal: 80,
  gapVertical: 10,
  bgColor: '#000000',
  bgOpacity: 0,
  speedVariance: 0.3,
};

export interface EventData {
  id: string;
  name: string;
  date: string;
  max_chars: number;
  cooldown_seconds: number;
  overlay_config: OverlayConfig;
  auto_approve: boolean;
  is_active: boolean;
  created_at: string;
  overlay_cleared_at: string | null;
}

export interface Message {
  id: string;
  event_id: string;
  text: string;
  sender_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  risk_level: 'safe' | 'risky' | null;
  ip_hash: string | null;
  is_banned: boolean;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface FilterResult {
  ok: boolean;
  riskLevel: 'safe' | 'risky' | 'blocked';
  reason?: 'blacklist' | 'link' | 'spam' | 'length';
  cleanedText?: string;
}

export interface PublicEventData {
  id: string;
  name: string;
  max_chars: number;
  cooldown_seconds: number;
  overlay_config: OverlayConfig;
  is_active: boolean;
  overlay_cleared_at: string | null;
}

export interface PublicApprovedMessage {
  id: string;
  text: string;
  sender_name: string | null;
  approved_at: string | null;
}

export interface AdminSessionData {
  userId: string;
  email: string | null;
}

export type AdminBulkMessageAction = 'approve' | 'reject' | 'delete';


export interface ContentLink {
  label: string;
  href: string;
}

export interface SiteContent {
  nav: {
    logoText: string;
    links: ContentLink[];
    adminButtonLabel: string;
  };
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    highlightNotice: string;
  };
  sections: {
    featuresTitle: string;
    featuresSubtitle: string;
    pricingTitle: string;
    pricingSubtitle: string;
    timelineTitle: string;
    timelineSubtitle: string;
    faqTitle: string;
    faqSubtitle: string;
    registrationTitle: string;
    registrationSubtitle: string;
  };
  features: Array<{
    title: string;
    description: string;
  }>;
  pricingCards: Array<{
    name: string;
    price: string;
    description: string;
    items: string[];
    ctaLabel: string;
  }>;
  timelineItems: Array<{
    title: string;
    description: string;
  }>;
  faqItems: Array<{
    question: string;
    answer: string;
  }>;
  registration: {
    ctaLabel: string;
    ctaHref: string;
    helperText: string;
  };
  footer: {
    text: string;
    links: ContentLink[];
  };
}

export interface SiteContentResponse {
  content: SiteContent;
}

export interface ApiErrorResponse {
  error: string;
}

export interface SuccessResponse {
  success: true;
  message?: string;
}

export interface AdminEventsResponse {
  events: EventData[];
}

export interface AdminEventResponse {
  event: EventData;
}

export interface AdminMessagesResponse {
  messages: Message[];
}

export interface AdminSessionResponse {
  user: AdminSessionData;
}

export interface PublicEventResponse {
  event: PublicEventData;
}

export interface PublicMessagesResponse {
  messages: PublicApprovedMessage[];
  nextSince: string | null;
  clearedAt: string | null;
}
