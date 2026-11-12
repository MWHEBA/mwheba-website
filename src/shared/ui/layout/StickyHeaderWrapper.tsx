'use client';

import React, { useEffect, useState } from 'react';

interface StickyHeaderWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * StickyHeaderWrapper
 * Implements smooth Finzo-inspired transition from static top flow to floating sticky pill.
 * Directionally detects scroll-up vs scroll-down with requestAnimationFrame throttling
 * and calibrated hysteresis to prevent jitter.
 */
export function StickyHeaderWrapper({ children, className = '' }: StickyHeaderWrapperProps) {
  const [scrollState, setScrollState] = useState<'top' | 'scroll-up' | 'scroll-down'>('top');

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    // Synchronize initial state on client mount
    if (window.scrollY > 30) {
      setScrollState('scroll-up');
    }

    const updateHeader = () => {
      const currentScrollY = Math.max(0, window.scrollY);

      if (currentScrollY === lastScrollY) {
        ticking = false;
        return;
      }

      // Calibrated hysteresis:
      // Return to 'top' only when near the very top (<= 15px)
      // Switch between scroll-up and scroll-down only when past 35px
      if (currentScrollY <= 15) {
        setScrollState('top');
      } else if (currentScrollY > 35) {
        if (lastScrollY > currentScrollY) {
          // User scrolling up: reveal sticky pill prominently
          setScrollState('scroll-up');
        } else {
          // User scrolling down: compact sticky state
          setScrollState('scroll-down');
        }
      }

      lastScrollY = currentScrollY;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isScrolled = scrollState !== 'top';
  const stateClasses = [
    isScrolled ? 'is-scrolled' : 'is-top',
    scrollState !== 'top' ? scrollState : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header
      className={`site-header sticky-header ${stateClasses} ${className}`.trim()}
      role="banner"
      data-scroll-state={scrollState}
    >
      {children}
    </header>
  );
}
