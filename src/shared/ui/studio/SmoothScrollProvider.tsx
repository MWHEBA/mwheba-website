'use client';

import React, { useEffect } from 'react';

/**
 * SmoothScrollProvider
 * Implements physics-based inertial scrolling (matching Lenis in Finzo)
 * with exponential interpolation (lerp) on desktop mouse wheels.
 * Prevents abrupt 100px native jumps and gives a luxurious glide.
 */
export function SmoothScrollProvider({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    // Only activate on pointer devices (mouse/touchpad), not mobile touchscreens
    const isTouchOnly = 'ontouchstart' in window && !window.matchMedia('(hover: hover)').matches;
    if (isTouchOnly) {
      return;
    }

    let isRunning = false;
    let targetY = window.scrollY;
    let currentY = window.scrollY;
    const ease = 0.09; // Calibrated silky inertial glide

    const onWheel = (e: WheelEvent) => {
      // Don't intercept zoom / back
      if (e.ctrlKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-no-smooth-scroll], textarea, input, select, pre, .overflow-y-auto, .overflow-y-scroll')) {
        return;
      }

      e.preventDefault();

      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );

      // Accumulate wheel delta with multiplier for fluid response
      targetY = Math.max(0, Math.min(maxScroll, targetY + e.deltaY * 1.15));

      if (!isRunning) {
        isRunning = true;
        requestAnimationFrame(updateScroll);
      }
    };

    const updateScroll = () => {
      const diff = targetY - currentY;
      currentY += diff * ease;

      window.scrollTo(0, Math.round(currentY));

      if (Math.abs(targetY - currentY) > 0.6) {
        requestAnimationFrame(updateScroll);
      } else {
        currentY = targetY;
        window.scrollTo(0, targetY);
        isRunning = false;
      }
    };

    const onScroll = () => {
      if (!isRunning) {
        currentY = window.scrollY;
        targetY = window.scrollY;
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
      isRunning = false;
    };
  }, []);

  return <>{children}</>;
}
