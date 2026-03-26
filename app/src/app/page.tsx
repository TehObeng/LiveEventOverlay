import Link from 'next/link';
import { createServiceRoleSupabaseClient } from '@/lib/supabase-server';
import { DEFAULT_SITE_CONTENT, normalizeSiteContent, SITE_CONTENT_KEY } from '@/lib/site-content';
import type { SiteContent } from '@/lib/types';

async function getLandingContent(): Promise<SiteContent> {
  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', SITE_CONTENT_KEY)
      .maybeSingle();

    if (error) {
      return DEFAULT_SITE_CONTENT;
    }

    const row = data as { content?: unknown } | null;
    return normalizeSiteContent(row?.content);
  } catch {
    return DEFAULT_SITE_CONTENT;
  }
}

export default async function Home() {
  const content = await getLandingContent();

  return (
    <main className="landing">
      <header className="landing-nav">
        <div className="container landing-nav-inner">
          <span className="landing-logo">{content.nav.logoText}</span>
          <nav className="landing-links" aria-label="Main navigation">
            {content.nav.links.map((link) => (
              <a key={`${link.href}-${link.label}`} href={link.href}>{link.label}</a>
            ))}
          </nav>
          <Link href="/admin/login" className="btn btn-ghost btn-sm">{content.nav.adminButtonLabel}</Link>
        </div>
      </header>

      <section className="hero-section">
        <div className="container hero-grid">
          <div>
            <p className="hero-badge">{content.hero.badge}</p>
            <h1 className="hero-title">{content.hero.title}</h1>
            <p className="hero-subtitle">{content.hero.subtitle}</p>
            <div className="hero-actions">
              <Link href={content.hero.primaryCtaHref} className="btn btn-primary btn-lg">{content.hero.primaryCtaLabel}</Link>
              <Link href={content.hero.secondaryCtaHref} className="btn btn-ghost btn-lg">{content.hero.secondaryCtaLabel}</Link>
            </div>
            <p className="hero-notice">{content.hero.highlightNotice}</p>
          </div>
          <div className="hero-panel glass-card">
            <h3>Operator workflow</h3>
            <ol>
              {content.timelineItems.slice(0, 3).map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="features" className="content-section">
        <div className="container">
          <h2>{content.sections.featuresTitle}</h2>
          <p className="section-subtitle">{content.sections.featuresSubtitle}</p>
          <div className="feature-grid">
            {content.features.map((feature) => (
              <article key={feature.title} className="glass-card feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="content-section alt">
        <div className="container">
          <h2>{content.sections.pricingTitle}</h2>
          <p className="section-subtitle">{content.sections.pricingSubtitle}</p>
          <div className="pricing-grid">
            {content.pricingCards.map((card) => (
              <article key={card.name} className="glass-card pricing-card">
                <h3>{card.name}</h3>
                <p className="pricing-price">{card.price}</p>
                <p>{card.description}</p>
                <ul>
                  {card.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <button type="button" className="btn btn-primary w-full">{card.ctaLabel}</button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="container">
          <h2>{content.sections.timelineTitle}</h2>
          <p className="section-subtitle">{content.sections.timelineSubtitle}</p>
          <div className="timeline-grid">
            {content.timelineItems.map((item, index) => (
              <article key={item.title} className="timeline-item">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="content-section alt">
        <div className="container">
          <h2>{content.sections.faqTitle}</h2>
          <p className="section-subtitle">{content.sections.faqSubtitle}</p>
          <div className="faq-list">
            {content.faqItems.map((item) => (
              <details key={item.question} className="faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section cta-section">
        <div className="container cta-block glass-card">
          <h2>{content.sections.registrationTitle}</h2>
          <p>{content.sections.registrationSubtitle}</p>
          <Link href={content.registration.ctaHref} className="btn btn-primary btn-lg">{content.registration.ctaLabel}</Link>
          <p className="text-sm text-secondary">{content.registration.helperText}</p>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="container landing-footer-inner">
          <p>{content.footer.text}</p>
          <div className="landing-footer-links">
            {content.footer.links.map((link) => (
              <Link key={`${link.href}-${link.label}`} href={link.href}>{link.label}</Link>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
