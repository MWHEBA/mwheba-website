import React, { forwardRef, useId, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, id, className = '', required, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label">
          <span>{label}</span>
          {required && (
            <span style={{ color: 'var(--status-error)' }} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <input
        ref={ref}
        id={inputId}
        className={`form-input ${error ? 'has-error' : ''} ${className}`.trim()}
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
