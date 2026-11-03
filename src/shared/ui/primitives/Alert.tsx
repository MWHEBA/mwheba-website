import React, { type HTMLAttributes } from 'react';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
}

export function Alert({
  variant = 'info',
  title,
  children,
  className = '',
  role,
  ...props
}: AlertProps) {
  const defaultRole = variant === 'error' || variant === 'warning' ? 'alert' : 'status';
  const resolvedRole = role || defaultRole;

  const variantClass = `alert-${variant}`;
  const combinedClass = [variantClass, className].filter(Boolean).join(' ');

  return (
    <div className={combinedClass} role={resolvedRole} {...props}>
      {title && (
        <div style={{ fontWeight: 600, marginBlockEnd: '0.25rem' }}>
          {title}
        </div>
      )}
      <div style={{ fontSize: '0.9375rem', lineHeight: '1.5' }}>
        {children}
      </div>
    </div>
  );
}
