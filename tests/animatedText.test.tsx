import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AnimatedText } from '@/shared/ui/studio/AnimatedText';

describe('AnimatedText Component', () => {
  it('renders accessible full-text and word-by-word spans', () => {
    const html = renderToString(
      <AnimatedText
        as="h1"
        className="display"
        delay={0.1}
        stagger={0.05}
        text="العلامات التجارية المبتكرة"
      />
    );

    // Verifies full string match for screen readers and SEO
    expect(html).toContain('visually-hidden');
    expect(html).toContain('العلامات التجارية المبتكرة');

    // Verifies individual animated words
    expect(html).toContain('class="word"');
    expect(html).toContain('العلامات</span>');
    expect(html).toContain('التجارية</span>');
    expect(html).toContain('المبتكرة</span>');
  });

  it('renders as custom tag with specified duration and delay', () => {
    const html = renderToString(
      <AnimatedText
        as="p"
        className="hero-description"
        delay={0.2}
        stagger={0.03}
        duration={0.7}
        text="Design studio"
      />
    );

    expect(html).toContain('<p');
    expect(html).toContain('hero-description');
    expect(html).toContain('Design');
    expect(html).toContain('studio');
    expect(html).toContain('animation-duration:0.7s');
  });
});
