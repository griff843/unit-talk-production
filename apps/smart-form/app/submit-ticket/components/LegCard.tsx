'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TicketLeg,
  MARKET_TYPES,
  BET_CATEGORIES,
  DIRECTIONS,
} from '../types';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { SmartSearch } from '@/components/ui/smart-search';

interface LegCardProps {
  leg: TicketLeg;
  onRemove: () => void;
  onUpdate?: (updates: Partial<TicketLeg> & { manual_home_team?: string; manual_away_team?: string; source?: 'api' | 'manual' }) => void;
  legIndex: number;
}

interface Team {
  id: string;
  name: string;
  sport: string;
  abbr?: string;
  team_uuid?: string;
}

/**
 * V1.1 HARDENED: LegCard Component
 *
 * SPEC-TRUE ENDPOINTS ONLY:
 * - Teams: GET /api/catalog/teams
 * - Players: GET /api/catalog/players
 * - Stat Types: GET /api/registry/stat-types
 * - Normalization: POST /api/normalize
 *
 * Per Section 5 - Manual Mode V1.1:
 * - Free-text fields for manual_home_team, manual_away_team
 * - Team text must normalize (via /api/normalize)
 * - Player must match team, team must match sport
 */
export function LegCard({ leg, onRemove, onUpdate, legIndex }: LegCardProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [statTypes, setStatTypes] = useState<string[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualTeam, setManualTeam] = useState('');
  const [manualPlayer, setManualPlayer] = useState('');
  const [normalizing, setNormalizing] = useState(false);
  const [loading, setLoading] = useState({
    teams: false,
    games: false,
    statTypes: false,
  });
  const { toast } = useToast();

  // Get teams from selected game for spread/total
  const selectedGame = games.find(g => g.id === leg.game_id);
  const gameTeams = selectedGame
    ? [
        { value: selectedGame.home_team, label: `${selectedGame.home_team} (Home)` },
        { value: selectedGame.away_team, label: `${selectedGame.away_team} (Away)` },
      ]
    : [];

  // Extract team names for player filtering
  const gameTeamNames = selectedGame
    ? [selectedGame.home_team, selectedGame.away_team].filter(Boolean)
    : [];

  const handleChange = useCallback((field: keyof TicketLeg | 'manual_home_team' | 'manual_away_team' | 'source', value: any) => {
    if (onUpdate) {
      if (field === 'sport') {
        // V1.1 COMPLIANCE: Reset all downstream fields when sport changes
        onUpdate({
          sport: value,
          market_type: undefined,
          bet_type: undefined,
          bet_category: undefined,
          team: '',
          opponent: '',
          player_name: '',
          prop_type: '',
          line: '',
          odds: '',
          direction: undefined,
          game_id: undefined,
        });
        // Fetch new data for the selected sport
        fetchGamesForSport(value);
        fetchTeamsForSport(value);
        // Note: stat types fetched in useEffect when bet_category is player_prop
      } else if (field === 'bet_category') {
        // V1.1 COMPLIANCE: Reset fields when bet category changes
        onUpdate({
          bet_category: value,
          team: '',
          player_name: '',
          prop_type: '',
          line: '',
          odds: '',
          direction: undefined,
        });
      } else {
        onUpdate({ [field]: value });
      }
    }
  }, [onUpdate]);

  // V1.1 COMPLIANCE: Fetch games from DB (no fallback to mock)
  const fetchGamesForSport = async (sport: string) => {
    try {
      setLoading(prev => ({ ...prev, games: true }));
      const data = await apiClient.fetchGames(sport);
      setGames(data || []);
    } catch (error: any) {
      console.error('[LegCard] Failed to fetch games:', error);
      setGames([]); // V1.1: No mock fallback
    } finally {
      setLoading(prev => ({ ...prev, games: false }));
    }
  };

  // V1.1 COMPLIANCE: Fetch teams from DB only
  const fetchTeamsForSport = async (sport: string) => {
    try {
      setLoading(prev => ({ ...prev, teams: true }));

      const response = await fetch(`/api/catalog/teams?sport=${sport}`);
      if (!response.ok) {
        throw new Error(`Teams API error: ${response.status}`);
      }

      const data = await response.json();
      setTeams(data.teams || []);
    } catch (error: any) {
      console.error('[LegCard] Failed to fetch teams:', error);
      setTeams([]); // V1.1: No mock fallback - use manual mode
      toast({
        title: 'Teams unavailable',
        description: 'Enable manual mode to enter team names',
        variant: 'default',
      });
    } finally {
      setLoading(prev => ({ ...prev, teams: false }));
    }
  };

  // V1.1 COMPLIANCE: Fetch stat types from DB
  // Pass bet_type=player_prop to get player prop stat types (PTS, REB, AST, etc.)
  const fetchStatTypesForSport = async (sport: string, betType?: string) => {
    try {
      setLoading(prev => ({ ...prev, statTypes: true }));

      // V1.1: For player props, request player_prop stat types specifically
      const params = new URLSearchParams({ sport });
      if (betType === 'player_prop') {
        params.set('bet_type', 'player_prop');
      }

      const response = await fetch(`/api/registry/stat-types?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Stat types API error: ${response.status}`);
      }

      const data = await response.json();
      setStatTypes(data.stat_types || []);
    } catch (error: any) {
      console.error('[LegCard] Failed to fetch stat types:', error);
      setStatTypes([]); // V1.1: No hardcoded fallback - user can type manually
    } finally {
      setLoading(prev => ({ ...prev, statTypes: false }));
    }
  };

  // V1.1 COMPLIANCE: Normalize team/player input
  const normalizeInput = async (type: 'team' | 'player', query: string, sport?: string, team?: string) => {
    try {
      setNormalizing(true);
      const response = await fetch('/api/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, query, sport, team }),
      });

      if (!response.ok) {
        throw new Error(`Normalize API error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('[LegCard] Normalization failed:', error);
      return { found: false, canonical: null };
    } finally {
      setNormalizing(false);
    }
  };

  // V1.1 COMPLIANCE: Handle manual team entry with normalization
  const handleManualTeamBlur = async () => {
    if (!manualTeam.trim() || !leg.sport) return;

    const result = await normalizeInput('team', manualTeam, leg.sport);

    if (result.found && result.canonical) {
      setManualTeam(result.canonical);
      handleChange('team', result.canonical);
      handleChange('source', 'manual');
      toast({
        title: 'Team normalized',
        description: `"${manualTeam}" → "${result.canonical}"`,
      });
    } else {
      // V1.1: Accept manual input but mark as manual source
      handleChange('team', manualTeam.trim());
      handleChange('source', 'manual');
      handleChange('manual_home_team', manualTeam.trim());
    }
  };

  // V1.1 COMPLIANCE: Handle manual player entry with team validation
  const handleManualPlayerBlur = async () => {
    if (!manualPlayer.trim() || !leg.sport) return;

    const result = await normalizeInput('player', manualPlayer, leg.sport, leg.team);

    if (result.found && result.canonical) {
      setManualPlayer(result.canonical);
      handleChange('player_name', result.canonical);
      handleChange('source', 'manual');
    } else {
      // V1.1: Accept manual input
      handleChange('player_name', manualPlayer.trim());
      handleChange('source', 'manual');
    }
  };

  // Initial data fetch when sport changes
  useEffect(() => {
    if (leg.sport) {
      fetchGamesForSport(leg.sport);
      fetchTeamsForSport(leg.sport);
    }
  }, [leg.sport]);

  // V1.1: Fetch stat types when bet_category changes to player_prop
  useEffect(() => {
    if (leg.sport && leg.bet_category === 'player_prop') {
      fetchStatTypesForSport(leg.sport, 'player_prop');
    }
  }, [leg.sport, leg.bet_category]);

  // Toggle manual mode
  const handleManualModeToggle = (enabled: boolean) => {
    setIsManualMode(enabled);
    if (enabled) {
      handleChange('source', 'manual');
    } else {
      handleChange('source', 'api');
    }
  };

  return (
    <Card className="p-4 mb-4 bg-white border-2 border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm font-mono">
            Leg {legIndex + 1}
          </Badge>
          <Badge variant={leg.status === 'open' ? 'default' : 'secondary'} className="text-xs">
            {leg.status?.toUpperCase() || 'OPEN'}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          {/* V1.1 COMPLIANCE: Manual Mode Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id={`manual-mode-${legIndex}`}
              checked={isManualMode}
              onCheckedChange={handleManualModeToggle}
            />
            <Label htmlFor={`manual-mode-${legIndex}`} className="text-xs text-gray-500">
              Manual
            </Label>
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-red-500 hover:text-red-700">
            Remove
          </Button>
        </div>
      </div>

      <Tabs defaultValue="main" className="w-full">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="main" className="flex-1">
            Pick Details
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex-1">
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4">
          {/* Sport Selection - Always Required */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Sport <span className="text-red-500">*</span>
            </label>
            <Select value={leg.sport} onValueChange={value => handleChange('sport', value)}>
              <SelectTrigger className={!leg.sport ? 'border-red-300' : ''}>
                <SelectValue placeholder="Select Sport" />
              </SelectTrigger>
              <SelectContent>
                {['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF', 'NCAAB'].map(sport => (
                  <SelectItem key={sport} value={sport}>
                    {sport}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bet Category */}
          {leg.sport && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Bet Type <span className="text-red-500">*</span>
              </label>
              <Select
                value={leg.bet_category}
                onValueChange={value => handleChange('bet_category', value)}
              >
                <SelectTrigger className={!leg.bet_category ? 'border-red-300' : ''}>
                  <SelectValue placeholder="Select Bet Type" />
                </SelectTrigger>
                <SelectContent>
                  {BET_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Game Selection - Only in API mode */}
          {leg.sport && !isManualMode && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Game (Optional)</label>
              {loading.games ? (
                <div className="flex items-center space-x-2">
                  <Spinner className="h-4 w-4" />
                  <span className="text-sm text-gray-500">Loading games...</span>
                </div>
              ) : games.length > 0 ? (
                <Select
                  value={leg.game_id}
                  onValueChange={value => handleChange('game_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Game (or use Manual Mode)" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map(game => (
                      <SelectItem key={game.id} value={game.id}>
                        {`${game.away_team} @ ${game.home_team}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-700">
                    No games available. Enable Manual Mode to enter picks.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* V1.1 MANUAL MODE: Team Entry */}
          {isManualMode && leg.sport && (leg.bet_category === 'spread' || leg.bet_category === 'moneyline' || leg.bet_category === 'team_prop') && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Team <span className="text-red-500">*</span>
                <span className="text-xs text-gray-400 ml-2">(type name - will normalize)</span>
              </label>
              <div className="relative">
                <Input
                  value={manualTeam}
                  onChange={e => {
                    // V1.1: Update local state AND leg.team immediately for validation
                    setManualTeam(e.target.value);
                    handleChange('team', e.target.value);
                  }}
                  onBlur={handleManualTeamBlur}
                  placeholder="e.g., Celtics, Boston, BOS"
                  className={!leg.team ? 'border-red-300' : ''}
                />
                {normalizing && (
                  <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" />
                )}
              </div>
              {leg.team && (
                <p className="text-xs text-green-600">Normalized: {leg.team}</p>
              )}
            </div>
          )}

          {/* API MODE: Team Selection from DB */}
          {!isManualMode && leg.sport && (leg.bet_category === 'spread' || leg.bet_category === 'moneyline' || leg.bet_category === 'team_prop') && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Team <span className="text-red-500">*</span>
              </label>
              {loading.teams ? (
                <div className="flex items-center space-x-2">
                  <Spinner className="h-4 w-4" />
                  <span className="text-sm text-gray-500">Loading teams...</span>
                </div>
              ) : (
                <Select value={leg.team || ''} onValueChange={value => handleChange('team', value)}>
                  <SelectTrigger className={!leg.team ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Select Team" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameTeams.length > 0
                      ? gameTeams.map(team => (
                          <SelectItem key={team.value} value={team.value}>
                            {team.label}
                          </SelectItem>
                        ))
                      : teams.map(team => (
                          <SelectItem key={team.id} value={team.name}>
                            {team.name} {team.abbr ? `(${team.abbr})` : ''}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Player Props */}
          {leg.sport && leg.bet_category === 'player_prop' && (
            <div className="space-y-4">
              {/* Player Search/Entry */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Player <span className="text-red-500">*</span>
                </label>
                {isManualMode ? (
                  <div className="relative">
                    <Input
                      value={manualPlayer}
                      onChange={e => {
                        // V1.1: Update local state AND leg.player_name immediately for validation
                        setManualPlayer(e.target.value);
                        handleChange('player_name', e.target.value);
                      }}
                      onBlur={handleManualPlayerBlur}
                      placeholder="e.g., Jaylen Brown, LeBron James"
                      className={!leg.player_name ? 'border-red-300' : ''}
                    />
                    {normalizing && (
                      <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" />
                    )}
                  </div>
                ) : (
                  <SmartSearch
                    searchType="players"
                    sport={leg.sport}
                    value={leg.player_name || ''}
                    placeholder={
                      gameTeamNames.length > 0
                        ? `Search ${gameTeamNames.join(' / ')} players...`
                        : 'Type player name (min 2 chars)...'
                    }
                    teamFilter={gameTeamNames}
                    onSelect={item => {
                      // V1.1: Auto-fill team when player selected
                      if (onUpdate) {
                        onUpdate({
                          player_name: item.name,
                          ...(item.team ? { team: item.team } : {}),
                        });
                      }
                    }}
                    onClear={() => {
                      if (onUpdate) {
                        onUpdate({ player_name: '', team: '' });
                      }
                    }}
                  />
                )}
                {leg.player_name && (
                  <div className="text-xs text-green-600">Selected: {leg.player_name}</div>
                )}
              </div>

              {/* Auto-filled Team (locked) */}
              {leg.team && leg.player_name && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    Team <span className="text-xs text-gray-400">(auto-filled)</span>
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-md border border-gray-200">
                    <span className="text-gray-700">{leg.team}</span>
                    <span className="text-xs text-gray-400">🔒</span>
                  </div>
                </div>
              )}

              {/* Stat Type - V1.1: From DB, filtered by sport */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Stat Type <span className="text-red-500">*</span>
                </label>
                {loading.statTypes ? (
                  <div className="flex items-center space-x-2">
                    <Spinner className="h-4 w-4" />
                    <span className="text-sm text-gray-500">Loading stat types...</span>
                  </div>
                ) : statTypes.length > 0 ? (
                  <Select
                    value={leg.prop_type || ''}
                    onValueChange={value => handleChange('prop_type', value)}
                  >
                    <SelectTrigger className={!leg.prop_type ? 'border-red-300' : ''}>
                      <SelectValue placeholder="Select Stat Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {statTypes.map(statType => (
                        <SelectItem key={statType} value={statType}>
                          {statType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  // V1.1: Manual stat type input when DB empty
                  <Input
                    value={leg.prop_type || ''}
                    onChange={e => handleChange('prop_type', e.target.value.toUpperCase())}
                    placeholder="e.g., PTS, REB, AST"
                    className={!leg.prop_type ? 'border-red-300' : ''}
                  />
                )}
              </div>

              {/* Line */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Line <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={leg.line || ''}
                  onChange={e => handleChange('line', e.target.value)}
                  placeholder="e.g. 25.5"
                  className={!leg.line ? 'border-red-300' : ''}
                />
              </div>

              {/* Direction */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Direction <span className="text-red-500">*</span>
                </label>
                <Select
                  value={leg.direction || ''}
                  onValueChange={value => handleChange('direction', value)}
                >
                  <SelectTrigger className={!leg.direction ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Select Over/Under" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map(dir => (
                      <SelectItem key={dir} value={dir}>
                        {dir.charAt(0).toUpperCase() + dir.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Spread Fields */}
          {leg.sport && leg.bet_category === 'spread' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Point Spread <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.5"
                value={leg.line || ''}
                onChange={e => handleChange('line', e.target.value)}
                placeholder="e.g. -3.5"
                className={!leg.line ? 'border-red-300' : ''}
              />
            </div>
          )}

          {/* Total Fields */}
          {leg.sport && leg.bet_category === 'total' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Total Points <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={leg.line || ''}
                  onChange={e => handleChange('line', e.target.value)}
                  placeholder="e.g. 225.5"
                  className={!leg.line ? 'border-red-300' : ''}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Direction <span className="text-red-500">*</span>
                </label>
                <Select
                  value={leg.direction || ''}
                  onValueChange={value => handleChange('direction', value)}
                >
                  <SelectTrigger className={!leg.direction ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Select Over/Under" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIRECTIONS.map(dir => (
                      <SelectItem key={dir} value={dir}>
                        {dir.charAt(0).toUpperCase() + dir.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Odds - Always Required */}
          {leg.bet_category && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Odds <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={leg.odds || ''}
                onChange={e => handleChange('odds', e.target.value)}
                placeholder="e.g. -110, +200"
                className={`text-gray-900 bg-white ${!leg.odds ? 'border-red-300' : ''}`}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          {/* Market Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Market Type</label>
            <Select
              value={leg.market_type}
              onValueChange={value => handleChange('market_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Market Type" />
              </SelectTrigger>
              <SelectContent>
                {MARKET_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source Display */}
          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-xs text-gray-500">
              Source: <span className="font-mono">{isManualMode ? 'manual' : 'api'}</span>
            </p>
            {leg.game_id && (
              <p className="text-xs text-gray-500">
                Game ID: <span className="font-mono">{leg.game_id}</span>
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
