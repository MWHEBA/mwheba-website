'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface AnimatedTextProps {
  /** The text content to split and animate word-by-word */
  text?: string;
  children?: React.ReactNode;
  /** HTML element to render (default: 'div') */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';
  /** Additional CSS class names */
  className?: string;
  /** Initial delay before first word animates (seconds) */
  delay?: number;
  /** Delay between each consecutive word (seconds) */
  stagger?: number;
  /** Animation duration per word (seconds) */
  duration?: number;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * AnimatedText
 * Finzo-inspired word-by-word content generation and materialization effect.
 * Keyframe-driven: deblurs from blur(10px) to blur(0px), glides from translateY(12px) to 0,
 * and fades from 0 to 1 with organic staggered timing.
 * 100% WCAG accessible: keeps intact full-string representation for screen readers & SEO.
 */
export function AnimatedText({
  text,
  children,
  as: Component = 'div',
  className = '',
  delay = 0.15,
  stagger = 0.045,
  duration = 0.65,
  style = {},
}: AnimatedTextProps) {
  const containerRef = useRef<HTMLElement>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // Brief timeout ensures initial blur state is painted before keyframes start
          const timer = setTimeout(() => {
            setIsRevealed(true);
          }, 40);

          observer.unobserve(entry.target);
          return () => clearTimeout(timer);
        }
      },
      {
        rootMargin: '0px 0px -30px 0px',
        threshold: 0.05,
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Determine content to split
  const rawText = text ?? (typeof children === 'string' ? children : '');

  // Split text by whitespace into words
  const words = rawText.trim().split(/\s+/);

  return (
    <Component
      ref={containerRef as any}
      className={`animated-text ${isRevealed ? 'is-revealed' : ''} ${className}`.trim()}
      style={style}
    >
      {/* 1. Accessible unbroken text for screen readers, SEO bots and test assertions */}
      <span className="visually-hidden">{rawText}</span>

      {/* 2. Visual word-by-word staggered frosted deblur animation */}
      <span aria-hidden="true" className="animated-words-track">
        {words.map((word, index) => {
          const wordDelay = delay + index * stagger;
          return (
            <span
              key={index}
              className="word"
              style={{
                animationDelay: `${wordDelay}s`,
                animationDuration: `${duration}s`,
              }}
            >
              {word}
            </span>
          );
        })}
      </span>
    </Component>
  );
}
