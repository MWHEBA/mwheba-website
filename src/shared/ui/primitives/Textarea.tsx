import React, { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, helperText, id, className = '', required, rows = 4, ...props },
  ref
) {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const errorId = `${textareaId}-error`;
  const helperId = `${textareaId}-helper`;

  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={textareaId} className="form-label">
          <span>{label}</span>
          {required && (
            <span style={{ color: 'var(--status-error)' }} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={`form-textarea ${error ? 'has-error' : ''} ${className}`.trim()}
        aria-invalid={Boolean(error) ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        required={required}
        {...props}
      />

      {error ? (
        <p id={errorId} className="form-error" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p id={helperId} className="form-helper">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
