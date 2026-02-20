'use client';

import { UnitsInputProps } from '../types';

export function UnitsInput({
  value,
  onChange,
  min = 0.5,
  max = 10,
  step = 0.5,
  disabled = false,
}: UnitsInputProps) {
  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      onChange(Math.min(max, Math.max(min, newValue)));
    }
  };

  return (
    <div className="flex flex-col gap-1" data-testid="units-input">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Units <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          data-testid="units-decrease"
          className={`
            w-10 h-10 flex items-center justify-center rounded-lg
            text-lg font-bold transition-colors
            ${
              disabled || value <= min
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }
          `}
          aria-label="Decrease units"
        >
          −
        </button>

        <input
          type="number"
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          data-testid="units-value"
          className={`
            w-16 h-10 text-center text-lg font-semibold rounded-lg
            border-2 border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-900
            text-gray-900 dark:text-white
            focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800
            outline-none transition-all
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          data-testid="units-increase"
          className={`
            w-10 h-10 flex items-center justify-center rounded-lg
            text-lg font-bold transition-colors
            ${
              disabled || value >= max
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }
          `}
          aria-label="Increase units"
        >
          +
        </button>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {min} - {max} units
      </span>
    </div>
  );
}
