import React from 'react';
import Link from 'next/link';
import { ArrowUpRightIcon } from '@/shared/ui/icons';

export interface PathwayItem {
  number: string;
  title: string;
  description: string;
  href: string;
  isDark?: boolean;
}

export interface PathwaysGridProps {
  items?: [PathwayItem, PathwayItem];
  className?: string;
}

const defaultPathways: [PathwayItem, PathwayItem] = [
  {
    number: '01 / THE CREATIVE STUDIO',
    title: 'Ideas worth talking about.',
    description: 'Brand identity, campaigns, digital experiences and content built to move your business forward.',
    href: '/services',
    isDark: false,
  },
  {
    number: '02 / THE CORPORATE STORE',
    title: 'Objects worth keeping.',
    description: 'Premium branded merchandise, thoughtful gift sets and corporate swag, made for real-world impact.',
    href: '/store',
    isDark: true,
  },
];

export function PathwaysGrid({ items = defaultPathways, className = '' }: PathwaysGridProps) {
  return (
    <div className={`pathways studio-pathways ${className}`.trim()}>
      {items.map((item, idx) => (
        <Link
          key={`pathway-${idx}`}
          href={item.href}
          className={`path tilt studio-path ${item.isDark ? 'dark' : ''} reveal-on-scroll`.trim()}
          data-aos={idx === 0 ? 'reveal-anim-left' : 'reveal-anim-right'}
          data-aos-delay={idx === 0 ? '150' : '300'}
        >
          <div>
            <span
              className="section-number"
              style={{ color: item.isDark ? 'var(--color-border-line)' : 'var(--color-brand-blue)' }}
            >
              {item.number}
            </span>
            <h3 className="display studio-path-title">{item.title}</h3>
            <p className="studio-path-desc">{item.description}</p>
          </div>
          <div className="path-art" aria-hidden="true"></div>
          <span className="round-arrow studio-round-arrow" aria-hidden="true">
            <ArrowUpRightIcon size={24} />
          </span>
        </Link>
      ))}
    </div>
  );
}
