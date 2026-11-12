'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * ScrollRevealProvider
 * Orchestrates Finzo-style studio reveals across all components in the application.
 * Manages [data-aos], .reveal-on-scroll, and architectural clip-paths.
 * Triggers elements visibly upon entering viewport with organic stagger.
 */
export function ScrollRevealProvider({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Mark body as reveal-ready so unrevealed elements start at opacity 0 / clip-path
    document.body.classList.add('js-reveal-ready');

    const selector = [
      '[data-aos]',
      '[data-reveal]',
      '.reveal-on-scroll',
      '.section-heading',
      '.section-header',
      '.service-detail-hero',
      '.story-card',
      '.path',
      '.product',
      '.studio-product-card',
      '.portfolio-card',
      '.blog-card',
      '.article-card',
      '.studio-study-card',
      '.studio-process-step',
      '.testimonial-card',
      '.cta-box',
      '.proof-stage',
      '.live-proof-stage',
      '.studio-accordion-item',
      '.service-card',
      '.step',
      '.value-card',
      '.work-item',
      '.client-logo-item',
      '.metric-item',
      '.hero-visual',
      '.floating-label',
      '.inquiry-cta',
      '.studio-visual-ribbon',
      '.studio-ticker',
      '.contact-card',
      '.contact-form',
      '.contact-channel-card',
      '.quick-action-card',
      '.store-product-card',
      '.cta-banner-section',
      '.interactive-tabs',
      '.pricing-switcher',
      '.site-footer',
    ].join(', ');

    const elements = Array.from(document.querySelectorAll(selector));
    if (elements.length === 0) return;

    const unrevealed = new Set(elements);

    const revealElement = (el: Element) => {
      el.classList.add('is-revealed', 'aos-animate');
      unrevealed.delete(el);
    };

    const checkVisible = () => {
      const windowHeight = window.innerHeight;
      unrevealed.forEach((el) => {
        const rect = el.getBoundingClientRect();
        // Element enters reveal zone: top edge enters viewport or already above viewport
        if (rect.top <= windowHeight - 30 || rect.bottom < 0) {
          revealElement(el);
        }
      });
    };

    // 1. Initial viewport elements: trigger after a short 60ms delay
    // This allows the initial styles to be computed and drawn, so the user VISIBLY sees
    // the staggered entrance and curtain wipes play out!
    const initialTimer = setTimeout(() => {
      const windowHeight = window.innerHeight;
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < windowHeight - 30 && rect.bottom > 0) {
          revealElement(el);
        }
      });
    }, 60);

    // 2. Scroll and resize listeners: continuously check remaining elements as user scrolls
    const onScrollOrResize = () => {
      if (unrevealed.size === 0) {
        window.removeEventListener('scroll', onScrollOrResize);
        window.removeEventListener('resize', onScrollOrResize);
        return;
      }
      checkVisible();
    };

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [pathname]);

  return <>{children}</>;
}
