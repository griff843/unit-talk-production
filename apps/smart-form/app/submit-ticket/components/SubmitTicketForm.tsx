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
  CAPPER_OPTIONS,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ticketFormSchema as any),
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

        // Use fallback data only if API is completely unavailable
        setCappers([
          { id: 'fallback-1', name: 'Mike Johnson', active: true },
          { id: 'fallback-2', name: 'Sarah Wilson', active: true },
          { id: 'fallback-3', name: 'David Chen', active: true },
        ]);

        setError(`API error: ${err.message} (using fallback data)`);
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

      const ticketData = {
        capper_id: selectedCapper.id,
        sport: data.sport as string,
        ticket_type: data.ticket_type as string,
        selections: legs.map(leg => ({
          sport: leg.sport,
          stat_type: leg.prop_type || 'unknown',
          line: parseFloat(leg.line || '0') || 0,
          leg_odds: parseFloat(leg.odds || '0') || 0,
          source: 'manual' as const,
          selection: (leg as any).selection || ('over' as 'over' | 'under' | 'yes' | 'no'),
          confidence: (data.confidence_level || 7) / 10,
        })),
        total_units: data.unit_size,
        notes: `Risk: $${data.risk_amount}, Confidence: ${data.confidence_level}/10`,
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
      <div className="w-full max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-lg">
            Submit Sports Betting Ticket
          </h1>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full shadow-lg border-2 border-blue-400 bg-white flex items-center justify-center">
            <span className="text-blue-600 font-bold text-lg">UT</span>
          </div>
          <span className="text-xl font-bold text-blue-100 tracking-wide">Unit Talk</span>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-8">
        {/* Main Form Section */}
        <div className="flex-1 space-y-8">
          {/* Ticket Configuration Card */}
          <Card className="p-6 bg-white/95 shadow-2xl rounded-2xl border-0">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Ticket Configuration</h2>
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

                {/* Risk & Unit Size Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Risk Amount ($)</label>
                    <Input
                      type="number"
                      min={LIMITS.MIN_BET}
                      max={LIMITS.MAX_BET}
                      step="0.01"
                      className="bg-white text-gray-900"
                      {...form.register('risk_amount', { valueAsNumber: true })}
                    />
                    <p className="text-xs text-gray-500">
                      Min: ${LIMITS.MIN_BET} | Max: ${LIMITS.MAX_BET}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Unit Size</label>
                    <Input
                      type="number"
                      min={0.5}
                      max={5}
                      step={0.5}
                      className="bg-white text-gray-900 w-24"
                      {...form.register('unit_size', { valueAsNumber: true })}
                    />
                    <p className="text-xs text-gray-500">Min: 0.5 | Max: 5 | Step: 0.5</p>
                  </div>
                </div>

                {/* Odds Format & Auto Parlay */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Odds Format</label>
                    <Select
                      name="odds_format"
                      onValueChange={value => form.setValue('odds_format', value as OddsFormat)}
                      value={form.watch('odds_format')}
                    >
                      <SelectTrigger className="bg-white text-gray-900">
                        <SelectValue placeholder="Select Format" />
                      </SelectTrigger>
                      <SelectContent>
                        {ODDS_FORMAT.map(format => (
                          <SelectItem key={format} value={format} className="text-gray-900">
                            {format}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2 h-full">
                    <Switch
                      id="auto_parlay"
                      checked={form.watch('auto_parlay')}
                      onCheckedChange={checked => form.setValue('auto_parlay', checked)}
                    />
                    <label htmlFor="auto_parlay" className="text-sm font-medium text-gray-700">
                      Auto Parlay
                    </label>
                  </div>
                </div>

                {/* Confidence & Tier Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Confidence Level</label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      className="bg-white text-gray-900"
                      {...form.register('confidence_level', { valueAsNumber: true })}
                    />
                    <p className="text-xs text-gray-500">Rate from 1-10</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">User Tier</label>
                    <Select
                      name="user_tier"
                      onValueChange={value =>
                        form.setValue('user_tier', value as 'standard' | 'vip' | 'elite')
                      }
                      value={form.watch('user_tier')}
                    >
                      <SelectTrigger className="bg-white text-gray-900">
                        <SelectValue placeholder="Select Tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free" className="text-gray-900">
                          Free
                        </SelectItem>
                        <SelectItem value="vip" className="text-gray-900">
                          VIP
                        </SelectItem>
                        <SelectItem value="vip_plus" className="text-gray-900">
                          VIP+
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </form>
            </Form>
          </Card>

          {/* Ticket Legs Card */}
          <Card className="p-6 bg-white/95 shadow-2xl rounded-2xl border-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Ticket Legs</h2>
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
                    team: selectedGame?.home_team?.name || '',
                    opponent: selectedGame?.away_team?.name || '',
                    line: '',
                    odds: '',
                    game_date: form.watch('game_date') || new Date().toISOString().split('T')[0],
                    status: 'open',
                    game_id: selectedGame?.id || '',
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
              className="w-full py-4 text-lg font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-xl shadow-lg mt-6"
              disabled={isSubmitting || legs.length === 0}
              onClick={form.handleSubmit(onSubmit)}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Submitting...
                </>
              ) : legs.length === 0 ? (
                'Add Legs to Submit'
              ) : (
                'Submit Ticket'
              )}
            </Button>
          </Card>
        </div>

        {/* Sticky Summary Sidebar */}
        <div className="w-full lg:w-96 lg:sticky lg:top-10 space-y-6">
          {/* Ticket Summary Card */}
          <Card className="p-6 bg-gradient-to-br from-blue-800 to-blue-600 text-white shadow-xl rounded-2xl border-0">
            <h3 className="text-lg font-bold mb-4 tracking-wide">Ticket Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between border-b border-blue-500/30 pb-2">
                <span className="font-medium">Type:</span>
                <span className="capitalize">{form.watch('ticket_type')}</span>
              </div>
              <div className="flex justify-between border-b border-blue-500/30 pb-2">
                <span className="font-medium">Sport:</span>
                <span>{form.watch('sport')}</span>
              </div>
              <div className="flex justify-between border-b border-blue-500/30 pb-2">
                <span className="font-medium">Risk:</span>
                <span>{formatCurrency(form.watch('risk_amount'))}</span>
              </div>
              <div className="flex justify-between border-b border-blue-500/30 pb-2">
                <span className="font-medium">To Win:</span>
                <span>{formatCurrency(form.watch('potential_payout'))}</span>
              </div>
              <div className="flex justify-between border-b border-blue-500/30 pb-2">
                <span className="font-medium">Legs:</span>
                <span>{legs.length}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="font-medium">Confidence:</span>
                <span>{form.watch('confidence_level')}/10</span>
              </div>
            </div>

            {/* Betting Limits Section */}
            <div className="mt-6 pt-4 border-t border-blue-500">
              <h4 className="text-sm font-semibold mb-3">Betting Limits</h4>
              <div className="text-sm text-blue-200 space-y-2">
                <div className="flex justify-between">
                  <span>Min Bet:</span>
                  <span>{formatCurrency(LIMITS.MIN_BET)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Bet:</span>
                  <span>{formatCurrency(LIMITS.MAX_BET)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Payout:</span>
                  <span>{formatCurrency(LIMITS.MAX_PAYOUT)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <span className="text-xs text-blue-200">
                All tickets are securely processed via API
              </span>
            </div>
          </Card>

          {/* Quick Actions Card */}
          <Card className="p-6 bg-white shadow-xl rounded-2xl border-0">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Quick Actions</h3>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={legs.length === 0}
              >
                💾 Save as Template
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={legs.length === 0}
              >
                📋 Copy Ticket
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={legs.length === 0}
              >
                🔄 Clear All
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
