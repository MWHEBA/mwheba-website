import React, { forwardRef, useId, type SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, helperText, id, className = '', required, options, children, ...props },
  ref
) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={selectId} className="form-label">
          <span>{label}</span>
          {required && (
            <span style={{ color: 'var(--status-error)' }} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <select
        ref={ref}
        id={selectId}
        className={`form-select ${error ? 'has-error' : ''} ${className}`.trim()}
        aria-invalid={Boolean(error) ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        required={required}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>

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
