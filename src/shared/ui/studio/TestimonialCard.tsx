import React from 'react';

export interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  company: string;
  rating?: number;
  avatarUrl?: string;
  verifiedLabel?: string;
  className?: string;
}

export function TestimonialCard({
  quote,
  author,
  role,
  company,
  rating = 5,
  avatarUrl,
  verifiedLabel = 'Verified Corporate Client',
  className = '',
}: TestimonialCardProps) {
  const initials = author
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <article className={`testimonial-card ${className}`.trim()}>
      {/* 5-Star Rating Header */}
      <div className="testimonial-rating" aria-label={`Rating: ${rating} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, idx) => (
          <svg
            key={idx}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={idx < rating ? 'var(--color-brand-red)' : 'var(--color-border-line)'}
            stroke="none"
            aria-hidden="true"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}

        {verifiedLabel && (
          <span className="testimonial-verified-badge">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{verifiedLabel}</span>
          </span>
        )}
      </div>

      {/* Quote Body */}
      <blockquote className="testimonial-quote">
        <p>&ldquo;{quote}&rdquo;</p>
      </blockquote>

      {/* Author & Enterprise Info Footer */}
      <footer className="testimonial-author-meta">
        <div className="testimonial-avatar" aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={author} loading="lazy" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="testimonial-author-info">
          <cite className="testimonial-author-name">{author}</cite>
          <span className="testimonial-author-role">
            {role} · <strong className="testimonial-company">{company}</strong>
          </span>
        </div>
      </footer>
    </article>
  );
}
