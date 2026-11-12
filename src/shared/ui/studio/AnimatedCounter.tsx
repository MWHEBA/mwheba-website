'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface AnimatedCounterProps {
  /** Target numeric value to count up to */
  value: number;
  /** Duration in milliseconds (default: 1800ms) */
  duration?: number;
  /** Optional prefix symbol (e.g., "$") */
  prefix?: string;
  /** Optional suffix symbol (e.g., "+", "%", "K") */
  suffix?: string;
  /** CSS class name */
  className?: string;
  /** Locale for number formatting ('ar' or 'en') */
  locale?: string;
}

export function AnimatedCounter({
  value,
  duration = 1800,
  prefix = '',
  suffix = '',
  className = '',
  locale = 'ar',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    // Check for prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);

          const startTime = performance.now();
          const startValue = 0;

          const easeOutExpo = (t: number): number => {
            return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          };

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutExpo(progress);
            const currentNumber = Math.round(startValue + (value - startValue) * easedProgress);

            setDisplayValue(currentNumber);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setDisplayValue(value);
            }
          };

          requestAnimationFrame(animate);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [value, duration, hasAnimated]);

  return (
    <span
      ref={elementRef}
      className={`animated-counter-value ${className}`.trim()}
      aria-label={`${prefix}${value}${suffix}`}
    >
      <span className="counter-prefix" aria-hidden="true">
        {prefix}
      </span>
      <span className="counter-number" aria-hidden="true">
        {displayValue}
      </span>
      <span className="counter-suffix" aria-hidden="true">
        {suffix}
      </span>
    </span>
  );
}
