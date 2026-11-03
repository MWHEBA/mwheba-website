'use client';

import React, { useState, useEffect, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';

export interface QuantityStepperProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  ariaLabel?: string;
  decrementLabel?: string;
  incrementLabel?: string;
}

export function QuantityStepper({
  value,
  defaultValue = 1,
  min = 1,
  max = 99999,
  step = 1,
  onChange,
  disabled = false,
  name,
  id,
  ariaLabel = 'Quantity',
  decrementLabel = 'Decrease quantity',
  incrementLabel = 'Increase quantity',
}: QuantityStepperProps) {
  const isControlled = value !== undefined;
  const initialValue = isControlled ? value : defaultValue;
  const clampedInitial = Math.min(Math.max(initialValue, min), max);

  const [internalValue, setInternalValue] = useState<number>(clampedInitial);
  const [displayString, setDisplayString] = useState<string>(String(clampedInitial));

  useEffect(() => {
    if (isControlled && value !== undefined) {
      const clamped = Math.min(Math.max(value, min), max);
      setInternalValue(clamped);
      setDisplayString(String(clamped));
    }
  }, [value, isControlled, min, max]);

  const commitValue = (nextVal: number) => {
    const clamped = Math.min(Math.max(nextVal, min), max);
    if (!isControlled) {
      setInternalValue(clamped);
    }
    setDisplayString(String(clamped));
    onChange?.(clamped);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Allow user to temporarily clear the input to type a new value
    if (raw === '') {
      setDisplayString('');
      return;
    }

    // Only allow whole digits
    const cleaned = raw.replace(/[^\d]/g, '');
    if (cleaned === '') {
      setDisplayString('');
      return;
    }

    const parsed = parseInt(cleaned, 10);
    if (isNaN(parsed)) {
      return;
    }

    // While typing, keep what they typed but notify if valid
    setDisplayString(String(parsed));
    if (parsed >= min && parsed <= max) {
      if (!isControlled) setInternalValue(parsed);
      onChange?.(parsed);
    }
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (displayString === '') {
      commitValue(min);
      return;
    }

    const parsed = parseInt(displayString, 10);
    if (isNaN(parsed) || parsed < min) {
      commitValue(min);
    } else if (parsed > max) {
      commitValue(max);
    } else {
      commitValue(parsed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDecrement();
    } else if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleDecrement = () => {
    if (disabled) return;
    const current = displayString === '' ? min : parseInt(displayString, 10) || min;
    const nextVal = Math.max(current - step, min);
    commitValue(nextVal);
  };

  const handleIncrement = () => {
    if (disabled) return;
    const current = displayString === '' ? min : parseInt(displayString, 10) || min;
    const nextVal = Math.min(current + step, max);
    commitValue(nextVal);
  };

  const currentNumeric = displayString === '' ? min : parseInt(displayString, 10) || min;
  const isDecrementDisabled = disabled || currentNumeric <= min;
  const isIncrementDisabled = disabled || currentNumeric >= max;

  return (
    <div className="stepper" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="stepper-btn"
        onClick={handleDecrement}
        disabled={isDecrementDisabled}
        aria-label={decrementLabel}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        id={id}
        name={name}
        className="stepper-input"
        value={displayString}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuenow={currentNumeric}
        aria-valuemin={min}
        aria-valuemax={max}
        role="spinbutton"
      />

      <button
        type="button"
        className="stepper-btn"
        onClick={handleIncrement}
        disabled={isIncrementDisabled}
        aria-label={incrementLabel}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
