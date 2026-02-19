'use client';

/**
 * QuickAddSuggestions - One-Click Leg Addition
 *
 * SPRINT-SMARTFORM-BETSLIP-SPORTSBOOK-MANUAL-061
 *
 * Powered by manual_inventory_for_form_v1 contract surface.
 * Shows top markets + historical line/odds for quick leg creation.
 *
 * Features:
 * - Fetches suggestions when player is selected
 * - Shows top markets by usage (most used first)
 * - One-click adds leg with pre-filled line/odds
 * - Skeleton loading states
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonField } from '@/components/ui/skeleton';
import { Zap, TrendingUp, Clock, Plus } from 'lucide-react';
import { Sport, TicketLeg, BetCategory, Direction } from '../types';
import { cn } from '@/lib/utils';

interface ManualInventorySuggestion {
  sport: string;
  player_id: string | null;
  player_name: string;
  team_abbr: string | null;
  market_key: string;
  avg_line: number | null;
  min_line: number | null;
  max_line: number | null;
  avg_odds: number | null;
  count_recent: number;
  last_seen_at: string | null;
  suggested_line: number | null;
  contract_version: string;
}

interface QuickAddSuggestionsProps {
  sport: Sport | '';
  playerName: string;
  playerId?: string;
  onQuickAdd: (leg: Omit<TicketLeg, 'id'>) => void;
  className?: string;
}

export function QuickAddSuggestions({
  sport,
  playerName,
  playerId,
  onQuickAdd,
  className,
}: QuickAddSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<ManualInventorySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch suggestions when player changes
  useEffect(() => {
    if (!sport || !playerName || playerName.length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = new URL('/api/catalog/props', window.location.origin);
        url.searchParams.set('sport', sport);
        url.searchParams.set('player_name', playerName);
        url.searchParams.set('limit', '10');

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.message || 'Failed to fetch suggestions');
        }

        // Sort by usage count (most used first)
        const sorted = (data.suggestions || []).sort(
          (a: ManualInventorySuggestion, b: ManualInventorySuggestion) =>
            (b.count_recent || 0) - (a.count_recent || 0)
        );

        setSuggestions(sorted.slice(0, 6)); // Show top 6
      } catch (err: any) {
        console.error('[QuickAdd] Failed to fetch suggestions:', err);
        setError(err.message || 'Unable to load suggestions');
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the fetch
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [sport, playerName]);

  const handleQuickAdd = useCallback(
    (suggestion: ManualInventorySuggestion, direction: Direction) => {
      const leg: Omit<TicketLeg, 'id'> = {
        sport: sport as Sport,
        bet_category: 'player_prop' as BetCategory,
        player_name: suggestion.player_name,
        prop_type: suggestion.market_key,
        line: suggestion.suggested_line?.toString() || suggestion.avg_line?.toString() || '',
        direction,
        odds: suggestion.avg_odds?.toString() || '-110',
        status: 'open',
      };
      onQuickAdd(leg);
    },
    [sport, onQuickAdd]
  );

  // Don't render if no player selected
  if (!playerName) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />
          <span>Loading quick picks...</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SkeletonField label={false} className="h-16" />
          <SkeletonField label={false} className="h-16" />
        </div>
      </div>
    );
  }

  // No suggestions available
  if (suggestions.length === 0 && !error) {
    return null; // Don't show anything if no history
  }

  // Error state
  if (error) {
    return null; // Silently fail - quick add is optional enhancement
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-gray-700">Quick Add</span>
        </div>
        <span className="text-xs text-gray-400">Based on recent picks</span>
      </div>

      {/* Suggestions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((suggestion, idx) => (
          <div
            key={`${suggestion.player_name}-${suggestion.market_key}-${idx}`}
            className={cn(
              'p-3 rounded-lg border bg-gradient-to-br from-white to-gray-50',
              'hover:border-blue-300 hover:shadow-sm transition-all duration-200',
              'animate-in fade-in-50 slide-in-from-bottom-2',
              { 'animation-delay-100': idx > 0 }
            )}
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {/* Market Header */}
            <div className="flex items-center justify-between mb-2">
              <Badge variant="secondary" className="text-xs font-medium">
                {suggestion.market_key}
              </Badge>
              {suggestion.count_recent > 1 && (
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <TrendingUp className="h-3 w-3" />
                  <span>{suggestion.count_recent}x used</span>
                </div>
              )}
            </div>

            {/* Line Info */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-lg font-semibold text-gray-900">
                {suggestion.suggested_line || suggestion.avg_line || '--'}
              </span>
              <span className="text-xs text-gray-500">line</span>
              {suggestion.avg_odds && (
                <span
                  className={cn(
                    'text-xs font-mono',
                    suggestion.avg_odds > 0 ? 'text-green-600' : 'text-gray-600'
                  )}
                >
                  ({suggestion.avg_odds > 0 ? '+' : ''}
                  {Math.round(suggestion.avg_odds)})
                </span>
              )}
            </div>

            {/* Quick Add Buttons */}
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                onClick={() => handleQuickAdd(suggestion, 'over')}
              >
                <Plus className="h-3 w-3 mr-1" />
                Over
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                onClick={() => handleQuickAdd(suggestion, 'under')}
              >
                <Plus className="h-3 w-3 mr-1" />
                Under
              </Button>
            </div>

            {/* Last Used */}
            {suggestion.last_seen_at && (
              <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
                <Clock className="h-3 w-3" />
                <span>Last: {new Date(suggestion.last_seen_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
