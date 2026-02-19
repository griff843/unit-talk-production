'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { LegCard } from './LegCard';
import {
  apiClient,
  fetchCappers,
  fetchTeams,
  fetchGames,
  searchTeams,
  searchPlayers,
  fetchProps,
  Capper as DBCapper,
  DBTeam as Team,
  Game as DBGame,
} from '@/lib/api-client';
import {
  // CAPPER_OPTIONS removed - V1.1 COMPLIANCE: cappers from API only
  SPORTS,
  TICKET_TYPES,
  ODDS_FORMAT,
  TicketFormData,
  TicketLeg,
  ticketFormSchema,
  Sport,
  TicketType,
  OddsFormat,
} from '../types';
import { Card } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import {
  calculatePotentialPayout,
  validateBetLimits,
  formatCurrency,
  getTimezoneOffset,
} from '@/lib/betting-utils';

// Use imported types from queries
type Capper = DBCapper;

// Betting limits configuration
const LIMITS = {
  MIN_BET: 1,
  MAX_BET: 10000,
  MAX_PAYOUT: 100000,
  MAX_LEGS: {
    parlay: 12,
    teaser: 6,
    round_robin: 8,
  },
} as const;

export function SubmitTicketForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [legs, setLegs] = useState<TicketLeg[]>([]);
  const [cappers, setCappers] = useState<Capper[]>([]);
  const [isLoadingCappers, setIsLoadingCappers] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const [availableProps, setAvailableProps] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      capper: 'Griff',
      ticket_type: 'single',
      unit_size: 1,
      risk_amount: 10,
      potential_payout: 0,
      odds_format: 'AMERICAN',
      auto_parlay: true,
      sport: 'NBA',
      game_date: new Date().toISOString().split('T')[0],
      confidence_level: 7,
      user_tier: 'vip',
      timestamp: new Date().toISOString(),
      timezone: getTimezoneOffset(),
      status: 'pending',
    },
  });

  // Fetch cappers with error handling using API client
  useEffect(() => {
    const loadCappers = async () => {
      try {
        setIsLoadingCappers(true);
        setError(null);

        console.log('🔄 Attempting to fetch cappers from API...');
        const cappersData = await fetchCappers();
        console.log('✅ Cappers data received:', cappersData);

        setCappers(cappersData);

        if (cappersData.length === 0) {
          console.warn('⚠️ No cappers found - API returned empty array');
          setError('No cappers found. Please contact support.');
        } else {
          console.log(`✅ Successfully loaded ${cappersData.length} cappers`);
        }
      } catch (err: any) {
        console.error('❌ Error fetching cappers:', err);

        // V1.1 COMPLIANCE: NO FALLBACK DATA - Fail closed
        // SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036: Mock data removed
        setCappers([]);
        setError(`Failed to load cappers: ${err.message}. Please refresh or contact support.`);
      } finally {
        setIsLoadingCappers(false);
      }
    };

    loadCappers().catch(console.error);
  }, []);

  // Load teams when sport changes
  const sportValue = form.watch('sport');
  useEffect(() => {
    const loadTeams = async () => {
      if (!sportValue) return;

      try {
        setIsLoadingTeams(true);
        const teamsData = await fetchTeams(sportValue);
        setTeams(teamsData);
      } catch (err) {
        console.error('Error fetching teams:', err);
        // Teams query has built-in fallback
        setTeams([]);
      } finally {
        setIsLoadingTeams(false);
      }
    };

    loadTeams().catch(console.error);
  }, [sportValue]);

  // Load games when sport and date change
  const gameDate = form.watch('game_date');
  useEffect(() => {
    const loadGames = async () => {
      if (!sportValue || !gameDate) return;

      try {
        setIsLoadingGames(true);
        // Load games for selected date +/- 3 days
        const startDate = new Date(gameDate);
        startDate.setDate(startDate.getDate() - 3);
        const endDate = new Date(gameDate);
        endDate.setDate(endDate.getDate() + 3);

        const gamesData = await fetchGames(
          sportValue,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );
        setGames(gamesData || []);
      } catch (err) {
        console.error('Error fetching games:', err);
        setGames([]);
      } finally {
        setIsLoadingGames(false);
      }
    };

    loadGames().catch(console.error);
  }, [sportValue, gameDate]);

  // Watch form values for calculations
  const watchRiskAmount = form.watch('risk_amount');
  const watchTicketType = form.watch('ticket_type');

  // Update potential payout when risk or legs change
  useEffect(() => {
    const payout = calculatePotentialPayout(watchRiskAmount, legs, watchTicketType);
    form.setValue('potential_payout', payout);
  }, [watchRiskAmount, legs, watchTicketType, form]);

  // SMARTFORM-UX-CRITICAL-FIXPACK-025: Auto Parlay - switch to parlay when auto_parlay ON and >= 2 legs
  const watchAutoParlay = form.watch('auto_parlay');
  useEffect(() => {
    if (watchAutoParlay && legs.length >= 2) {
      // Auto-switch to parlay
      if (watchTicketType !== 'parlay') {
        form.setValue('ticket_type', 'parlay');
      }
    } else if (legs.length <= 1 && watchTicketType === 'parlay' && watchAutoParlay) {
      // Switch back to single when only 1 leg
      form.setValue('ticket_type', 'single');
    }
  }, [watchAutoParlay, legs.length, watchTicketType, form]);

  // V1.1 COMPLIANCE: Sync legs state with form field for validation
  useEffect(() => {
    // Convert legs state to form-compatible format
    const formLegs = legs.map(leg => ({
      id: leg.id,
      sport: leg.sport || 'NBA',
      market_type: leg.market_type || 'main',
      bet_type: leg.bet_category || leg.bet_type || 'spread',
      game_id: leg.game_id,
      team: leg.team,
      opponent: leg.opponent,
      player_name: leg.player_name,
      prop_type: leg.prop_type,
      line: leg.line,
      odds: leg.odds,
      game_date: leg.game_date,
      game_time: leg.game_time,
      status: leg.status || 'open',
    }));
    form.setValue('legs', formLegs as any);
  }, [legs, form]);

  // SMARTFORM-UX-CRITICAL-FIXPACK-025: Validate required fields for legs
  const validateLegs = (): { valid: boolean; message: string } => {
    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];

      // Player Prop requires direction
      if (leg.bet_category === 'player_prop' && leg.prop_type && !leg.direction) {
        return {
          valid: false,
          message: `Leg ${i + 1}: Direction (Over/Under) required for player props`,
        };
      }

      // Total requires direction
      if (leg.bet_category === 'total' && !leg.direction) {
        return {
          valid: false,
          message: `Leg ${i + 1}: Direction (Over/Under) required for total bets`,
        };
      }

      // Spread requires team selection
      if (leg.bet_category === 'spread' && !leg.team) {
        return { valid: false, message: `Leg ${i + 1}: Team selection required for spread bets` };
      }

      // Team Prop (team_total) requires team, line, and direction
      if (leg.bet_category === 'team_prop') {
        if (!leg.team) {
          return { valid: false, message: `Leg ${i + 1}: Team selection required for team props` };
        }
        if (leg.prop_type === 'team_total') {
          if (!leg.line) {
            return { valid: false, message: `Leg ${i + 1}: Line required for team total` };
          }
          if (!leg.direction) {
            return { valid: false, message: `Leg ${i + 1}: Direction required for team total` };
          }
        }
      }
    }
    return { valid: true, message: '' };
  };

  const onSubmit = async (data: TicketFormData) => {
    try {
      setIsSubmitting(true);

      // Validate legs
      if (legs.length === 0) {
        toast({
          title: 'Validation Error',
          description: 'Please add at least one leg to the ticket',
          variant: 'destructive',
        });
        return;
      }

      // Validate max legs
      const maxLegs = LIMITS.MAX_LEGS[data.ticket_type as keyof typeof LIMITS.MAX_LEGS] || 1;
      if (legs.length > maxLegs) {
        toast({
          title: 'Validation Error',
          description: `Maximum ${maxLegs} legs allowed for ${data.ticket_type} tickets`,
          variant: 'destructive',
        });
        return;
      }

      // SMARTFORM-UX-CRITICAL-FIXPACK-025: Validate leg required fields
      const legValidation = validateLegs();
      if (!legValidation.valid) {
        toast({
          title: 'Validation Error',
          description: legValidation.message,
          variant: 'destructive',
        });
        return;
      }

      // Validate bet limits
      const limitsCheck = validateBetLimits(
        data.risk_amount,
        data.potential_payout,
        LIMITS.MIN_BET,
        LIMITS.MAX_BET,
        LIMITS.MAX_PAYOUT
      );

      if (!limitsCheck.valid) {
        toast({
          title: 'Validation Error',
          description: limitsCheck.message,
          variant: 'destructive',
        });
        return;
      }

      // Convert legacy form data to new API format
      // Find capper ID from selected capper name
      const selectedCapper = cappers.find(c => c.name === data.capper);
      if (!selectedCapper) {
        toast({
          title: 'Error',
          description: 'Selected capper not found. Please select a valid capper.',
          variant: 'destructive',
        });
        return;
      }

      // V1.1 COMPLIANCE: Updated payload with all required fields per EMBED-TRUTH-FIX-031
      const ticketData = {
        capper_id: selectedCapper.id,
        sport: data.sport as string,
        ticket_type: data.ticket_type as string,
        selections: legs.map(leg => {
          // V1.1: Build selection string based on bet type
          let selectionStr = '';
          if (leg.bet_category === 'player_prop') {
            // Player prop: "Jaylen Brown over 24.5 PTS"
            selectionStr = `${leg.player_name || 'Unknown'} ${leg.direction || 'over'} ${leg.line || '0'} ${leg.prop_type || 'PTS'}`;
          } else if (leg.bet_category === 'spread') {
            // Spread: "Celtics -3.5"
            const lineValue = parseFloat(leg.line || '0');
            selectionStr = `${leg.team || 'Team'} ${lineValue >= 0 ? '+' : ''}${lineValue}`;
          } else if (leg.bet_category === 'total') {
            // Total: "over 225.5"
            selectionStr = `${leg.direction || 'over'} ${leg.line || '0'}`;
          } else if (leg.bet_category === 'moneyline') {
            // Moneyline: "Celtics"
            selectionStr = leg.team || 'Team';
          } else {
            // Fallback
            selectionStr = leg.team || leg.player_name || 'Selection';
          }

          return {
            sport: leg.sport,
            // V1.1: bet_type is REQUIRED per EMBED-TRUTH-FIX-031
            bet_type: leg.bet_category || 'moneyline',
            stat_type: leg.prop_type || leg.bet_category || 'unknown',
            line: parseFloat(leg.line || '0') || 0,
            leg_odds: parseInt(leg.odds?.replace(/[^-\d]/g, '') || '0', 10) || -110,
            source: 'manual' as const,
            // V1.1: selection is the readable bet description
            selection: selectionStr,
            // V1.1: direction for over/under bets
            direction: leg.direction?.toLowerCase() as 'over' | 'under' | undefined,
            // V1.1: team for spread/team_prop
            team: leg.team || undefined,
            // V1.1: player_name for player props
            player_name: leg.player_name || undefined,
            confidence: Math.round((data.confidence_level || 7)),
          };
        }),
        total_units: data.unit_size,
        notes: `Units: ${data.unit_size}U, Confidence: ${data.confidence_level}/10`,
      };

      try {
        const result = (await apiClient.submitTicket(ticketData)) as any;

        toast({
          title: 'Success',
          description: `Ticket submitted successfully. Bet Slip ID: ${result?.bet_slip_id || 'Generated'}`,
          variant: 'default',
        });
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to submit ticket',
          variant: 'destructive',
        });
        return;
      }

      form.reset();
      setLegs([]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addLeg = (leg: TicketLeg) => {
    setLegs([...legs, leg]);
  };

  const removeLeg = (index: number) => {
    setLegs(legs.filter((_, i) => i !== index));
  };

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a183d] to-[#1b2a4e] flex flex-col items-center justify-center py-10 px-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md w-full text-center">
          <h2 className="text-red-500 text-lg font-semibold mb-2">Error</h2>
          <p className="text-red-200">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a183d] to-[#1b2a4e] flex flex-col items-center py-10 px-4">
      {/* Header Section */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          Submit Pick
        </h1>
        <div className="mt-3 md:mt-0 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">UT</span>
          </div>
          <span className="text-lg font-semibold text-slate-300">Unit Talk</span>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-8">
        {/* Main Form Section */}
        <div className="flex-1 space-y-8">
          {/* Pick Details Card */}
          <Card className="p-6 bg-white shadow-xl rounded-2xl border-0">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Pick Details</h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Capper & Type Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Capper</label>
                    <Select
                      name="capper"
                      onValueChange={value => form.setValue('capper', value)}
                      value={form.watch('capper')}
                      disabled={isLoadingCappers}
                    >
                      <SelectTrigger className="bg-white text-gray-900">
                        <SelectValue
                          placeholder={isLoadingCappers ? 'Loading...' : 'Select Capper'}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {cappers.map(capper => (
                          <SelectItem key={capper.id} value={capper.name} className="text-gray-900">
                            {capper.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isLoadingCappers && (
                      <p className="text-xs text-blue-600">Loading cappers...</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Ticket Type</label>
                    <Select
                      name="ticket_type"
                      onValueChange={value => form.setValue('ticket_type', value as TicketType)}
                      value={form.watch('ticket_type')}
                    >
                      <SelectTrigger className="bg-white text-gray-900">
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_TYPES.map(type => (
                          <SelectItem key={type} value={type} className="text-gray-900">
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Sport & Date Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Sport</label>
                    <Select
                      name="sport"
                      onValueChange={value => form.setValue('sport', value as Sport)}
                      value={form.watch('sport')}
                    >
                      <SelectTrigger className="bg-white text-gray-900">
                        <SelectValue placeholder="Select Sport" />
                      </SelectTrigger>
                      <SelectContent>
                        {SPORTS.map(sport => (
                          <SelectItem key={sport} value={sport} className="text-gray-900">
                            {sport}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Game Date</label>
                    <div className="relative">
                      <DatePicker
                        selected={new Date(form.watch('game_date'))}
                        onChange={date =>
                          form.setValue('game_date', date?.toISOString().split('T')[0] || '')
                        }
                        className="w-full h-10 rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        dateFormat="MM/dd/yyyy"
                        placeholderText="Select date"
                      />
                    </div>
                  </div>
                </div>

                {/* Games Selection Section */}
                {games.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Available Games{' '}
                      {isLoadingGames && <span className="text-blue-600">(Loading...)</span>}
                    </label>
                    <Select
                      name="game"
                      onValueChange={value => {
                        const game = games.find(g => g.id === value);
                        setSelectedGame(game);
                        // Auto-load props for this game
                        if (game) {
                          apiClient
                            .fetchProps(sportValue, { gameId: game.id })
                            .then(props => {
                              setAvailableProps(props || []);
                            })
                            .catch(console.error);
                        }
                      }}
                      value={selectedGame?.id || ''}
                    >
                      <SelectTrigger className="bg-white text-gray-900">
                        <SelectValue placeholder="Select a game" />
                      </SelectTrigger>
                      <SelectContent>
                        {games.map(game => (
                          <SelectItem key={game.id} value={game.id} className="text-gray-900">
                            {game.home_team?.name || 'Home'} vs {game.away_team?.name || 'Away'} -{' '}
                            {new Date(game.game_date).toLocaleDateString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedGame && (
                      <p className="text-xs text-gray-500">
                        Selected: {selectedGame.home_team?.name || 'Home'} vs{' '}
                        {selectedGame.away_team?.name || 'Away'}
                        on {new Date(selectedGame.game_date).toLocaleDateString()} at{' '}
                        {selectedGame.game_time}
                      </p>
                    )}
                  </div>
                )}

                {/* Unit Size & Auto Parlay */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Units</label>
                    <Select
                      name="unit_size"
                      onValueChange={value => form.setValue('unit_size', parseFloat(value))}
                      value={form.watch('unit_size').toString()}
                    >
                      <SelectTrigger className="bg-white text-gray-900 w-32">
                        <SelectValue placeholder="Units" />
                      </SelectTrigger>
                      <SelectContent>
                        {[0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map(u => (
                          <SelectItem key={u} value={u.toString()} className="text-gray-900">
                            {u}U
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-3 h-full pt-6">
                    <Switch
                      id="auto_parlay"
                      checked={form.watch('auto_parlay')}
                      onCheckedChange={(checked: boolean) => form.setValue('auto_parlay', checked)}
                    />
                    <label htmlFor="auto_parlay" className="text-sm font-medium text-gray-700">
                      Auto Parlay
                    </label>
                  </div>
                </div>
              </form>
            </Form>
          </Card>

          {/* Legs Card */}
          <Card className="p-6 bg-white shadow-xl rounded-2xl border-0">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Legs</h2>
              <Button
                type="button"
                variant="outline"
                className="border-blue-400 text-blue-700 hover:bg-blue-50"
                onClick={() =>
                  addLeg({
                    id: crypto.randomUUID(),
                    sport: form.watch('sport') || 'NBA',
                    bet_category: 'spread',
                    market_type: 'pre_game',
                    prop_type: '',
                    player_name: '',
                    team: '',
                    opponent: selectedGame?.away_team?.name || '',
                    line: '',
                    odds: '',
                    game_date: form.watch('game_date') || new Date().toISOString().split('T')[0],
                    status: 'open',
                    game_id: selectedGame?.id || '',
                    // SMARTFORM-UX-CRITICAL-FIXPACK-025: Initialize direction
                    direction: undefined,
                  })
                }
              >
                + Add Leg
              </Button>
            </div>

            <div className="space-y-4">
              {legs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border-2 border-dashed">
                  <p className="text-lg font-medium">No legs added yet</p>
                  <p className="text-sm mt-1">Add a leg to start building your ticket</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {legs.map((leg, index) => (
                    <LegCard
                      key={leg.id}
                      leg={leg}
                      legIndex={index}
                      onRemove={() => removeLeg(index)}
                      onUpdate={updates => {
                        const newLegs = [...legs];
                        newLegs[index] = { ...newLegs[index], ...updates };
                        setLegs(newLegs);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full py-3 text-base font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md mt-6 transition-colors"
              disabled={isSubmitting || legs.length === 0}
              onClick={form.handleSubmit(onSubmit)}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Submitting...
                </>
              ) : legs.length === 0 ? (
                'Add Leg to Submit'
              ) : (
                `Submit ${legs.length === 1 ? 'Pick' : `${legs.length}-Leg Parlay`}`
              )}
            </Button>
          </Card>
        </div>

        {/* Sticky Summary Sidebar */}
        <div className="w-full lg:w-96 lg:sticky lg:top-10 space-y-6">
          {/* Ticket Summary Card - Streamlined */}
          <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl rounded-2xl border border-slate-700">
            <h3 className="text-lg font-bold mb-4 tracking-wide">Ticket Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-slate-600/50 pb-2">
                <span className="text-slate-400">Capper</span>
                <span className="font-semibold">{form.watch('capper') || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-600/50 pb-2">
                <span className="text-slate-400">Sport</span>
                <span className="font-semibold">{form.watch('sport')}</span>
              </div>
              <div className="flex justify-between border-b border-slate-600/50 pb-2">
                <span className="text-slate-400">Type</span>
                <span className="font-semibold capitalize">{form.watch('ticket_type')}</span>
              </div>
              <div className="flex justify-between border-b border-slate-600/50 pb-2">
                <span className="text-slate-400">Units</span>
                <span className="font-semibold text-green-400">{form.watch('unit_size')}U</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-slate-400">Legs</span>
                <span className="font-semibold text-blue-400">{legs.length}</span>
              </div>
            </div>
          </Card>

          {/* Quick Actions Card */}
          <Card className="p-4 bg-slate-800/50 shadow-xl rounded-2xl border border-slate-700">
            <div className="space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-700"
                disabled={legs.length === 0}
                onClick={() => {
                  setLegs([]);
                  form.reset();
                }}
              >
                Clear All
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
