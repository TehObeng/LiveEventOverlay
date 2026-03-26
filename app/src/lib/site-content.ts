import type { SiteContent } from './types';

export const SITE_CONTENT_KEY = 'landing_page';

export const DEFAULT_SITE_CONTENT: SiteContent = {
  nav: {
    logoText: 'Live Event Overlay',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
    ],
    adminButtonLabel: 'Admin Login',
  },
  hero: {
    badge: 'Trusted by event teams',
    title: 'Create a moderated live chat wall for your event in minutes.',
    subtitle: 'Turn audience messages into a safe, beautiful stage overlay with QR onboarding and real-time moderation.',
    primaryCtaLabel: 'Open Admin Panel',
    primaryCtaHref: '/admin/login',
    secondaryCtaLabel: 'Audience Chat Demo',
    secondaryCtaHref: '/chat',
    highlightNotice: 'No-code setup · Supabase-backed · OBS ready',
  },
  sections: {
    featuresTitle: 'Everything needed for safe audience interaction',
    featuresSubtitle: 'Built for conference teams, worship services, and livestream operators.',
    pricingTitle: 'Simple pricing blocks for your package page',
    pricingSubtitle: 'Control your offer copy directly from CMS without touching code.',
    timelineTitle: 'Launch flow in three clear steps',
    timelineSubtitle: 'A predictable process for both operators and volunteers.',
    faqTitle: 'Frequently asked questions',
    faqSubtitle: 'Explain confidence, privacy, and moderation flow up front.',
    registrationTitle: 'Ready to run your next event?',
    registrationSubtitle: 'Deploy your chat wall with secure moderation in under one hour.',
  },
  features: [
    {
      title: 'Real-time moderation queue',
      description: 'Approve, reject, edit, and ban senders from one dashboard before messages appear live.',
    },
    {
      title: 'Event-specific QR links',
      description: 'Generate chat URLs and QR codes instantly per event so audiences can join quickly.',
    },
    {
      title: 'Flexible overlay styles',
      description: 'Customize typography, movement direction, opacity, and lane layout for each production.',
    },
  ],
  pricingCards: [
    {
      name: 'Starter',
      price: '$0',
      description: 'For rehearsals and internal events.',
      items: ['1 active event', 'Basic moderation', 'Default overlay themes'],
      ctaLabel: 'Get Started',
    },
    {
      name: 'Pro',
      price: '$29',
      description: 'For recurring live events needing reliable moderation.',
      items: ['Unlimited events', 'Bulk moderation actions', 'Priority reliability'],
      ctaLabel: 'Choose Pro',
    },
  ],
  timelineItems: [
    {
      title: 'Create event',
      description: 'Set event name, date, overlay rules, and moderation defaults in admin CMS.',
    },
    {
      title: 'Share QR link',
      description: 'Audience scans and submits messages from any phone browser in seconds.',
    },
    {
      title: 'Moderate and display',
      description: 'Approve high-quality messages and stream them to OBS overlay live.',
    },
  ],
  faqItems: [
    {
      question: 'Can we moderate before messages are shown?',
      answer: 'Yes. Every incoming message can be reviewed and approved from the admin panel.',
    },
    {
      question: 'Does it work on mobile for participants?',
      answer: 'Yes. The chat form is responsive and optimized for small screens.',
    },
  ],
  registration: {
    ctaLabel: 'Go to Admin',
    ctaHref: '/admin/login',
    helperText: 'Need branding customization? Use the CMS section in admin to edit copy live.',
  },
  footer: {
    text: '© Live Event Overlay. Built for interactive events with safer moderation.',
    links: [
      { label: 'Admin', href: '/admin/login' },
      { label: 'Audience Chat', href: '/chat' },
    ],
  },
};

interface PrimitiveLink {
  label: string;
  href: string;
}

function toLink(value: unknown): PrimitiveLink | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const source = value as Record<string, unknown>;
  if (typeof source.label !== 'string' || typeof source.href !== 'string') {
    return null;
  }

  const label = source.label.trim();
  const href = source.href.trim();

  if (!label || !href) {
    return null;
  }

  return { label, href };
}

function toStringValue(value: unknown, fallback: string, maxLength = 300): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, maxLength);
}

function toStringArray(value: unknown, fallback: string[], maxItems = 8): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const cleaned = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);

  return cleaned.length > 0 ? cleaned : fallback;
}

export function normalizeSiteContent(content: unknown): SiteContent {
  const source = content && typeof content === 'object' ? content as Record<string, unknown> : {};

  const navSource = source.nav && typeof source.nav === 'object' ? source.nav as Record<string, unknown> : {};
  const heroSource = source.hero && typeof source.hero === 'object' ? source.hero as Record<string, unknown> : {};
  const sectionSource = source.sections && typeof source.sections === 'object' ? source.sections as Record<string, unknown> : {};
  const registrationSource = source.registration && typeof source.registration === 'object' ? source.registration as Record<string, unknown> : {};
  const footerSource = source.footer && typeof source.footer === 'object' ? source.footer as Record<string, unknown> : {};

  return {
    nav: {
      logoText: toStringValue(navSource.logoText, DEFAULT_SITE_CONTENT.nav.logoText, 80),
      links: Array.isArray(navSource.links)
        ? navSource.links.map(toLink).filter((item): item is PrimitiveLink => item !== null).slice(0, 6)
        : DEFAULT_SITE_CONTENT.nav.links,
      adminButtonLabel: toStringValue(navSource.adminButtonLabel, DEFAULT_SITE_CONTENT.nav.adminButtonLabel, 40),
    },
    hero: {
      badge: toStringValue(heroSource.badge, DEFAULT_SITE_CONTENT.hero.badge, 80),
      title: toStringValue(heroSource.title, DEFAULT_SITE_CONTENT.hero.title, 140),
      subtitle: toStringValue(heroSource.subtitle, DEFAULT_SITE_CONTENT.hero.subtitle, 280),
      primaryCtaLabel: toStringValue(heroSource.primaryCtaLabel, DEFAULT_SITE_CONTENT.hero.primaryCtaLabel, 40),
      primaryCtaHref: toStringValue(heroSource.primaryCtaHref, DEFAULT_SITE_CONTENT.hero.primaryCtaHref, 120),
      secondaryCtaLabel: toStringValue(heroSource.secondaryCtaLabel, DEFAULT_SITE_CONTENT.hero.secondaryCtaLabel, 40),
      secondaryCtaHref: toStringValue(heroSource.secondaryCtaHref, DEFAULT_SITE_CONTENT.hero.secondaryCtaHref, 120),
      highlightNotice: toStringValue(heroSource.highlightNotice, DEFAULT_SITE_CONTENT.hero.highlightNotice, 160),
    },
    sections: {
      featuresTitle: toStringValue(sectionSource.featuresTitle, DEFAULT_SITE_CONTENT.sections.featuresTitle, 120),
      featuresSubtitle: toStringValue(sectionSource.featuresSubtitle, DEFAULT_SITE_CONTENT.sections.featuresSubtitle, 220),
      pricingTitle: toStringValue(sectionSource.pricingTitle, DEFAULT_SITE_CONTENT.sections.pricingTitle, 120),
      pricingSubtitle: toStringValue(sectionSource.pricingSubtitle, DEFAULT_SITE_CONTENT.sections.pricingSubtitle, 220),
      timelineTitle: toStringValue(sectionSource.timelineTitle, DEFAULT_SITE_CONTENT.sections.timelineTitle, 120),
      timelineSubtitle: toStringValue(sectionSource.timelineSubtitle, DEFAULT_SITE_CONTENT.sections.timelineSubtitle, 220),
      faqTitle: toStringValue(sectionSource.faqTitle, DEFAULT_SITE_CONTENT.sections.faqTitle, 120),
      faqSubtitle: toStringValue(sectionSource.faqSubtitle, DEFAULT_SITE_CONTENT.sections.faqSubtitle, 220),
      registrationTitle: toStringValue(sectionSource.registrationTitle, DEFAULT_SITE_CONTENT.sections.registrationTitle, 120),
      registrationSubtitle: toStringValue(sectionSource.registrationSubtitle, DEFAULT_SITE_CONTENT.sections.registrationSubtitle, 220),
    },
    features: Array.isArray(source.features)
      ? source.features
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          return {
            title: toStringValue(record.title, '', 90),
            description: toStringValue(record.description, '', 180),
          };
        })
        .filter((item): item is { title: string; description: string } => Boolean(item?.title && item?.description))
        .slice(0, 6)
      : DEFAULT_SITE_CONTENT.features,
    pricingCards: Array.isArray(source.pricingCards)
      ? source.pricingCards
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          return {
            name: toStringValue(record.name, '', 40),
            price: toStringValue(record.price, '', 40),
            description: toStringValue(record.description, '', 160),
            items: toStringArray(record.items, []),
            ctaLabel: toStringValue(record.ctaLabel, 'Learn More', 40),
          };
        })
        .filter((item): item is { name: string; price: string; description: string; items: string[]; ctaLabel: string } => Boolean(item?.name && item?.price))
        .slice(0, 4)
      : DEFAULT_SITE_CONTENT.pricingCards,
    timelineItems: Array.isArray(source.timelineItems)
      ? source.timelineItems
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          return {
            title: toStringValue(record.title, '', 80),
            description: toStringValue(record.description, '', 180),
          };
        })
        .filter((item): item is { title: string; description: string } => Boolean(item?.title && item?.description))
        .slice(0, 6)
      : DEFAULT_SITE_CONTENT.timelineItems,
    faqItems: Array.isArray(source.faqItems)
      ? source.faqItems
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          return {
            question: toStringValue(record.question, '', 160),
            answer: toStringValue(record.answer, '', 300),
          };
        })
        .filter((item): item is { question: string; answer: string } => Boolean(item?.question && item?.answer))
        .slice(0, 8)
      : DEFAULT_SITE_CONTENT.faqItems,
    registration: {
      ctaLabel: toStringValue(registrationSource.ctaLabel, DEFAULT_SITE_CONTENT.registration.ctaLabel, 40),
      ctaHref: toStringValue(registrationSource.ctaHref, DEFAULT_SITE_CONTENT.registration.ctaHref, 120),
      helperText: toStringValue(registrationSource.helperText, DEFAULT_SITE_CONTENT.registration.helperText, 220),
    },
    footer: {
      text: toStringValue(footerSource.text, DEFAULT_SITE_CONTENT.footer.text, 220),
      links: Array.isArray(footerSource.links)
        ? footerSource.links.map(toLink).filter((item): item is PrimitiveLink => item !== null).slice(0, 6)
        : DEFAULT_SITE_CONTENT.footer.links,
    },
  };
}
