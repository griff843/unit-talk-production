'use client';

import { Sport, SPORTS } from '../../types';
import { SportPillsProps } from '../types';

// Priority order for display (major leagues first)
const PRIORITY_SPORTS: Sport[] = ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF'];

export function SportPills({ selected, onSelect }: SportPillsProps) {
  // Show priority sports first, then others
  const sortedSports = [...PRIORITY_SPORTS, ...SPORTS.filter(s => !PRIORITY_SPORTS.includes(s))];

  return (
    <div className="flex flex-wrap gap-2" data-testid="sport-pills">
      {sortedSports.map(sport => (
        <button
          key={sport}
          onClick={() => onSelect(sport)}
          data-testid={`sport-pill-${sport.toLowerCase()}`}
          className={`
            px-4 py-2 rounded-lg text-sm font-semibold
            transition-all duration-150 ease-in-out
            ${
              selected === sport
                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }
          `}
          aria-pressed={selected === sport}
        >
          {sport}
        </button>
      ))}
    </div>
  );
}
