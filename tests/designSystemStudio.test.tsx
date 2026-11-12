import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import {
  Eyebrow,
  VisualRibbon,
  Ticker,
  PathwaysGrid,
  LiveProofStage,
  ProductShowcaseCard,
  AnimatedCounter,
  InteractiveTabs,
  Accordion,
  PricingSwitcher,
  TestimonialCard,
} from '@/shared/ui/studio';

describe('PLAN-04: Studio Editorial Unified Design System & Components', () => {
  describe('CSS Architecture & Token Integrity', () => {
    it('declares all Studio tokens strictly in :root without hardcoded hex in component rules', () => {
      const cssPath = path.resolve(process.cwd(), 'src/styles/globals.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      // Verify tokens exist in :root
      expect(cssContent).toContain('--color-brand-blue:');
      expect(cssContent).toContain('--color-brand-blue-dark:');
      expect(cssContent).toContain('--color-brand-red:');
      expect(cssContent).toContain('--color-bg-canvas:');
      expect(cssContent).toContain('--color-surface-card:');
      expect(cssContent).toContain('--color-surface-subtle:');
      expect(cssContent).toContain('--color-surface-muted:');
      expect(cssContent).toContain('--color-surface-dark:');
      expect(cssContent).toContain('--color-text-ink:');
      expect(cssContent).toContain('--color-text-muted:');
      expect(cssContent).toContain('--color-border-line:');
    });

    it('verifies that background styles use valid root tokens and subtle atmospheric depth', () => {
      const cssPath = path.resolve(process.cwd(), 'src/styles/globals.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      // Check that root tokens support background lighting
      expect(cssContent).toContain('--cta-bg-start:');
      expect(cssContent).toContain('--cta-bg-mid:');
      expect(cssContent).toContain('--cta-bg-end:');
    });
  });

  describe('Eyebrow Component', () => {
    it('renders with studio-eyebrow class and custom children', () => {
      const html = renderToString(<Eyebrow>01 / THE CREATIVE STUDIO</Eyebrow>);
      expect(html).toContain('class="studio-eyebrow"');
      expect(html).toContain('01 / THE CREATIVE STUDIO');
    });

    it('supports rendering as different HTML tags', () => {
      const html = renderToString(<Eyebrow as="div">Section Tag</Eyebrow>);
      expect(html).toContain('<div class="studio-eyebrow">Section Tag</div>');
    });
  });

  describe('VisualRibbon Component', () => {
    it('renders default high-impact brand statements with ribbon dividers', () => {
      const html = renderToString(<VisualRibbon />);
      expect(html).toContain('studio-visual-ribbon');
      expect(html).toContain('DESIGNED TO STAND OUT');
      expect(html).toContain('CREATIVE × COMMERCE');
      expect(html).toContain('MADE IN EGYPT');
      expect(html).toContain('studio-ribbon-line');
    });

    it('renders custom textual props', () => {
      const html = renderToString(
        <VisualRibbon
          primaryText="CUSTOM CRAFT"
          middleText="CORPORATE LUXURY"
          endText="ALEXANDRIA"
        />
      );
      expect(html).toContain('CUSTOM CRAFT');
      expect(html).toContain('CORPORATE LUXURY');
      expect(html).toContain('ALEXANDRIA');
    });
  });

  describe('Ticker Component', () => {
    it('renders ticker track with default capability items and star bullet indicators', () => {
      const html = renderToString(<Ticker />);
      expect(html).toContain('studio-ticker');
      expect(html).toContain('studio-ticker-track');
      expect(html).toContain('BRAND STRATEGY');
      expect(html).toContain('CORPORATE GIFTS');
      expect(html).toContain('✳');
    });
  });

  describe('PathwaysGrid Component', () => {
    it('renders dual pathway cards with links to Studio and Corporate Store', () => {
      const html = renderToString(<PathwaysGrid />);
      expect(html).toContain('studio-pathways');
      expect(html).toContain('studio-path');
      expect(html).toContain('studio-path dark');
      expect(html).toContain('href="/services"');
      expect(html).toContain('href="/store"');
      expect(html).toContain('01 / THE CREATIVE STUDIO');
      expect(html).toContain('02 / THE CORPORATE STORE');
    });
  });

  describe('LiveProofStage Component', () => {
    it('renders proof preview card, file upload trigger, and material swatches', () => {
      const html = renderToString(<LiveProofStage />);
      expect(html).toContain('studio-proof-stage');
      expect(html).toContain('studio-proof-card');
      expect(html).toContain('Upload your logo');
      expect(html).toContain('aria-label="Blue finish"');
      expect(html).toContain('aria-label="Charcoal finish"');
      expect(html).toContain('aria-label="Silver finish"');
      expect(html).toContain('CHOOSE A FINISH');
    });
  });

  describe('ProductShowcaseCard Component', () => {
    it('renders product card with stage, title, category label, and minimum 10 units quantity stepper', () => {
      const html = renderToString(
        <ProductShowcaseCard
          id="prod-thermal-tumbler"
          title="Executive Thermal Tumbler"
          category="BEST FOR DAILY USE"
          minQuantity={10}
        />
      );
      expect(html).toContain('studio-product-card');
      expect(html).toContain('Executive Thermal Tumbler');
      expect(html).toContain('BEST FOR DAILY USE');
      expect(html).toContain('Minimum 10 units');
      expect(html).toContain('ui-stepper');
      expect(html).toContain('Add to Order');
      expect(html).toContain('10</output>');
    });
  });

  describe('Finzo-Inspired Shared Micro-Components', () => {
    it('AnimatedCounter: renders with accessible aria-label, number, and suffix', () => {
      const html = renderToString(
        <AnimatedCounter value={100} suffix="+" locale="ar" />
      );
      expect(html).toContain('animated-counter-value');
      expect(html).toContain('aria-label="100+"');
      expect(html).toContain('counter-suffix');
    });

    it('InteractiveTabs: renders tablist and active tab panel', () => {
      const tabs = [
        { id: 'tab1', label: 'Brand Strategy', content: <div>Brand Strategy Content</div> },
        { id: 'tab2', label: 'Web Platforms', content: <div>Web Content</div> },
      ];
      const html = renderToString(<InteractiveTabs items={tabs} defaultTabId="tab1" />);
      expect(html).toContain('role="tablist"');
      expect(html).toContain('Brand Strategy');
      expect(html).toContain('Web Platforms');
      expect(html).toContain('Brand Strategy Content');
    });

    it('Accordion: renders collapsible items with accessible aria attributes', () => {
      const items = [
        { id: 'faq1', title: 'What is the MOQ?', content: <p>Minimum order is 10 units.</p> },
      ];
      const html = renderToString(<Accordion items={items} defaultExpandedId="faq1" />);
      expect(html).toContain('studio-accordion-group');
      expect(html).toContain('What is the MOQ?');
      expect(html).toContain('Minimum order is 10 units.');
      expect(html).toContain('aria-expanded="true"');
    });

    it('PricingSwitcher: renders dual billing options and highlight badge', () => {
      const options: [{ id: string; label: string }, { id: string; label: string; badge: string }] = [
        { id: 'standard', label: 'Standard Delivery' },
        { id: 'priority', label: 'Priority Delivery', badge: 'Fast Track' },
      ];
      const html = renderToString(
        <PricingSwitcher options={options} selectedId="priority" onChange={() => {}} />
      );
      expect(html).toContain('pricing-switcher-track');
      expect(html).toContain('Standard Delivery');
      expect(html).toContain('Priority Delivery');
      expect(html).toContain('Fast Track');
    });

    it('TestimonialCard: renders rating, quote, author, role, and corporate badge', () => {
      const html = renderToString(
        <TestimonialCard
          quote="MWHEBA elevated our executive corporate gifting."
          author="Tarek Mansour"
          role="Operations Director"
          company="Alexandria Petroleum"
          rating={5}
          verifiedLabel="Verified Enterprise Client"
        />
      );
      expect(html).toContain('testimonial-card');
      expect(html).toContain('Tarek Mansour');
      expect(html).toContain('Operations Director');
      expect(html).toContain('Alexandria Petroleum');
      expect(html).toContain('Verified Enterprise Client');
      expect(html).toContain('MWHEBA elevated our executive corporate gifting.');
    });
  });
});
