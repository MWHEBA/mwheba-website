'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
}

interface MobileDrawerProps {
  locale: string;
  items: NavItem[];
  otherLocaleHref: string;
  otherLocaleLabel: string;
}

export function MobileDrawer({
  locale,
  items,
  otherLocaleHref,
  otherLocaleLabel,
}: MobileDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close drawer on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleAriaLabel = locale === 'ar' ? 'تبديل القائمة' : 'Toggle navigation';
  const closeAriaLabel = locale === 'ar' ? 'إغلاق القائمة' : 'Close navigation';

  return (
    <>
      <button
        type="button"
        className="drawer-toggle-btn"
        aria-expanded={isOpen}
        aria-controls="mobile-drawer-panel"
        aria-label={toggleAriaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="drawer-backdrop"
            aria-label={closeAriaLabel}
            onClick={() => setIsOpen(false)}
          />
          <div
            id="mobile-drawer-panel"
            className="drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label={toggleAriaLabel}
          >
            <div className="drawer-header">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-wide.webp"
                alt={locale === 'ar' ? 'موهبة' : 'MWHEBA'}
                height={30}
                style={{ height: '30px', width: 'auto', display: 'block' }}
              />
              <button
                type="button"
                className="drawer-close-btn"
                aria-label={closeAriaLabel}
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            <nav>
              <ul className="drawer-nav">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <Link
                href={otherLocaleHref}
                className="lang-switch-btn"
                style={{ width: '100%' }}
                onClick={() => setIsOpen(false)}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
                <span>{otherLocaleLabel}</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
