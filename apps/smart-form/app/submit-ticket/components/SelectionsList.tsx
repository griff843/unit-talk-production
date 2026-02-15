'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GameSelection, DISPLAY_LABELS } from '../types';

interface SelectionsListProps {
  selections: GameSelection[];
  onRemove: (id: string) => void;
}

// Format bet type for display
const formatBetType = (betType?: string) => {
  if (!betType) return null;
  return DISPLAY_LABELS[betType] || betType;
};

export function SelectionsList({ selections, onRemove }: SelectionsListProps) {
  if (selections.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">
        Current Selections ({selections.length})
      </h4>
      <div className="space-y-2">
        {selections.map(sel => (
          <div
            key={sel.id}
            className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-white"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm text-gray-900 flex items-center gap-1.5 flex-wrap">
                {sel.game}
                {sel.sport && (
                  <Badge variant="default" className="text-xs px-1.5 py-0 bg-blue-100 text-blue-800">{sel.sport}</Badge>
                )}
                {sel.bet_type && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">{formatBetType(sel.bet_type)}</Badge>
                )}
                {sel.source === 'manual' && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">Manual</Badge>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {sel.selection} @ {Number(sel.odds) > 0 ? '+' : ''}{sel.odds}
                {sel.line && !sel.selection.includes(sel.line) && ` (${sel.line})`}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-2 shrink-0"
              onClick={() => onRemove(sel.id!)}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
