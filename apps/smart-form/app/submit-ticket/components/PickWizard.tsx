'use client';

/**
 * PickWizard - V1.1 Enterprise Compliant Smart Form
 *
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036
 *
 * A guided, step-by-step pick submission wizard that implements:
 * - Progressive disclosure (fields only shown when prerequisites met)
 * - Hierarchical filtering (Sport → Bet Type → Participant → Details)
 * - First-class manual mode (not buried in toggles)
 * - Skeleton loading states
 * - Clear validation and error states
 *
 * NO MOCK DATA - All data from DB-backed endpoints
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stepper } from '@/components/ui/stepper';
import { SkeletonField } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { SmartSearch } from '@/components/ui/smart-search';
import { Spinner } from '@/components/ui/spinner';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Search,
  Edit3,
  Zap,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  Sport,
  SPORTS,
  BET_CATEGORIES,
  BetCategory,
  DIRECTIONS,
  Direction,
  TicketLeg,
} from '../types';

// Step configuration for the wizard
const WIZARD_STEPS = [
  {
    id: 1,
    name: 'sport-bet',
    title: 'Sport & Bet Type',
    description: 'Choose sport and what to bet on',
  },
  {
    id: 2,
    name: 'participant',
    title: 'Participant',
    description: 'Select player or team',
  },
  {
    id: 3,
    name: 'details',
    title: 'Line & Odds',
    description: 'Enter betting details',
  },
  {
    id: 4,
    name: 'review',
    title: 'Review',
    description: 'Confirm and submit',
  },
];

// Entry mode types
type EntryMode = 'search' | 'manual';

interface PickState {
  sport: Sport | '';
  betCategory: BetCategory | '';
  team: string;
  teamId: string;
  player: string;
  playerId: string;
  statType: string;
  line: string;
  direction: Direction | '';
  odds: string;
  gameId: string;
  gameLabel: string;
  source: 'api' | 'manual';
}

interface WizardState {
  currentStep: number;
  completedSteps: number[];
  entryMode: EntryMode;
  pick: PickState;
  legs: TicketLeg[];
}

const initialPickState: PickState = {
  sport: '',
  betCategory: '',
  team: '',
  teamId: '',
  player: '',
  playerId: '',
  statType: '',
  line: '',
  direction: '',
  odds: '',
  gameId: '',
  gameLabel: '',
  source: 'api',
};

export function PickWizard() {
  const { toast } = useToast();

  // Wizard state
  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    completedSteps: [],
    entryMode: 'search',
    pick: initialPickState,
    legs: [],
  });

  // Data loading states
  const [loading, setLoading] = useState({
    cappers: true,
    teams: false,
    players: false,
    statTypes: false,
    games: false,
    submitting: false,
  });

  // Data from API
  const [cappers, setCappers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCapper, setSelectedCapper] = useState('');
  const [teams, setTeams] = useState<Array<{ id: string; name: string; abbr?: string }>>([]);
  const [statTypes, setStatTypes] = useState<string[]>([]);
  const [games, setGames] = useState<any[]>([]);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helpers
  const { currentStep, completedSteps, entryMode, pick, legs } = state;

  const updatePick = useCallback((updates: Partial<PickState>) => {
    setState(prev => ({
      ...prev,
      pick: { ...prev.pick, ...updates },
    }));
  }, []);

  const setCurrentStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);

  const completeStep = useCallback((step: number) => {
    setState(prev => ({
      ...prev,
      completedSteps: prev.completedSteps.includes(step)
        ? prev.completedSteps
        : [...prev.completedSteps, step],
    }));
  }, []);

  const setEntryMode = useCallback((mode: EntryMode) => {
    setState(prev => ({
      ...prev,
      entryMode: mode,
      pick: { ...prev.pick, source: mode === 'manual' ? 'manual' : 'api' },
    }));
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // DATA FETCHING - NO MOCK DATA, FAIL-CLOSED
  // ═══════════════════════════════════════════════════════════════

  // Load cappers on mount - FAIL-CLOSED (no fallback)
  useEffect(() => {
    const loadCappers = async () => {
      try {
        setLoading(prev => ({ ...prev, cappers: true }));
        const response = await fetch('/api/cappers');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data.cappers || data.cappers.length === 0) {
          throw new Error('No cappers found');
        }
        setCappers(data.cappers);
        // Auto-select first capper
        if (data.cappers.length > 0) {
          setSelectedCapper(data.cappers[0].id);
        }
      } catch (error: any) {
        console.error('[PickWizard] Failed to load cappers:', error);
        // V1.1 COMPLIANCE: NO FALLBACK - Show error state
        toast({
          title: 'Failed to load cappers',
          description: 'Please refresh the page or contact support.',
          variant: 'destructive',
        });
        setCappers([]);
      } finally {
        setLoading(prev => ({ ...prev, cappers: false }));
      }
    };
    loadCappers();
  }, [toast]);

  // Load teams when sport changes
  useEffect(() => {
    if (!pick.sport) {
      setTeams([]);
      return;
    }

    const loadTeams = async () => {
      try {
        setLoading(prev => ({ ...prev, teams: true }));
        const response = await fetch(`/api/catalog/teams?sport=${pick.sport}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setTeams(data.teams || []);
      } catch (error) {
        console.error('[PickWizard] Failed to load teams:', error);
        setTeams([]);
      } finally {
        setLoading(prev => ({ ...prev, teams: false }));
      }
    };
    loadTeams();
  }, [pick.sport]);

  // Load stat types when sport + player_prop selected
  useEffect(() => {
    if (!pick.sport || pick.betCategory !== 'player_prop') {
      setStatTypes([]);
      return;
    }

    const loadStatTypes = async () => {
      try {
        setLoading(prev => ({ ...prev, statTypes: true }));
        const response = await fetch(
          `/api/registry/stat-types?sport=${pick.sport}&bet_type=player_prop`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setStatTypes(data.stat_types || []);
      } catch (error) {
        console.error('[PickWizard] Failed to load stat types:', error);
        setStatTypes([]);
      } finally {
        setLoading(prev => ({ ...prev, statTypes: false }));
      }
    };
    loadStatTypes();
  }, [pick.sport, pick.betCategory]);

  // Load games when sport changes
  useEffect(() => {
    if (!pick.sport) {
      setGames([]);
      return;
    }

    const loadGames = async () => {
      try {
        setLoading(prev => ({ ...prev, games: true }));
        const data = await apiClient.fetchGames(pick.sport);
        setGames(data || []);
      } catch (error) {
        console.error('[PickWizard] Failed to load games:', error);
        setGames([]);
      } finally {
        setLoading(prev => ({ ...prev, games: false }));
      }
    };
    loadGames();
  }, [pick.sport]);

  // ═══════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!pick.sport) newErrors.sport = 'Sport is required';
        if (!pick.betCategory) newErrors.betCategory = 'Bet type is required';
        break;
      case 2:
        if (pick.betCategory === 'player_prop') {
          if (!pick.player) newErrors.player = 'Player is required';
          if (!pick.statType) newErrors.statType = 'Stat type is required';
        } else if (['spread', 'moneyline', 'team_prop'].includes(pick.betCategory)) {
          if (!pick.team) newErrors.team = 'Team is required';
        }
        break;
      case 3:
        if (!pick.odds) newErrors.odds = 'Odds are required';
        if (['spread', 'total', 'player_prop', 'team_prop'].includes(pick.betCategory)) {
          if (!pick.line) newErrors.line = 'Line is required';
        }
        if (['total', 'player_prop'].includes(pick.betCategory)) {
          if (!pick.direction) newErrors.direction = 'Direction (Over/Under) is required';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [pick]);

  // ═══════════════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return !!pick.sport && !!pick.betCategory;
      case 2:
        if (pick.betCategory === 'player_prop') {
          return !!pick.player && !!pick.statType;
        }
        if (['spread', 'moneyline', 'team_prop'].includes(pick.betCategory)) {
          return !!pick.team;
        }
        return true;
      case 3: {
        const hasOdds = !!pick.odds;
        const needsLine = ['spread', 'total', 'player_prop', 'team_prop'].includes(pick.betCategory);
        const hasLine = !needsLine || !!pick.line;
        const needsDirection = ['total', 'player_prop'].includes(pick.betCategory);
        const hasDirection = !needsDirection || !!pick.direction;
        return hasOdds && hasLine && hasDirection;
      }
      case 4:
        return legs.length > 0;
      default:
        return false;
    }
  }, [currentStep, pick, legs]);

  const goNext = useCallback(() => {
    if (!validateStep(currentStep)) return;
    completeStep(currentStep);
    setCurrentStep(Math.min(currentStep + 1, WIZARD_STEPS.length));
  }, [currentStep, validateStep, completeStep, setCurrentStep]);

  const goBack = useCallback(() => {
    setCurrentStep(Math.max(currentStep - 1, 1));
  }, [currentStep, setCurrentStep]);

  // ═══════════════════════════════════════════════════════════════
  // LEG MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  const addLeg = useCallback(() => {
    if (!validateStep(3)) return;

    const newLeg: TicketLeg = {
      id: crypto.randomUUID(),
      sport: pick.sport as Sport,
      bet_category: pick.betCategory as BetCategory,
      team: pick.team || undefined,
      player_name: pick.player || undefined,
      prop_type: pick.statType || undefined,
      line: pick.line || undefined,
      direction: pick.direction as Direction || undefined,
      odds: pick.odds,
      game_id: pick.gameId || undefined,
      status: 'open',
    };

    setState(prev => ({
      ...prev,
      legs: [...prev.legs, newLeg],
      pick: initialPickState, // Reset for next leg
      currentStep: 1,
      completedSteps: [],
    }));

    toast({
      title: 'Leg added',
      description: `${pick.betCategory === 'player_prop' ? pick.player : pick.team} added to ticket`,
    });
  }, [pick, validateStep, toast]);

  const removeLeg = useCallback((legId: string) => {
    setState(prev => ({
      ...prev,
      legs: prev.legs.filter(l => l.id !== legId),
    }));
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // SUBMISSION
  // ═══════════════════════════════════════════════════════════════

  const handleSubmit = useCallback(async () => {
    if (legs.length === 0) {
      toast({
        title: 'No legs',
        description: 'Add at least one leg to submit',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedCapper) {
      toast({
        title: 'No capper selected',
        description: 'Please select a capper',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(prev => ({ ...prev, submitting: true }));

      const ticketData = {
        capper_id: selectedCapper,
        sport: legs[0].sport,
        ticket_type: legs.length > 1 ? 'parlay' : 'single',
        selections: legs.map((leg) => ({
          sport: leg.sport,
          bet_type: leg.bet_category || 'moneyline',
          stat_type: leg.prop_type || leg.bet_category || 'unknown',
          line: parseFloat(leg.line || '0') || 0,
          leg_odds: parseInt(leg.odds?.replace(/[^-\d]/g, '') || '-110', 10),
          source: 'manual' as const,
          selection: buildSelectionString(leg),
          direction: leg.direction?.toLowerCase() as 'over' | 'under' | undefined,
          team: leg.team,
          player_name: leg.player_name,
          confidence: 7,
        })),
        total_units: 1,
        notes: '',
      };

      const result = await apiClient.submitTicket(ticketData);

      toast({
        title: 'Success',
        description: `Ticket submitted. ID: ${(result as any)?.bet_slip_id || 'Generated'}`,
      });

      // Reset wizard
      setState({
        currentStep: 1,
        completedSteps: [],
        entryMode: 'search',
        pick: initialPickState,
        legs: [],
      });
    } catch (error: any) {
      toast({
        title: 'Submission failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, submitting: false }));
    }
  }, [legs, selectedCapper, toast]);

  // Helper to build selection string
  const buildSelectionString = (leg: TicketLeg): string => {
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
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════════

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1SportBet();
      case 2:
        return renderStep2Participant();
      case 3:
        return renderStep3Details();
      case 4:
        return renderStep4Review();
      default:
        return null;
    }
  };

  // Step 1: Sport & Bet Type
  const renderStep1SportBet = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Sport <span className="text-red-500">*</span>
        </Label>
        <Select
          value={pick.sport}
          onValueChange={(value) => {
            updatePick({
              sport: value as Sport,
              // Reset downstream on sport change
              team: '',
              teamId: '',
              player: '',
              playerId: '',
              statType: '',
              gameId: '',
              gameLabel: '',
            });
          }}
        >
          <SelectTrigger className={errors.sport ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select a sport" />
          </SelectTrigger>
          <SelectContent>
            {SPORTS.filter(s => ['NBA', 'NFL', 'MLB', 'NHL', 'NCAAF', 'NCAAB'].includes(s)).map(sport => (
              <SelectItem key={sport} value={sport}>
                {sport}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.sport && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {errors.sport}
          </p>
        )}
      </div>

      {/* Only show bet type if sport selected */}
      {pick.sport && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Bet Type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={pick.betCategory}
            onValueChange={(value) => {
              updatePick({
                betCategory: value as BetCategory,
                // Reset participant fields on bet type change
                team: '',
                teamId: '',
                player: '',
                playerId: '',
                statType: '',
                direction: '',
              });
            }}
          >
            <SelectTrigger className={errors.betCategory ? 'border-red-500' : ''}>
              <SelectValue placeholder="What do you want to bet on?" />
            </SelectTrigger>
            <SelectContent>
              {BET_CATEGORIES.filter(c => !['parlay', 'teaser', 'futures'].includes(c)).map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.betCategory && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {errors.betCategory}
            </p>
          )}
        </div>
      )}

      {/* Entry mode toggle */}
      {pick.sport && pick.betCategory && (
        <div className="pt-4 border-t">
          <Label className="text-sm text-gray-500 mb-2 block">Entry Mode</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={entryMode === 'search' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEntryMode('search')}
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" /> Search
            </Button>
            <Button
              type="button"
              variant={entryMode === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEntryMode('manual')}
              className="flex items-center gap-2"
            >
              <Edit3 className="h-4 w-4" /> Manual
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {entryMode === 'search'
              ? 'Search for players, teams, and games from our database'
              : 'Manually enter pick details (still validates against sport rules)'}
          </p>
        </div>
      )}
    </div>
  );

  // Step 2: Participant Selection
  const renderStep2Participant = () => {
    const isPlayerProp = pick.betCategory === 'player_prop';
    const needsTeam = ['spread', 'moneyline', 'team_prop'].includes(pick.betCategory);

    return (
      <div className="space-y-6">
        {/* Player Prop Mode */}
        {isPlayerProp && (
          <>
            {/* Player search/input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Player <span className="text-red-500">*</span>
              </Label>
              {entryMode === 'search' ? (
                loading.teams ? (
                  <SkeletonField label={false} />
                ) : (
                  <SmartSearch
                    searchType="players"
                    sport={pick.sport}
                    value={pick.player}
                    placeholder="Search for a player..."
                    onSelect={(item) => {
                      // V1.1: Players API returns team name, not team_id
                      // Team ID is not available from raw_props player search
                      updatePick({
                        player: item.name,
                        playerId: item.id,
                        team: item.team || '',
                      });
                    }}
                    onClear={() => {
                      updatePick({
                        player: '',
                        playerId: '',
                        team: '',
                        teamId: '',
                      });
                    }}
                  />
                )
              ) : (
                <Input
                  value={pick.player}
                  onChange={(e) => updatePick({ player: e.target.value })}
                  placeholder="e.g., LeBron James"
                  className={errors.player ? 'border-red-500' : ''}
                />
              )}
              {errors.player && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.player}
                </p>
              )}
              {pick.team && (
                <p className="text-xs text-green-600">Team: {pick.team}</p>
              )}
            </div>

            {/* Stat Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Stat Type <span className="text-red-500">*</span>
              </Label>
              {loading.statTypes ? (
                <SkeletonField label={false} />
              ) : statTypes.length > 0 ? (
                <Select
                  value={pick.statType}
                  onValueChange={(value) => updatePick({ statType: value })}
                >
                  <SelectTrigger className={errors.statType ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select stat type" />
                  </SelectTrigger>
                  <SelectContent>
                    {statTypes.map(st => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={pick.statType}
                  onChange={(e) => updatePick({ statType: e.target.value.toUpperCase() })}
                  placeholder="e.g., PTS, REB, AST"
                  className={errors.statType ? 'border-red-500' : ''}
                />
              )}
              {errors.statType && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.statType}
                </p>
              )}
            </div>
          </>
        )}

        {/* Team Selection Mode */}
        {needsTeam && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Team <span className="text-red-500">*</span>
            </Label>
            {entryMode === 'search' ? (
              loading.teams ? (
                <SkeletonField label={false} />
              ) : teams.length > 0 ? (
                <Select
                  value={pick.team}
                  onValueChange={(value) => {
                    const team = teams.find(t => t.name === value);
                    updatePick({
                      team: value,
                      teamId: team?.id || '',
                    });
                  }}
                >
                  <SelectTrigger className={errors.team ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.name}>
                        {team.name} {team.abbr && `(${team.abbr})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700">
                  No teams found. Switch to Manual mode.
                </div>
              )
            ) : (
              <Input
                value={pick.team}
                onChange={(e) => updatePick({ team: e.target.value })}
                placeholder="e.g., Los Angeles Lakers"
                className={errors.team ? 'border-red-500' : ''}
              />
            )}
            {errors.team && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.team}
              </p>
            )}
          </div>
        )}

        {/* Total - no participant needed, just skip to step 3 note */}
        {pick.betCategory === 'total' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              <Zap className="h-4 w-4 inline mr-1" />
              Total bets don't require a specific participant. Continue to enter the line.
            </p>
          </div>
        )}

        {/* Game selection (optional) */}
        {pick.sport && games.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <Label className="text-sm text-gray-500">Game (Optional)</Label>
            {loading.games ? (
              <SkeletonField label={false} />
            ) : (
              <Select
                value={pick.gameId}
                onValueChange={(value) => {
                  const game = games.find(g => g.id === value);
                  updatePick({
                    gameId: value,
                    gameLabel: game ? `${game.away_team} @ ${game.home_team}` : '',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Link to a specific game (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {games.map(game => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.away_team} @ {game.home_team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>
    );
  };

  // Step 3: Line & Odds
  const renderStep3Details = () => {
    const needsLine = ['spread', 'total', 'player_prop', 'team_prop'].includes(pick.betCategory);
    const needsDirection = ['total', 'player_prop'].includes(pick.betCategory);

    return (
      <div className="space-y-6">
        {/* Summary of what we're betting on */}
        <div className="p-3 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Betting on:</span>{' '}
            {pick.betCategory === 'player_prop'
              ? `${pick.player} - ${pick.statType}`
              : pick.team || 'Game Total'}
          </p>
        </div>

        {/* Line input */}
        {needsLine && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Line <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              step="0.5"
              value={pick.line}
              onChange={(e) => updatePick({ line: e.target.value })}
              placeholder={pick.betCategory === 'spread' ? 'e.g., -3.5' : 'e.g., 24.5'}
              className={errors.line ? 'border-red-500' : ''}
            />
            {errors.line && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.line}
              </p>
            )}
          </div>
        )}

        {/* Direction (Over/Under) */}
        {needsDirection && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Direction <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              {DIRECTIONS.map(dir => (
                <Button
                  key={dir}
                  type="button"
                  variant={pick.direction === dir ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => updatePick({ direction: dir })}
                >
                  {dir.charAt(0).toUpperCase() + dir.slice(1)}
                </Button>
              ))}
            </div>
            {errors.direction && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.direction}
              </p>
            )}
          </div>
        )}

        {/* Odds input */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Odds <span className="text-red-500">*</span>
          </Label>
          <Input
            type="text"
            value={pick.odds}
            onChange={(e) => updatePick({ odds: e.target.value })}
            placeholder="e.g., -110, +150"
            className={errors.odds ? 'border-red-500' : ''}
          />
          {errors.odds && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {errors.odds}
            </p>
          )}
          <p className="text-xs text-gray-400">Enter American odds (e.g., -110 or +150)</p>
        </div>

        {/* Add Leg button */}
        <div className="pt-4 border-t">
          <Button
            type="button"
            onClick={addLeg}
            disabled={!canProceed}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-2" />
            Add This Leg
          </Button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Add more legs or proceed to review
          </p>
        </div>
      </div>
    );
  };

  // Step 4: Review & Submit
  const renderStep4Review = () => (
    <div className="space-y-6">
      {/* Capper selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Capper</Label>
        {loading.cappers ? (
          <SkeletonField label={false} />
        ) : cappers.length > 0 ? (
          <Select value={selectedCapper} onValueChange={setSelectedCapper}>
            <SelectTrigger>
              <SelectValue placeholder="Select capper" />
            </SelectTrigger>
            <SelectContent>
              {cappers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            No cappers available. Please refresh or contact support.
          </div>
        )}
      </div>

      {/* Legs summary */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Legs ({legs.length})
        </Label>
        {legs.length === 0 ? (
          <div className="p-4 border-2 border-dashed rounded-md text-center text-gray-400">
            No legs added yet. Go back to add legs.
          </div>
        ) : (
          <div className="space-y-2">
            {legs.map((leg) => (
              <div
                key={leg.id}
                className="p-3 border rounded-md flex justify-between items-center"
              >
                <div>
                  <p className="font-medium text-sm">
                    {buildSelectionString(leg)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {leg.sport} • {leg.bet_category} • {leg.odds}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLeg(leg.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit button */}
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={loading.submitting || legs.length === 0 || !selectedCapper}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {loading.submitting ? (
          <>
            <Spinner className="h-4 w-4 mr-2" />
            Submitting...
          </>
        ) : (
          <>
            <Check className="h-4 w-4 mr-2" />
            Submit {legs.length > 1 ? `${legs.length}-Leg Parlay` : 'Pick'}
          </>
        )}
      </Button>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Submit Pick</h1>
          <p className="text-slate-400">Build your bet step by step</p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <Stepper
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={(stepId) => {
              if (completedSteps.includes(stepId) || stepId <= currentStep) {
                setCurrentStep(stepId);
              }
            }}
          />
        </div>

        {/* Main Card */}
        <Card className="p-6 bg-white shadow-xl rounded-xl">
          {/* Step title */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {WIZARD_STEPS[currentStep - 1]?.title}
            </h2>
            <p className="text-sm text-gray-500">
              {WIZARD_STEPS[currentStep - 1]?.description}
            </p>
          </div>

          {/* Step content */}
          {renderStepContent()}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>

            {currentStep < 4 && (
              <Button
                type="button"
                onClick={goNext}
                disabled={!canProceed}
              >
                {currentStep === 3 ? 'Review' : 'Next'}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </Card>

        {/* Legs sidebar preview */}
        {legs.length > 0 && (
          <Card className="mt-4 p-4 bg-slate-800 border-slate-700">
            <p className="text-sm text-slate-400 mb-2">
              Current ticket: {legs.length} leg{legs.length > 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {legs.map(leg => (
                <Badge key={leg.id} variant="secondary" className="text-xs">
                  {leg.player_name || leg.team || 'Leg'}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
