import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StickyHeaderWrapper } from '@/shared/ui/layout/StickyHeaderWrapper';

describe('StickyHeaderWrapper Component', () => {
  it('renders server snapshot in is-top state with banner role', () => {
    const html = renderToString(
      <StickyHeaderWrapper>
        <nav>Navigation Content</nav>
      </StickyHeaderWrapper>
    );

    expect(html).toContain('site-header');
    expect(html).toContain('sticky-header');
    expect(html).toContain('is-top');
    expect(html).toContain('role="banner"');
    expect(html).toContain('data-scroll-state="top"');
    expect(html).toContain('Navigation Content');
  });
});
