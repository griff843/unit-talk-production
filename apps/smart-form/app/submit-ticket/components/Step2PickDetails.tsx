'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { GameSelection, Sport, SPORTS } from '../types';
import { GamesList, type Game } from './GamesList';
import { ManualEntryForm } from './ManualEntryForm';
import { SelectionsList } from './SelectionsList';
import { PlayerPropsPanel } from './PlayerPropsPanel';
import { GamePickForm } from './GamePickForm';

interface Step2PickDetailsProps {
  data: {
    sport?: Sport;
    game_date?: string;
    bet_type?: string;
    market_type?: string;
    ticket_type?: string;
    game_selections?: GameSelection[];
    notes?: string;
  };
  onUpdate: (updates: any) => void;
  onSubmit: () => void;
  onBack: () => void;
  errors?: any;
  isSubmitting?: boolean;
}

// Manual entry is always available — games mode is the default when games exist
const MANUAL_MODE_ENABLED = true;

export function Step2PickDetails({
  data,
  onUpdate,
  onSubmit,
  onBack,
  errors,
  isSubmitting,
}: Step2PickDetailsProps) {
  const [entryMode, setEntryMode] = useState<'games' | 'manual'>('games');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [notes, setNotes] = useState(data.notes || '');
  const { toast } = useToast();

  // For parlays/teasers, allow per-leg sport selection
  const isMultiLegTicket = data.ticket_type && data.ticket_type !== 'single';
  const [legSport, setLegSport] = useState<Sport>(data.sport || 'NBA');

  // Use leg-specific sport for multi-leg tickets, otherwise use ticket-level sport
  const effectiveSport = isMultiLegTicket ? legSport : data.sport;

  // Reset selected game when sport changes (for multi-leg tickets)
  useEffect(() => {
    if (isMultiLegTicket) {
      setSelectedGame(null);
    }
  }, [legSport, isMultiLegTicket]);

  const selectionCount = data.game_selections?.length || 0;

  const handleAddSelection = (newSelection: GameSelection) => {
    // Duplicate prevention: check if same game matchup + selection already exists
    const isDuplicate = (data.game_selections || []).some(
      s => s.game === newSelection.game && s.selection === newSelection.selection
    );
    if (isDuplicate) {
      toast({
        title: 'Duplicate selection',
        description: 'This pick is already in your ticket.',
        variant: 'destructive',
      });
      return;
    }

    // R-06: Single ticket enforces exactly one selection
    const updated =
      data.ticket_type === 'single'
        ? [newSelection]
        : [...(data.game_selections || []), newSelection];
    onUpdate({ game_selections: updated, notes });
  };

  const handleRemoveSelection = (id: string) => {
    const updated = (data.game_selections || []).filter(s => s.id !== id);
    onUpdate({ game_selections: updated });
  };

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game);
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    onUpdate({ notes: value });
  };

  const hasSelections = data.game_selections && data.game_selections.length > 0;

  return (
    <div className="space-y-5">
      {/* Sport selector for parlays */}
      {isMultiLegTicket && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Sport for this leg
          </label>
          <select
            value={legSport}
            onChange={e => setLegSport(e.target.value as Sport)}
            className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SPORTS.map(sport => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Dual-mode toggle */}
      {MANUAL_MODE_ENABLED && (
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            type="button"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              entryMode === 'games'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setEntryMode('games')}
          >
            Select from Games
          </button>
          <button
            type="button"
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              entryMode === 'manual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setEntryMode('manual')}
          >
            Manual Entry
          </button>
        </div>
      )}

      {/* Games Mode */}
      {entryMode === 'games' && (
        <div className="space-y-4">
          <GamesList
            sport={effectiveSport}
            gameDate={data.game_date}
            selectedGameId={selectedGame?.id}
            onSelectGame={handleGameSelect}
          />

          {/* Game-specific form based on bet type */}
          {selectedGame && data.bet_type === 'player_prop' && (
            <PlayerPropsPanel
              game={selectedGame}
              sport={effectiveSport}
              ticketType={data.ticket_type}
              existingSelections={data.game_selections || []}
              onAddSelection={handleAddSelection}
            />
          )}

          {selectedGame && data.bet_type !== 'player_prop' && (
            <GamePickForm
              game={selectedGame}
              sport={effectiveSport}
              betType={data.bet_type}
              ticketType={data.ticket_type}
              existingSelections={data.game_selections || []}
              onAddSelection={handleAddSelection}
            />
          )}

          {/* Fallback: if no games, offer manual entry */}
          {!selectedGame && MANUAL_MODE_ENABLED && (
            <p className="text-xs text-center text-muted-foreground">
              No game selected.{' '}
              <button
                type="button"
                className="text-primary underline hover:text-primary/80"
                onClick={() => setEntryMode('manual')}
              >
                Switch to Manual Entry
              </button>
            </p>
          )}
        </div>
      )}

      {/* Manual Entry Mode */}
      {entryMode === 'manual' && MANUAL_MODE_ENABLED && (
        <ManualEntryForm
          sport={effectiveSport}
          gameDate={data.game_date}
          betType={data.bet_type}
          ticketType={data.ticket_type}
          existingSelections={data.game_selections || []}
          onAddSelection={handleAddSelection}
        />
      )}

      {/* Current Selections with leg counter */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-foreground">Selections</span>
          <Badge variant="outline" className="text-xs">
            {selectionCount} selection{selectionCount !== 1 ? 's' : ''}
            {data.ticket_type === 'single' ? ' (max 1)' : ''}
          </Badge>
        </div>
        <SelectionsList selections={data.game_selections || []} onRemove={handleRemoveSelection} />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">Notes (optional)</label>
        <Textarea
          placeholder="Add any analysis or notes..."
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          rows={3}
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="px-6">
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!hasSelections || isSubmitting}
          className="px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
        </Button>
      </div>

      {errors?.game_selections && <p className="text-sm text-red-600">{errors.game_selections}</p>}
    </div>
  );
}
