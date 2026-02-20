'use client';

import { OddsPillProps, formatOdds } from '../types';

export function OddsPill({ odds, selected = false, onClick, size = 'md' }: OddsPillProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const isPositive = odds >= 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`
        ${sizeClasses[size]}
        font-mono font-semibold rounded-md transition-all
        ${
          selected
            ? 'bg-blue-600 text-white shadow-md'
            : onClick
              ? 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
              : 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400'
        }
        ${isPositive ? 'text-green-600' : ''}
        ${selected && isPositive ? 'text-green-200' : ''}
      `}
    >
      {formatOdds(odds)}
    </button>
  );
}
