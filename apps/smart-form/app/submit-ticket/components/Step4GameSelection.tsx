'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GameSelection, Sport } from '../types';
import { ManualPropCreator } from './ManualPropCreator';
// Removed direct database import - using API endpoint instead

// NEW: Enhanced interfaces for optimized database structure
interface EnhancedProp {
  id: string;
  player_name: string;
  stat_type: string;
  line: number;
  odds: number;
  confidence: number; // NEW: ML confidence professional_score (0-1)
  expected_value: number; // NEW: Expected value calculation
  sport: string; // NEW: Sport classification
  game_info?: {
    // NEW: Game context from foreign key
    home_team: string;
    away_team: string;
    game_date: string;
    status: string;
    game_time?: string;
  };
  display_name: string;
  selection_options: Array<{
    value: string;
    label: string;
    odds: number;
    confidence: number; // NEW: Option-specific confidence
    expected_value: number; // NEW: Option-specific expected value
  }>;
}

// Component to display game time in user's local timezone
function LocalGameTime({
  utcTimestamp,
  fallbackTime,
}: {
  utcTimestamp?: number;
  fallbackTime?: string;
}) {
  const [localTime, setLocalTime] = useState<string>('');
  const [userTimezone, setUserTimezone] = useState<string>('');

  useEffect(() => {
    if (utcTimestamp) {
      const gameDate = new Date(utcTimestamp);
      const timeString = gameDate.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      });
      setLocalTime(timeString);

      // Extract timezone abbreviation for display
      const timezoneParts = timeString.split(' ');
      const tzAbbr = timezoneParts[timezoneParts.length - 1];
      setUserTimezone(tzAbbr);
    } else if (fallbackTime) {
      setLocalTime(fallbackTime);
    }
  }, [utcTimestamp, fallbackTime]);

  return (
    <span
      className="text-sm text-muted-foreground"
      title={`Game time in your local timezone (${userTimezone})`}
    >
      {localTime || fallbackTime || 'TBD'}
    </span>
  );
}

interface Step4GameSelectionProps {
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

// PRODUCTION MODE: No mock data - real database only

export function Step4GameSelection({
  data,
  onUpdate,
  onSubmit,
  onBack,
  errors,
  isSubmitting,
}: Step4GameSelectionProps) {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [selection, setSelection] = useState('');
  const [odds, setOdds] = useState('');
  const [line, setLine] = useState('');
  const [notes, setNotes] = useState(data.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [props, setProps] = useState<any[]>([]);
  const [loadingProps, setLoadingProps] = useState(false);
  const [selectedProp, setSelectedProp] = useState<any>(null);
  const [showManualPropCreator, setShowManualPropCreator] = useState(false);
  const [manualProps, setManualProps] = useState<any[]>([]);

  // Load games from database or use mock data
  useEffect(() => {
    const loadGames = async () => {
      if (!data.sport || !data.game_date) {
        setGames([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        console.log(`🔍 Loading ${data.sport} games for ${data.game_date}...`);

        // Use the API client to fetch games
        const { apiClient } = await import('@/lib/api-client');
        const realGames = await apiClient.fetchGames(data.sport);

        if (realGames && realGames.length > 0) {
          console.log(`✅ Found ${realGames.length} real games`);

          // Format database games using our improved data structure
          const formattedGames = realGames.map((game: any, index) => ({
            id: game.id || `${data.sport?.toLowerCase()}-game-${index + 1}`,
            homeTeam: game.home_team_name || game.homeTeam || 'Home Team',
            awayTeam: game.away_team_name || game.awayTeam || 'Away Team',
            homeTeamShort: game.home_team_short || 'HOME',
            awayTeamShort: game.away_team_short || 'AWAY',
            matchup:
              game.matchup ||
              `${game.away_team_name || game.awayTeam || 'Away'} @ ${game.home_team_name || game.homeTeam || 'Home'}`,
            sport: data.sport,
            spread: {
              home: game.spread_clean || game.spread?.home,
              away: game.spread_clean ? -game.spread_clean : game.spread?.away,
              // SMARTFORM-ODDS-FIELD-INTEGRITY-007: No silent -110 fallback, use null for missing odds
              odds: game.spread_odds_clean || game.spread?.odds || null,
            },
            total: game.total_clean || game.total,
            moneyline: {
              home: game.moneyline_home_clean || game.moneyline?.home,
              away: game.moneyline_away_clean || game.moneyline?.away,
            },
            time: game.display_time || game.game_time_local || 'TBD',
            formatted_time: game.formatted_time || 'TBD',
            utc_timestamp: game.utc_timestamp,
            has_moneyline: game.has_moneyline,
            has_spread: game.has_spread,
            has_total: game.has_total,
            is_live: game.is_live || false,
            live_status: game.live_status || 'PREGAME',
            insights: [
              game.is_live ? `🔴 LIVE ${data.sport} game` : `📅 Pregame ${data.sport}`,
              `📊 Real sportsbook data`,
              `⏰ Times in your local timezone`,
              ...(game.is_live ? ['⚡ Live betting enabled'] : []),
            ],
          }));

          setGames(formattedGames);
        } else {
          console.log('❌ No games found in database');
          setGames([]);
          setError('No games available for this date. Please contact support.');
        }
      } catch (error) {
        console.error('❌ Error loading games:', error);
        setError('Failed to load games from database. Please check your connection.');
        setGames([]);
      } finally {
        setLoading(false);
      }
    };

    loadGames();
  }, [data.sport, data.game_date]);

  // Load props for selected game when bet_type is player_prop
  const loadProps = async (gameId: string) => {
    if (data.bet_type !== 'player_prop') return;

    setLoadingProps(true);
    setError(null);

    try {
      console.log(`🔍 Loading props for game ${gameId}...`);

      // Fetch props from our API endpoint
      const response = await fetch(
        `/api/props?game_id=${gameId}&sport=${data.sport}&prop_type=player_props`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.props && result.props.length > 0) {
        console.log(
          `✅ Found ${result.props.length} props for game ${gameId} (source: ${result.source})`
        );
        setProps(result.props);
        setError(null);
      } else {
        console.log('⚠️ No props found for this game');
        setProps([]);
        // Don't set error here - this is normal for games without props
      }
    } catch (error) {
      console.error('❌ Error loading props:', error);
      setError('Failed to load player props. Please try again.');
      setProps([]);
    } finally {
      setLoadingProps(false);
    }
  };

  const handleGameSelect = (gameId: string) => {
    const game = games.find(g => g.id === gameId);
    setSelectedGame(game);

    // Reset selection fields when game changes
    setSelection('');
    setOdds('');
    setLine('');
    setSelectedProp(null);
    setProps([]);
    setShowManualPropCreator(false);

    // Load props if bet type is player_prop
    if (data.bet_type === 'player_prop') {
      loadProps(gameId);
    }
  };

  // Handle manual prop creation
  const handleManualPropCreated = (prop: any) => {
    // Transform manual prop to match our expected format
    const transformedProp = {
      id: prop.id,
      game_id: selectedGame?.id,
      player_name: prop.player_name,
      team: prop.team,
      prop_type: prop.prop_type,
      market_type: 'player_props',
      line: prop.line,
      over_odds: prop.over_odds,
      under_odds: prop.under_odds,
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
    };

    // Add to manual props list and combined props
    setManualProps(prev => [...prev, transformedProp]);
    setProps(prev => [...prev, transformedProp]);
    setShowManualPropCreator(false);
  };

  // Auto-populate odds and line when selection changes
  const handleSelectionChange = (value: string) => {
    setSelection(value);

    if (selectedGame && data.bet_type) {
      // Auto-populate odds and line based on selection with null safety
      switch (data.bet_type) {
        case 'spread':
          setOdds(selectedGame.spread?.odds?.toString() || '-110');
          if (value === 'home') {
            setLine(selectedGame.spread?.home?.toString() || '0');
          } else if (value === 'away') {
            setLine(selectedGame.spread?.away?.toString() || '0');
          }
          break;
        case 'moneyline':
          if (value === 'home') {
            setOdds(selectedGame.moneyline?.home?.toString() || '-110');
          } else if (value === 'away') {
            setOdds(selectedGame.moneyline?.away?.toString() || '+110');
          }
          setLine(''); // No line for moneyline
          break;
        case 'total':
          setOdds('-110'); // Standard total odds
          setLine(selectedGame.total?.toString() || '50');
          break;
        case 'player_prop': {
          // Find the selected prop and get its details
          const prop = props.find(p => p.id === value);
          if (prop && prop.selection_options) {
            setSelectedProp(prop);
            // Don't auto-populate odds yet - let user choose over/under
            setOdds('');
            setLine(prop.line ? prop.line.toString() : '');
          }
          break;
        }
      }
    }
  };

  // Handle prop selection (over/under or yes/no)
  const handlePropSelectionChange = (propId: string, selectionType: string) => {
    const prop = props.find(p => p.id === propId);
    if (prop && prop.selection_options) {
      const selectedOption = prop.selection_options.find((opt: any) => opt.value === selectionType);
      if (selectedOption) {
        console.log(
          `🎯 Selected prop: ${prop.display_name} - ${selectedOption.label} (${selectedOption.odds})`
        );
        setSelection(`${prop.display_name} - ${selectedOption.label}`);
        setOdds(selectedOption.odds.toString());
        setLine(prop.line ? prop.line.toString() : '');
        setSelectedProp(prop);
      }
    }
  };

  const handleAddSelection = () => {
    if (!selectedGame || !selection || !odds) {
      return;
    }

    const newSelection: GameSelection = {
      id: crypto.randomUUID(),
      game_id: selectedGame.id,
      game: selectedGame.matchup || `${selectedGame.awayTeam} @ ${selectedGame.homeTeam}`,
      selection: selection,
      odds: odds,
      line: line,
    };

    // R-06: Single ticket enforces exactly one selection (replace, don't append)
    const updatedSelections =
      data.ticket_type === 'single'
        ? [newSelection]
        : [...(data.game_selections || []), newSelection];
    onUpdate({ game_selections: updatedSelections, notes });

    // Reset form
    setSelectedGame(null);
    setSelection('');
    setOdds('');
    setLine('');
  };

  const handleRemoveSelection = (id: string) => {
    const updatedSelections = (data.game_selections || []).filter(s => s.id !== id);
    onUpdate({ game_selections: updatedSelections });
  };

  const getAvailableSelections = () => {
    if (!selectedGame || !data.bet_type) return [];

    const selections = [];

    switch (data.bet_type) {
      case 'spread':
        selections.push(
          {
            value: 'home',
            label: `${selectedGame.homeTeam} ${selectedGame.spread.home > 0 ? '+' : ''}${selectedGame.spread.home}`,
          },
          {
            value: 'away',
            label: `${selectedGame.awayTeam} ${selectedGame.spread.away > 0 ? '+' : ''}${selectedGame.spread.away}`,
          }
        );
        break;
      case 'moneyline':
        selections.push(
          { value: 'home', label: `${selectedGame.homeTeam} ML` },
          { value: 'away', label: `${selectedGame.awayTeam} ML` }
        );
        break;
      case 'total':
        selections.push(
          { value: 'over', label: `Over ${selectedGame.total}` },
          { value: 'under', label: `Under ${selectedGame.total}` }
        );
        break;
      case 'team_total':
        selections.push(
          {
            value: 'home_over',
            label: `${selectedGame.homeTeam} Over ${Math.round(selectedGame.total / 2)}`,
          },
          {
            value: 'home_under',
            label: `${selectedGame.homeTeam} Under ${Math.round(selectedGame.total / 2)}`,
          },
          {
            value: 'away_over',
            label: `${selectedGame.awayTeam} Over ${Math.round(selectedGame.total / 2)}`,
          },
          {
            value: 'away_under',
            label: `${selectedGame.awayTeam} Under ${Math.round(selectedGame.total / 2)}`,
          }
        );
        break;
      case 'player_prop':
        // For player props, we show the available props as options
        return props.map(prop => ({
          value: prop.id,
          label: prop.display_name,
        }));
    }

    return selections;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Game Selection</h2>
        <p className="text-muted-foreground">
          Select games and make your picks for {data.sport} on {data.game_date}
        </p>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">{error}</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading games...</p>
        </div>
      )}

      {!loading && games.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No games found</p>
          <p className="text-sm text-muted-foreground">Try selecting a different date or sport</p>
        </div>
      )}

      {!loading && games.length > 0 && (
        <>
          {/* Game Selection */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Available Games</h3>
              <span className="text-xs text-muted-foreground">
                Times shown in your local timezone
              </span>
            </div>
            <div className="space-y-3">
              {games.map(game => (
                <div
                  key={game.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedGame?.id === game.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => handleGameSelect(game.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">
                        {game.awayTeam} @ {game.homeTeam}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <LocalGameTime utcTimestamp={game.utc_timestamp} fallbackTime={game.time} />{' '}
                        • {game.sport}
                        {game.is_live && (
                          <span className="text-red-600 font-semibold animate-pulse">🔴 LIVE</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline">{game.sport}</Badge>
                      {game.is_live && (
                        <Badge variant="destructive" className="text-xs animate-pulse">
                          LIVE
                        </Badge>
                      )}
                    </div>
                  </div>

                  {game.insights && game.insights.length > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {game.insights.map((insight: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {insight}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Player Props Loading */}
          {selectedGame && data.bet_type === 'player_prop' && loadingProps && (
            <Card className="p-6">
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading player props...</p>
              </div>
            </Card>
          )}

          {/* No Props Found - Show Manual Creator Option */}
          {selectedGame &&
            data.bet_type === 'player_prop' &&
            !loadingProps &&
            props.length === 0 &&
            !showManualPropCreator && (
              <Card className="p-6">
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-2">
                    No player props available for this game
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Props may be added closer to game time
                  </p>
                  <Button
                    onClick={() => setShowManualPropCreator(true)}
                    variant="outline"
                    className="mt-2"
                  >
                    Create Custom Prop
                  </Button>
                </div>
              </Card>
            )}

          {/* Manual Prop Creator */}
          {selectedGame && data.bet_type === 'player_prop' && showManualPropCreator && (
            <ManualPropCreator
              gameId={selectedGame.id}
              gameMatchup={
                selectedGame.matchup || `${selectedGame.awayTeam} @ ${selectedGame.homeTeam}`
              }
              sport={data.sport || 'MLB'}
              onPropCreated={handleManualPropCreated}
              onCancel={() => setShowManualPropCreator(false)}
            />
          )}

          {/* Player Props Selection */}
          {selectedGame &&
            data.bet_type === 'player_prop' &&
            !loadingProps &&
            props.length > 0 &&
            !showManualPropCreator && (
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Player Props: {selectedGame.awayTeam} @ {selectedGame.homeTeam}
                  </h3>
                  <Button
                    onClick={() => setShowManualPropCreator(true)}
                    variant="outline"
                    size="sm"
                  >
                    Add Custom Prop
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* ENHANCED: Props List with Confidence and Expected Value */}
                  <div className="space-y-3">
                    {props.map(prop => (
                      <div key={prop.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">{prop.display_name}</div>

                          {/* NEW: Show confidence and expected value badges */}
                          <div className="flex gap-2">
                            {prop.confidence > 0 && (
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  prop.confidence >= 0.7
                                    ? 'bg-green-100 text-green-800'
                                    : prop.confidence >= 0.5
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {(prop.confidence * 100).toFixed(1)}% Confidence
                              </span>
                            )}
                            {prop.expected_value !== undefined && prop.expected_value !== 0 && (
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  prop.expected_value > 0
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                EV: {prop.expected_value > 0 ? '+' : ''}
                                {prop.expected_value.toFixed(3)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* NEW: Show game context if available */}
                        {prop.game_info && (
                          <div className="text-sm text-gray-600 mb-2">
                            {prop.game_info.away_team} @ {prop.game_info.home_team}
                            {prop.game_info.game_date && (
                              <span className="ml-2">
                                {new Date(prop.game_info.game_date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}

                        {/* ENHANCED: Selection options with confidence indicators */}
                        <div className="flex gap-2">
                          {prop.selection_options?.map((option: any) => (
                            <Button
                              key={option.value}
                              variant={
                                selectedProp?.id === prop.id && selection.includes(option.label)
                                  ? 'default'
                                  : 'outline'
                              }
                              size="sm"
                              onClick={() => handlePropSelectionChange(prop.id, option.value)}
                              className="flex-1 relative"
                            >
                              <div className="flex flex-col items-center">
                                <span>
                                  {option.label} ({option.odds > 0 ? '+' : ''}
                                  {option.odds})
                                </span>
                                {/* NEW: Show confidence for this specific option */}
                                {option.confidence > 0 && (
                                  <span className="text-xs opacity-75">
                                    {(option.confidence * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Selection Button for Player Props */}
                  {selectedProp && selection && (
                    <Button
                      onClick={handleAddSelection}
                      disabled={!selection || !odds}
                      className="w-full"
                    >
                      Add Selection
                    </Button>
                  )}
                </div>
              </Card>
            )}

          {/* Standard Selection Form (non-player-prop) */}
          {selectedGame && data.bet_type !== 'player_prop' && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Make Your Pick: {selectedGame.awayTeam} @ {selectedGame.homeTeam}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Selection</label>
                  <Select value={selection} onValueChange={handleSelectionChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your pick" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableSelections().map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Odds</label>
                    <Input
                      type="number"
                      placeholder="-110"
                      value={odds}
                      onChange={e => setOdds(e.target.value)}
                    />
                  </div>

                  {(data.bet_type === 'spread' ||
                    data.bet_type === 'total' ||
                    data.bet_type === 'team_total' ||
                    data.bet_type === 'player_prop') && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Line</label>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="8.5"
                        value={line}
                        onChange={e => setLine(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleAddSelection}
                  disabled={!selection || !odds}
                  className="w-full"
                >
                  Add Selection
                </Button>
              </div>
            </Card>
          )}

          {/* Current Selections */}
          {data.game_selections && data.game_selections.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Current Selections</h3>
              <div className="space-y-3">
                {data.game_selections.map(selection => (
                  <div
                    key={selection.id}
                    className="flex justify-between items-center p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{selection.game}</div>
                      <div className="text-sm text-muted-foreground">
                        {selection.selection} @ {Number(selection.odds) > 0 ? '+' : ''}
                        {selection.odds}
                        {selection.line && ` (${selection.line})`}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSelection(selection.id!)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Notes */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
            <Textarea
              placeholder="Add any additional analysis or notes..."
              value={notes}
              onChange={e => {
                setNotes(e.target.value);
                onUpdate({ notes: e.target.value });
              }}
              rows={4}
            />
          </Card>
        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!data.game_selections || data.game_selections.length === 0 || isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
        </Button>
      </div>

      {errors?.game_selections && (
        <p className="text-sm text-destructive">{errors.game_selections}</p>
      )}
    </div>
  );
}
