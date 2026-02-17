'use client';
import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TicketLeg,
  MARKET_TYPES,
  BET_CATEGORIES,
  SPORT_PROP_TYPES,
  SPORTS,
  DIRECTIONS,
} from '../types';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { SmartSearch } from '@/components/ui/smart-search';

interface LegCardProps {
  leg: TicketLeg;
  onRemove: () => void;
  onUpdate?: (updates: Partial<TicketLeg>) => void;
}

export function LegCard({ leg, onRemove, onUpdate }: LegCardProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [props, setProps] = useState<any[]>([]);
  const [loading, setLoading] = useState({
    teams: false,
    players: false,
    games: false,
    props: false,
  });
  const { toast } = useToast();

  // SMARTFORM-UX-CRITICAL-FIXPACK-025: Get teams from selected game for spread/total
  const selectedGame = games.find(g => g.id === leg.game_id);
  const gameTeams = selectedGame
    ? [
        { value: selectedGame.home_team, label: `${selectedGame.home_team} (Home)` },
        { value: selectedGame.away_team, label: `${selectedGame.away_team} (Away)` },
      ]
    : [];

  // Get sport-specific prop types
  const getSportPropTypes = (sport: string) => {
    return SPORT_PROP_TYPES[sport as keyof typeof SPORT_PROP_TYPES] || [];
  };

  const handleChange = (field: keyof TicketLeg, value: any) => {
    if (onUpdate) {
      if (field === 'sport') {
        // Reset dependent fields when sport changes
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
        });
        // Fetch new data for the selected sport
        fetchGamesForSport(value);
        fetchTeamsForSport(value);
      } else if (field === 'market_type') {
        // Reset dependent fields when market type changes
        onUpdate({
          market_type: value,
          bet_type: undefined,
          team: '',
          opponent: '',
          player_name: '',
          prop_type: '',
          line: '',
          odds: '',
          direction: undefined,
        });
      } else if (field === 'bet_category') {
        // SMARTFORM-UX-CRITICAL-FIXPACK-025: Reset fields when bet category changes
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
  };

  const fetchGamesForSport = async (sport: string) => {
    try {
      setLoading(prev => ({ ...prev, games: true }));
      const data = await apiClient.fetchGames(sport);
      setGames(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch games',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, games: false }));
    }
  };

  const fetchTeamsForSport = async (sport: string) => {
    try {
      setLoading(prev => ({ ...prev, teams: true }));

      // Use the API client - teams are now embedded in games data
      const games = await apiClient.fetchGames(sport);

      // Extract unique teams from games data
      const uniqueTeams = new Set();
      const teamsData = [];

      for (const game of games) {
        if (game.home_team && !uniqueTeams.has(game.home_team)) {
          uniqueTeams.add(game.home_team);
          teamsData.push({
            id: `home-${game.id}`,
            name: game.home_team,
            sport: game.sport,
            abbreviation: game.home_team.slice(0, 3).toUpperCase(),
          });
        }
        if (game.away_team && !uniqueTeams.has(game.away_team)) {
          uniqueTeams.add(game.away_team);
          teamsData.push({
            id: `away-${game.id}`,
            name: game.away_team,
            sport: game.sport,
            abbreviation: game.away_team.slice(0, 3).toUpperCase(),
          });
        }
      }

      setTeams(teamsData.length > 0 ? teamsData : getMockTeamsForSport(sport));
    } catch (error: any) {
      // Failed to fetch teams, using mock data
      setTeams(getMockTeamsForSport(sport));
    } finally {
      setLoading(prev => ({ ...prev, teams: false }));
    }
  };

  // Mock data for when database is unavailable
  const getMockTeamsForSport = (sport: string) => {
    const mockTeams: any = {
      NBA: [
        { id: '1', name: 'Lakers', sport: 'NBA', abbreviation: 'LAL' },
        { id: '2', name: 'Warriors', sport: 'NBA', abbreviation: 'GSW' },
        { id: '3', name: 'Celtics', sport: 'NBA', abbreviation: 'BOS' },
      ],
      NFL: [
        { id: '4', name: 'Chiefs', sport: 'NFL', abbreviation: 'KC' },
        { id: '5', name: 'Bills', sport: 'NFL', abbreviation: 'BUF' },
        { id: '6', name: 'Cowboys', sport: 'NFL', abbreviation: 'DAL' },
      ],
      MLB: [
        { id: '7', name: 'Dodgers', sport: 'MLB', abbreviation: 'LAD' },
        { id: '8', name: 'Yankees', sport: 'MLB', abbreviation: 'NYY' },
        { id: '9', name: 'Astros', sport: 'MLB', abbreviation: 'HOU' },
      ],
    };
    return mockTeams[sport] || [];
  };

  const fetchPropsForGame = async (gameId: string) => {
    try {
      setLoading(prev => ({ ...prev, props: true }));
      const data = await apiClient.fetchProps(leg.sport, { gameId });
      setProps(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch props',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, props: false }));
    }
  };

  // Initial data fetch when sport changes
  useEffect(() => {
    if (leg.sport) {
      fetchGamesForSport(leg.sport);
      fetchTeamsForSport(leg.sport);
    }
  }, [leg.sport]);

  return (
    <Card className="p-4 mb-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <Badge variant="outline" className="text-sm">
          {leg.status || 'OPEN'}
        </Badge>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>

      <Tabs defaultValue="main" className="w-full">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="main" className="flex-1">
            Main
          </TabsTrigger>
          <TabsTrigger value="alternates" className="flex-1">
            Alternates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4">
          {/* Sport Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Sport</label>
            <Select value={leg.sport} onValueChange={value => handleChange('sport', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select Sport" />
              </SelectTrigger>
              <SelectContent>
                {SPORTS.map(sport => (
                  <SelectItem key={sport} value={sport}>
                    {sport}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bet Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Bet Type</label>
            <Select
              value={leg.bet_category}
              onValueChange={value => handleChange('bet_category', value)}
            >
              <SelectTrigger>
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
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Game Selection */}
          {leg.sport && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Game</label>
              {loading.games ? (
                <div className="flex items-center space-x-2">
                  <Spinner className="h-4 w-4" />
                  <span className="text-sm text-gray-500">Loading games...</span>
                </div>
              ) : (
                <Select
                  value={leg.game_id}
                  onValueChange={value => {
                    handleChange('game_id', value);
                    fetchPropsForGame(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Game" />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map(game => (
                      <SelectItem key={game.id} value={game.id}>
                        {`${game.home_team} vs ${game.away_team} - ${new Date(game.game_date).toLocaleDateString()}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* SMARTFORM-UX-CRITICAL-FIXPACK-025: Team Prop fully functional */}
          {leg.sport && leg.bet_category === 'team_prop' && (
            <div className="space-y-4">
              {/* Team Selection - REQUIRED */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Team <span className="text-red-500">*</span>
                </label>
                <Select value={leg.team || ''} onValueChange={value => handleChange('team', value)}>
                  <SelectTrigger className={!leg.team ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Select Team" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameTeams.length > 0 ? (
                      gameTeams.map(team => (
                        <SelectItem key={team.value} value={team.value}>
                          {team.label}
                        </SelectItem>
                      ))
                    ) : teams.length > 0 ? (
                      teams.map(team => (
                        <SelectItem key={team.id} value={team.name}>
                          {team.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="manual_team">Enter Team Manually</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {!leg.team && (
                  <p className="text-xs text-red-500">Team selection required for team props</p>
                )}
              </div>
              {/* Team Prop Type - team_total is the primary supported type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Prop Type <span className="text-red-500">*</span>
                </label>
                <Select
                  value={leg.prop_type || ''}
                  onValueChange={value => handleChange('prop_type', value)}
                >
                  <SelectTrigger className={!leg.prop_type ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Select Team Prop Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team_total">Team Total</SelectItem>
                    <SelectItem value="first_to_score">First to Score</SelectItem>
                    <SelectItem value="win_margin">Win Margin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Line for Team Total - REQUIRED */}
              {leg.prop_type === 'team_total' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Team Total Line <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    value={leg.line || ''}
                    onChange={e => handleChange('line', e.target.value)}
                    placeholder="e.g. 115.5"
                    className={!leg.line ? 'border-red-300' : ''}
                  />
                </div>
              )}
              {/* Direction for Team Total - REQUIRED */}
              {leg.prop_type === 'team_total' && (
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
                  {!leg.direction && (
                    <p className="text-xs text-red-500">Direction required for team total</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Player Props - only show for player_prop bet category */}
          {leg.sport && leg.bet_category === 'player_prop' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Player</label>
                <SmartSearch
                  searchType="players"
                  sport={leg.sport}
                  placeholder="Type player name (min 3 chars for search)..."
                  disabled={loading.props}
                  onSelect={item => handleChange('player_name', item.name)}
                />
                {leg.player_name && (
                  <div className="text-xs text-green-600">Selected: {leg.player_name}</div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Prop Type</label>
                <Select
                  value={leg.prop_type}
                  onValueChange={value => handleChange('prop_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Prop Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSportPropTypes(leg.sport).map(propType => (
                      <SelectItem key={propType} value={propType}>
                        {propType.charAt(0).toUpperCase() + propType.slice(1).replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* SMARTFORM-UX-CRITICAL-FIXPACK-025: Spread with Team Selection */}
          {leg.sport && leg.bet_category === 'spread' && (
            <div className="space-y-4">
              {/* Team Selection for Spread - REQUIRED */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Team Selection <span className="text-red-500">*</span>
                </label>
                <Select value={leg.team || ''} onValueChange={value => handleChange('team', value)}>
                  <SelectTrigger className={!leg.team ? 'border-red-300' : ''}>
                    <SelectValue placeholder="Select Team for Spread" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameTeams.length > 0 ? (
                      gameTeams.map(team => (
                        <SelectItem key={team.value} value={team.value}>
                          {team.label}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="home_team">Home Team</SelectItem>
                        <SelectItem value="away_team">Away Team</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {!leg.team && (
                  <p className="text-xs text-red-500">Team selection required for spread bets</p>
                )}
              </div>
              {/* Point Spread */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Point Spread</label>
                <Input
                  type="number"
                  step="0.5"
                  value={leg.line || ''}
                  onChange={e => handleChange('line', e.target.value)}
                  placeholder="e.g. -3.5"
                />
              </div>
            </div>
          )}

          {/* SMARTFORM-UX-CRITICAL-FIXPACK-025: Total with Direction */}
          {leg.sport && leg.bet_category === 'total' && (
            <div className="space-y-4">
              {/* Total Points Line */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Total Points</label>
                <Input
                  type="number"
                  step="0.5"
                  value={leg.line || ''}
                  onChange={e => handleChange('line', e.target.value)}
                  placeholder="e.g. 225.5"
                />
              </div>
              {/* Direction for Total - REQUIRED */}
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
                {!leg.direction && (
                  <p className="text-xs text-red-500">Direction required for total bets</p>
                )}
              </div>
            </div>
          )}

          {/* Moneyline specific fields */}
          {leg.sport && leg.bet_category === 'moneyline' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Team Selection</label>
              <Select value={leg.team} onValueChange={value => handleChange('team', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home Team</SelectItem>
                  <SelectItem value="away">Away Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Odds - Show for all bet types */}
          {leg.bet_category && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Odds</label>
              <Input
                type="text"
                value={leg.odds || ''}
                onChange={e => handleChange('odds', e.target.value)}
                placeholder="e.g. -110, +200"
                className="text-gray-900 bg-white"
              />
            </div>
          )}

          {/* SMARTFORM-UX-CRITICAL-FIXPACK-025: Player Prop Line + Direction */}
          {leg.bet_category === 'player_prop' && leg.prop_type && (
            <div className="space-y-4">
              {/* Line field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {leg.prop_type.charAt(0).toUpperCase() + leg.prop_type.slice(1).replace('_', ' ')}{' '}
                  Line
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={leg.line || ''}
                  onChange={e => handleChange('line', e.target.value)}
                  placeholder="e.g. 25.5"
                  className="text-gray-900 bg-white"
                />
              </div>
              {/* Direction for Player Prop - REQUIRED */}
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
                {!leg.direction && (
                  <p className="text-xs text-red-500">Direction required for player props</p>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="alternates" className="space-y-4">
          {/* Alternate lines/odds will go here */}
          <p className="text-sm text-gray-500">Alternate lines coming soon...</p>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
