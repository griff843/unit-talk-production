'use client';

/**
 * BetSlipPanel - Sticky Bet Slip Component
 *
 * SPRINT-SMARTFORM-BETSLIP-SPORTSBOOK-MANUAL-061
 *
 * A sportsbook-style sticky bet slip that:
 * - Shows all legs with inline edit + delete
 * - Persists across wizard steps
 * - Provides quick navigation to Review
 * - Calculates parlay odds
 */

import { useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { X, Trash2, Edit2, Check, ChevronRight, Receipt, AlertCircle } from 'lucide-react';
import { TicketLeg, Direction } from '../types';
import { cn } from '@/lib/utils';

interface BetSlipPanelProps {
  legs: TicketLeg[];
  onRemoveLeg: (legId: string) => void;
  onUpdateLeg: (legId: string, updates: Partial<TicketLeg>) => void;
  onGoToReview: () => void;
  className?: string;
}

// Calculate American odds from decimal
function americanToDecimal(american: number): number {
  if (american > 0) {
    return american / 100 + 1;
  } else {
    return 100 / Math.abs(american) + 1;
  }
}

// Calculate parlay odds
function calculateParlayOdds(legs: TicketLeg[]): number {
  if (legs.length === 0) return 0;
  if (legs.length === 1) {
    const odds = parseInt(legs[0].odds?.replace(/[^-\d]/g, '') || '-110', 10);
    return odds;
  }

  // Multiply decimal odds, then convert back to American
  let totalDecimal = 1;
  for (const leg of legs) {
    const american = parseInt(leg.odds?.replace(/[^-\d]/g, '') || '-110', 10);
    totalDecimal *= americanToDecimal(american);
  }

  // Convert back to American
  if (totalDecimal >= 2) {
    return Math.round((totalDecimal - 1) * 100);
  } else {
    return Math.round(-100 / (totalDecimal - 1));
  }
}

// Format odds for display
function formatOdds(odds: number): string {
  return odds >= 0 ? `+${odds}` : `${odds}`;
}

// Build selection string for display
function buildSelectionString(leg: TicketLeg): string {
  if (leg.bet_category === 'player_prop') {
    return `${leg.player_name} ${leg.direction || 'over'} ${leg.line || '0'} ${leg.prop_type || 'PTS'}`;
  }
  if (leg.bet_category === 'spread') {
    const lineValue = parseFloat(leg.line || '0');
    return `${leg.team} ${lineValue >= 0 ? '+' : ''}${lineValue}`;
  }
  if (leg.bet_category === 'total') {
    return `${leg.direction || 'over'} ${leg.line || '0'}`;
  }
  if (leg.bet_category === 'moneyline') {
    return leg.team || 'Team';
  }
  return leg.team || leg.player_name || 'Selection';
}

interface LegItemProps {
  leg: TicketLeg;
  onRemove: () => void;
  onUpdate: (updates: Partial<TicketLeg>) => void;
}

function LegItem({ leg, onRemove, onUpdate }: LegItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLine, setEditLine] = useState(leg.line || '');
  const [editOdds, setEditOdds] = useState(leg.odds || '-110');

  const handleSave = useCallback(() => {
    onUpdate({
      line: editLine,
      odds: editOdds,
    });
    setIsEditing(false);
  }, [editLine, editOdds, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditLine(leg.line || '');
    setEditOdds(leg.odds || '-110');
    setIsEditing(false);
  }, [leg]);

  return (
    <div
      className={cn(
        'group p-3 rounded-lg border transition-all duration-200',
        'bg-white hover:bg-gray-50',
        'animate-in slide-in-from-right-2 fade-in-50'
      )}
    >
      {isEditing ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase">{leg.sport}</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleSave}
                aria-label="Save leg edits"
              >
                <Check className="h-3 w-3 text-green-600" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCancel}
                aria-label="Cancel leg edits"
              >
                <X className="h-3 w-3 text-gray-400" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <p className="text-sm font-medium truncate">{leg.player_name || leg.team}</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor={`edit-line-${leg.id}`} className="text-xs text-gray-500">
                Line
              </label>
              <Input
                id={`edit-line-${leg.id}`}
                type="number"
                step="0.5"
                value={editLine}
                onChange={e => setEditLine(e.target.value)}
                className="h-8 text-sm"
                placeholder="24.5"
              />
            </div>
            <div className="flex-1">
              <label htmlFor={`edit-odds-${leg.id}`} className="text-xs text-gray-500">
                Odds
              </label>
              <Input
                id={`edit-odds-${leg.id}`}
                value={editOdds}
                onChange={e => setEditOdds(e.target.value)}
                className="h-8 text-sm"
                placeholder="-110"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {leg.sport}
              </Badge>
              <span className="text-[10px] text-gray-400">
                {leg.bet_category?.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900 truncate">
              {buildSelectionString(leg)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {leg.odds && (
                <span
                  className={cn(
                    'font-mono',
                    parseInt(leg.odds) > 0 ? 'text-green-600' : 'text-gray-600'
                  )}
                >
                  {parseInt(leg.odds) > 0 ? '+' : ''}
                  {leg.odds}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-blue-600"
              onClick={() => setIsEditing(true)}
              aria-label={`Edit ${buildSelectionString(leg)}`}
            >
              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-400 hover:text-red-600"
              onClick={onRemove}
              aria-label={`Remove ${buildSelectionString(leg)}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BetSlipPanel({
  legs,
  onRemoveLeg,
  onUpdateLeg,
  onGoToReview,
  className,
}: BetSlipPanelProps) {
  const parlayOdds = calculateParlayOdds(legs);
  const isParlay = legs.length > 1;

  return (
    <Card className={cn('flex flex-col bg-slate-900 border-slate-700 overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-slate-400" />
            <h3 className="font-semibold text-white text-sm">Bet Slip</h3>
          </div>
          <Badge
            variant={legs.length > 0 ? 'default' : 'secondary'}
            className={cn('text-xs', legs.length > 0 && 'bg-green-600 hover:bg-green-600')}
          >
            {legs.length} {legs.length === 1 ? 'Leg' : 'Legs'}
          </Badge>
        </div>
      </div>

      {/* Legs List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px] max-h-[400px]">
        {legs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
              <Receipt className="h-6 w-6 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 mb-1">No legs added yet</p>
            <p className="text-xs text-slate-500">Complete the form to add your first leg</p>
          </div>
        ) : (
          legs.map(leg => (
            <LegItem
              key={leg.id}
              leg={leg}
              onRemove={() => onRemoveLeg(leg.id)}
              onUpdate={updates => onUpdateLeg(leg.id, updates)}
            />
          ))
        )}
      </div>

      {/* Footer - Summary & Actions */}
      {legs.length > 0 && (
        <div className="border-t border-slate-700 bg-slate-800 p-3 space-y-3">
          {/* Parlay Odds Summary */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">{isParlay ? 'Parlay Odds' : 'Odds'}</span>
            <span
              className={cn(
                'font-mono font-semibold',
                parlayOdds > 0 ? 'text-green-400' : 'text-white'
              )}
            >
              {formatOdds(parlayOdds)}
            </span>
          </div>

          {/* Potential Payout Example */}
          {isParlay && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">$10 wins</span>
              <span className="text-slate-300">
                $
                {(10 * (parlayOdds > 0 ? parlayOdds / 100 : 100 / Math.abs(parlayOdds))).toFixed(2)}
              </span>
            </div>
          )}

          {/* Review Button */}
          <Button
            onClick={onGoToReview}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            Review & Submit
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </Card>
  );
}
