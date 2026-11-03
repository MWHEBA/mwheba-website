import React, { type HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'article' | 'section';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { as: Component = 'div', className = '', children, ...props },
  ref
) {
  return (
    <Component ref={ref} className={`card ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
});

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardHeader(
  { className = '', children, ...props },
  ref
) {
  return (
    <div ref={ref} className={`card-header ${className}`.trim()} {...props}>
      {children}
    </div>
  );
});

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'h4' }>(
  function CardTitle({ as: Heading = 'h3', className = '', children, ...props }, ref) {
    return (
      <Heading ref={ref as any} className={`card-title ${className}`.trim()} {...props}>
        {children}
      </Heading>
    );
  }
);

export const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardBody(
  { className = '', children, ...props },
  ref
) {
  return (
    <div ref={ref} className={`card-body ${className}`.trim()} {...props}>
      {children}
    </div>
  );
});

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardFooter(
  { className = '', children, ...props },
  ref
) {
  return (
    <div ref={ref} className={`card-footer ${className}`.trim()} {...props}>
      {children}
    </div>
  );
});
