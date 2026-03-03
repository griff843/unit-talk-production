'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { GameSelection, Sport } from '../types';
import { ManualPropCreator } from './ManualPropCreator';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ManualEntryFormProps {
  sport?: Sport;
  gameDate?: string;
  betType?: string;
  ticketType?: string;
  existingSelections: GameSelection[];
  onAddSelection: (selection: GameSelection) => void;
}

// Bet type options for per-leg selection in parlays
const LEG_BET_TYPES = [
  { value: 'spread', label: 'Point Spread' },
  { value: 'moneyline', label: 'Moneyline' },
  { value: 'total', label: 'Over/Under' },
  { value: 'team_total', label: 'Team Total' },
  { value: 'player_prop', label: 'Player Props' },
  { value: 'team_prop', label: 'Team Props' },
] as const;

// Sport-specific placeholder examples
const SPORT_PLACEHOLDERS: Record<string, { home: string; away: string }> = {
  NFL: { home: 'e.g., Chiefs', away: 'e.g., Eagles' },
  NBA: { home: 'e.g., Lakers', away: 'e.g., Celtics' },
  MLB: { home: 'e.g., Yankees', away: 'e.g., Dodgers' },
  NHL: { home: 'e.g., Bruins', away: 'e.g., Rangers' },
  NCAAB: { home: 'e.g., Duke', away: 'e.g., UNC' },
  NCAAF: { home: 'e.g., Alabama', away: 'e.g., Georgia' },
  WNBA: { home: 'e.g., Aces', away: 'e.g., Liberty' },
  Soccer: { home: 'e.g., Arsenal', away: 'e.g., Liverpool' },
};

function getPlaceholder(sport?: string, side: 'home' | 'away' = 'home'): string {
  if (!sport) return side === 'home' ? 'e.g., Home Team' : 'e.g., Away Team';
  return (
    SPORT_PLACEHOLDERS[sport]?.[side] || (side === 'home' ? 'e.g., Home Team' : 'e.g., Away Team')
  );
}

/** Player metadata keyed by player value (UUID) */
interface PlayerMeta {
  team_id: string;
  sport: string;
}

export function ManualEntryForm({
  sport,
  gameDate,
  betType,
  ticketType,
  existingSelections: _existingSelections,
  onAddSelection,
}: ManualEntryFormProps) {
  // For parlays/teasers, allow per-leg bet type selection
  const isMultiLegTicket = ticketType && ticketType !== 'single';
  const [legBetType, setLegBetType] = useState(betType || 'spread');

  // Use leg-specific bet type for multi-leg tickets, otherwise use ticket-level bet type
  const effectiveBetType = isMultiLegTicket ? legBetType : betType;

  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [homeTeamDisplay, setHomeTeamDisplay] = useState('');
  const [awayTeamDisplay, setAwayTeamDisplay] = useState('');
  const [manualGameDate, setManualGameDate] = useState(gameDate || '');
  const [selection, setSelection] = useState('');
  const [odds, setOdds] = useState('');
  const [line, setLine] = useState('');
  const [showManualPropCreator, setShowManualPropCreator] = useState(false);
  const [manualProps, setManualProps] = useState<any[]>([]);
  const [selectedProp, setSelectedProp] = useState<any>(null);
  const [propSelection, setPropSelection] = useState('');
  const [propOdds, setPropOdds] = useState('');
  const [propLine, setPropLine] = useState('');

  // Team autocomplete state
  const [teamItems, setTeamItems] = useState<ComboboxItem[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  // Player autocomplete state (for player_prop mode)
  const [playerQuery, setPlayerQuery] = useState('');
  const [playerItems, setPlayerItems] = useState<ComboboxItem[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const playerDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Player metadata map: player UUID → { team_id, sport }
  const playerMetaRef = useRef<Map<string, PlayerMeta>>(new Map());

  // Fetch teams when sport changes
  const loadTeams = useCallback(async () => {
    if (!sport) {
      setTeamItems([]);
      setTeamsError(null);
      return;
    }

    setTeamsLoading(true);
    setTeamsError(null);
    try {
      // V1.1 HARDENED: Use SPEC-TRUE /api/catalog/teams endpoint
      const res = await fetch(`/api/catalog/teams?sport=${sport}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.message || data.error);
      const items: ComboboxItem[] = (data.teams || []).map((t: any) => ({
        value: t.value || t.id,
        label: t.abbreviation ? `${t.label} (${t.abbreviation})` : t.label,
      }));
      setTeamItems(items);
    } catch (err: any) {
      console.error('Error loading teams:', err);
      setTeamsError(err.message || 'Teams unavailable — check connection');
      setTeamItems([]);
    } finally {
      setTeamsLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  // Reset team selections when sport changes
  useEffect(() => {
    setHomeTeam('');
    setAwayTeam('');
    setHomeTeamDisplay('');
    setAwayTeamDisplay('');
    setSelection('');
    setPlayerQuery('');
    setSelectedPlayer('');
    setPlayerItems([]);
    setPlayersError(null);
    setManualProps([]);
    playerMetaRef.current.clear();
  }, [sport]);

  // Player search with debounce (3-char trigger, 300ms debounce)
  const searchPlayers = useCallback(
    async (q: string) => {
      if (q.length < 3) {
        setPlayerItems([]);
        setPlayersError(null);
        return;
      }

      setPlayersLoading(true);
      setPlayersError(null);
      try {
        // V1.1 HARDENED: Use SPEC-TRUE /api/catalog/players endpoint
        let url = `/api/catalog/players?q=${encodeURIComponent(q)}&sport=${sport || ''}`;
        // Filter by selected team (canonical team_id) if one is picked
        const activeTeamId = homeTeam || awayTeam;
        if (activeTeamId) {
          url += `&team_id=${encodeURIComponent(activeTeamId)}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.message || data.error);
        // Canonical shape: { value, label, team_id, sport }
        const items: ComboboxItem[] = (data.players || []).map((p: any) => {
          // Store player metadata for forward-defaulting team
          playerMetaRef.current.set(p.value, {
            team_id: p.team_id || '',
            sport: p.sport || '',
          });
          return {
            value: p.value,
            label: p.label,
          };
        });
        setPlayerItems(items);
      } catch (err: any) {
        console.error('Error searching players:', err);
        setPlayersError(err.message || 'Player search unavailable');
        setPlayerItems([]);
      } finally {
        setPlayersLoading(false);
      }
    },
    [sport, homeTeam, awayTeam]
  );

  const handlePlayerSearch = useCallback(
    (q: string) => {
      setPlayerQuery(q);
      if (playerDebounceRef.current) clearTimeout(playerDebounceRef.current);
      playerDebounceRef.current = setTimeout(() => searchPlayers(q), 300);
    },
    [searchPlayers]
  );

  const handleHomeTeamChange = (value: string) => {
    setHomeTeam(value);
    const item = teamItems.find(t => t.value === value);
    setHomeTeamDisplay(item?.label?.replace(/ \(.*\)$/, '') || value);
  };

  const handleAwayTeamChange = (value: string) => {
    setAwayTeam(value);
    const item = teamItems.find(t => t.value === value);
    setAwayTeamDisplay(item?.label?.replace(/ \(.*\)$/, '') || value);
  };

  // Phase 5: Forward-default player → team
  const handlePlayerSelect = useCallback(
    (playerId: string) => {
      setSelectedPlayer(playerId);
      const meta = playerMetaRef.current.get(playerId);
      if (meta?.team_id) {
        // Auto-populate home team if empty
        if (!homeTeam && !awayTeam) {
          const item = teamItems.find(t => t.value === meta.team_id);
          if (item) {
            setHomeTeam(meta.team_id);
            setHomeTeamDisplay(item.label?.replace(/ \(.*\)$/, '') || meta.team_id);
          }
        }
      }
    },
    [homeTeam, awayTeam, teamItems]
  );

  const homeDisplay = homeTeamDisplay || homeTeam;
  const awayDisplay = awayTeamDisplay || awayTeam;

  const getSelectionOptions = () => {
    if (!homeDisplay || !awayDisplay || !effectiveBetType) return [];

    switch (effectiveBetType) {
      case 'spread': {
        // Format line with proper +/- prefix
        const formatLine = (l: string) => {
          if (!l) return '';
          const num = parseFloat(l);
          if (isNaN(num)) return l;
          return num > 0 ? `+${num}` : `${num}`;
        };
        const lineDisplay = formatLine(line);
        return [
          { value: 'home', label: `${homeDisplay} ${lineDisplay}`.trim() },
          { value: 'away', label: `${awayDisplay} ${lineDisplay}`.trim() },
        ];
      }
      case 'moneyline':
        return [
          { value: 'home', label: `${homeDisplay} ML` },
          { value: 'away', label: `${awayDisplay} ML` },
        ];
      case 'total':
        return [
          { value: 'over', label: `Over ${line || ''}`.trim() },
          { value: 'under', label: `Under ${line || ''}`.trim() },
        ];
      case 'team_total':
        // SMART-FORM-UX-MINIMUM-PRO-002: Team-specific over/under options
        return [
          { value: 'home_over', label: `${homeDisplay} Over ${line || ''}`.trim() },
          { value: 'home_under', label: `${homeDisplay} Under ${line || ''}`.trim() },
          { value: 'away_over', label: `${awayDisplay} Over ${line || ''}`.trim() },
          { value: 'away_under', label: `${awayDisplay} Under ${line || ''}`.trim() },
        ];
      default:
        return [
          { value: 'home', label: homeDisplay },
          { value: 'away', label: awayDisplay },
        ];
    }
  };

  const handleAdd = () => {
    if (!homeDisplay || !awayDisplay || !selection || !odds) return;

    const matchup = `${awayDisplay} @ ${homeDisplay}`;
    const selectedOption = getSelectionOptions().find(o => o.value === selection);
    const displaySelection = selectedOption?.label || selection;

    const newSelection: GameSelection = {
      id: crypto.randomUUID(),
      game_id: undefined, // Manual entries don't have a real game_id
      game: matchup,
      selection: displaySelection,
      odds,
      line: line || undefined,
      bet_type: effectiveBetType, // Per-leg bet type for parlays
      sport, // Per-leg sport for cross-sport parlays
      source: 'manual',
      team_id: homeTeam || awayTeam, // UUID from Combobox value
      manual_home_team: homeDisplay,
      manual_away_team: awayDisplay,
      manual_game_date: manualGameDate || gameDate,
    };

    onAddSelection(newSelection);
    setSelection('');
    setOdds('');
    setLine('');
  };

  const handleManualPropCreated = (prop: any) => {
    const transformedProp = {
      id: prop.id,
      player_name: prop.player_name,
      player_id: prop.player_id, // capture canonical player_id
      display_name: `${prop.player_name} ${prop.prop_type}${prop.line ? ` ${prop.line}` : ''}`,
      selection_options: prop.line
        ? [
            { value: 'over', label: `Over ${prop.line}`, odds: prop.over_odds },
            { value: 'under', label: `Under ${prop.line}`, odds: prop.under_odds },
          ]
        : [
            { value: 'over', label: 'Over', odds: prop.over_odds },
            { value: 'under', label: 'Under', odds: prop.under_odds },
          ],
      line: prop.line,
    };
    setManualProps(prev => [...prev, transformedProp]);
    setShowManualPropCreator(false);
  };

  const handlePropSelection = (propId: string, selectionType: string) => {
    const prop = manualProps.find(p => p.id === propId);
    if (!prop) return;
    const opt = prop.selection_options.find((o: any) => o.value === selectionType);
    if (!opt) return;

    setPropSelection(`${prop.display_name} - ${opt.label}`);
    setPropOdds(opt.odds.toString());
    setPropLine(prop.line ? prop.line.toString() : '');
    setSelectedProp(prop);
  };

  const handleAddPropSelection = () => {
    if (!selectedProp || !propSelection || !propOdds) return;

    // SMARTFORM-CANONICAL-FLOW-004: HARD BLOCK - player_id REQUIRED for player props
    const resolvedPlayerId = selectedPlayer || selectedProp?.player_id;
    if (!resolvedPlayerId) {
      alert(
        'Player props require selecting a player from the search. Please use the player search dropdown to select a valid player.'
      );
      return;
    }

    const matchup = `${awayDisplay} @ ${homeDisplay}`;
    const newSel: GameSelection = {
      id: crypto.randomUUID(),
      game_id: undefined, // Manual entries don't have a real game_id
      game: matchup,
      selection: propSelection,
      odds: propOdds,
      line: propLine || undefined,
      bet_type: 'player_prop', // Player props always have this bet type
      sport, // Per-leg sport for cross-sport parlays
      source: 'manual',
      team_id: homeTeam || awayTeam, // UUID from Combobox
      player_id: resolvedPlayerId, // REQUIRED - UUID from player selection
      manual_home_team: homeDisplay,
      manual_away_team: awayDisplay,
      manual_game_date: manualGameDate || gameDate,
    };
    onAddSelection(newSel);
    setPropSelection('');
    setPropOdds('');
    setPropLine('');
    setSelectedProp(null);
  };

  // Error banner component
  const ErrorBanner = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="text-red-700 hover:text-red-900 hover:bg-red-100 shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );

  // Team dropdown rendering helper — fail-closed: NO free-text <Input> fallback
  const renderTeamField = (
    label: string,
    side: 'home' | 'away',
    value: string,
    onChange: (v: string) => void
  ) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {teamsLoading ? (
        <div className="flex items-center gap-2 h-10 px-3 border border-border rounded-md bg-muted">
          <div className="animate-spin h-4 w-4 border-2 border-primary rounded-full border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading teams...</span>
        </div>
      ) : teamsError ? (
        <ErrorBanner message={teamsError} onRetry={loadTeams} />
      ) : teamItems.length > 0 ? (
        <Combobox
          items={teamItems}
          value={value}
          onValueChange={onChange}
          placeholder={getPlaceholder(sport, side)}
          searchPlaceholder="Search teams..."
          emptyText="No teams found"
          loading={teamsLoading}
        />
      ) : (
        <div className="flex items-center h-10 px-3 border border-border rounded-md bg-muted">
          <span className="text-sm text-muted-foreground">No teams found for this sport</span>
        </div>
      )}
    </div>
  );

  // Bet type selector for multi-leg tickets
  const BetTypeSelector = () =>
    isMultiLegTicket ? (
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Bet Type</label>
        <select
          value={legBetType}
          onChange={e => setLegBetType(e.target.value)}
          className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {LEG_BET_TYPES.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  // Player prop manual mode
  if (effectiveBetType === 'player_prop') {
    return (
      <div className="space-y-4 border-2 border-dashed border-primary/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Manual Player Prop</h4>
          <Badge variant="outline" className="text-xs">
            Manual
          </Badge>
        </div>

        {/* Bet type selector for parlays */}
        <BetTypeSelector />

        <div className="grid grid-cols-2 gap-3">
          {renderTeamField('Away Team', 'away', awayTeam, handleAwayTeamChange)}
          {renderTeamField('Home Team', 'home', homeTeam, handleHomeTeamChange)}
        </div>

        {/* Player search combobox */}
        {(homeDisplay || awayDisplay) && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Player</label>
            {playersError ? (
              <ErrorBanner message={playersError} />
            ) : (
              <Combobox
                items={playerItems}
                value={selectedPlayer}
                onValueChange={handlePlayerSelect}
                placeholder="Type 3+ chars to search players..."
                searchPlaceholder="Search players..."
                emptyText={
                  playerQuery.length < 3 ? 'Type at least 3 characters' : 'No players found'
                }
                loading={playersLoading}
                onSearch={handlePlayerSearch}
              />
            )}
          </div>
        )}

        {homeDisplay && awayDisplay ? (
          <>
            {!showManualPropCreator && (
              <Button variant="outline" size="sm" onClick={() => setShowManualPropCreator(true)}>
                Create Prop
              </Button>
            )}
            {showManualPropCreator && (
              <ManualPropCreator
                gameId={`manual-${Date.now()}`}
                gameMatchup={`${awayDisplay} @ ${homeDisplay}`}
                sport={sport || 'NBA'}
                onPropCreated={handleManualPropCreated}
                onCancel={() => setShowManualPropCreator(false)}
              />
            )}
            {manualProps.length > 0 && (
              <div className="space-y-2">
                {manualProps.map(prop => (
                  <div key={prop.id} className="p-3 border rounded-lg">
                    <div className="font-medium text-sm mb-2">{prop.display_name}</div>
                    <div className="flex gap-2">
                      {prop.selection_options?.map((opt: any) => (
                        <Button
                          key={opt.value}
                          variant={
                            selectedProp?.id === prop.id && propSelection.includes(opt.label)
                              ? 'default'
                              : 'outline'
                          }
                          size="sm"
                          className="flex-1"
                          onClick={() => handlePropSelection(prop.id, opt.value)}
                        >
                          {opt.label} ({opt.odds > 0 ? '+' : ''}
                          {opt.odds})
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
                {selectedProp && propSelection && (
                  <Button
                    onClick={handleAddPropSelection}
                    disabled={!propSelection || !propOdds}
                    className="w-full"
                  >
                    Add Selection
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Select both teams first</p>
        )}
      </div>
    );
  }

  // Standard manual entry for non-player-prop bet types
  return (
    <div className="space-y-4 border-2 border-dashed border-primary/30 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">Manual Entry</h4>
        <Badge variant="outline" className="text-xs">
          Manual
        </Badge>
      </div>

      {/* Bet type selector for parlays */}
      <BetTypeSelector />

      <div className="grid grid-cols-2 gap-3">
        {renderTeamField('Away Team', 'away', awayTeam, handleAwayTeamChange)}
        {renderTeamField('Home Team', 'home', homeTeam, handleHomeTeamChange)}
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Game Date</label>
        <Input
          type="date"
          value={manualGameDate}
          onChange={e => setManualGameDate(e.target.value)}
        />
      </div>

      {homeDisplay && awayDisplay && (
        <>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Selection
            </label>
            <select
              value={selection}
              onChange={e => setSelection(e.target.value)}
              className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Choose your pick</option>
              {getSelectionOptions().map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Odds</label>
              <Input
                type="number"
                placeholder="-110"
                value={odds}
                onChange={e => setOdds(e.target.value)}
              />
            </div>
            {(effectiveBetType === 'spread' ||
              effectiveBetType === 'total' ||
              effectiveBetType === 'team_total') && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Line</label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="e.g., 3.5"
                  value={line}
                  onChange={e => setLine(e.target.value)}
                />
              </div>
            )}
          </div>

          <Button onClick={handleAdd} disabled={!selection || !odds} className="w-full">
            Add Selection
          </Button>
        </>
      )}

      {(!homeDisplay || !awayDisplay) && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Select both teams to see pick options
        </p>
      )}
    </div>
  );
}
