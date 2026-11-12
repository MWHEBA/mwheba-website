import React, { type ReactNode } from 'react';

export interface EyebrowProps {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'div' | 'p';
}

export function Eyebrow({ children, className = '', as: Component = 'span' }: EyebrowProps) {
  return (
    <Component className={`studio-eyebrow ${className}`.trim()}>
      {children}
    </Component>
  );
}
