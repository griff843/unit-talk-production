'use client';

/**
 * SportsbookManualEntry - Sprint SPRINT-SMARTFORM-Sportsbook-ManualEntry-UX-085
 *
 * Sportsbook-grade manual entry UI:
 * - Single page, two-column layout
 * - Bet type selector first (shows only relevant fields)
 * - Sticky bet slip panel with validation summary
 * - Compact leg cards with sport/type badges
 * - Keyboard shortcuts (Enter to add, Esc to clear)
 * - Combined odds and payout preview for parlays
 */

import { useState, useCallback, useMemo, useEffect, useRef, KeyboardEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Plus, Trash2, Check, AlertCircle, Copy, RefreshCw, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

import {
  submitTicketV3,
  generateBetSlipId,
  formatOdds,
  TEST_USER_ID,
  type V3SubmitTicketResult,
  type Selection,
  type TicketType,
} from '@/lib/v3';

// ============================================================================
// CONSTANTS
// ============================================================================

const SPORTS = [
  { code: 'NBA', name: 'NBA', color: 'bg-orange-500' },
  { code: 'NFL', name: 'NFL', color: 'bg-green-600' },
  { code: 'MLB', name: 'MLB', color: 'bg-red-600' },
  { code: 'NHL', name: 'NHL', color: 'bg-blue-600' },
  { code: 'NCAAB', name: 'NCAAB', color: 'bg-purple-600' },
  { code: 'NCAAF', name: 'NCAAF', color: 'bg-amber-600' },
  { code: 'UFC', name: 'UFC', color: 'bg-red-700' },
  { code: 'SOCCER', name: 'Soccer', color: 'bg-emerald-600' },
] as const;

interface BetTypeConfig {
  key: string;
  label: string;
  shortLabel: string;
  requiresLine: boolean;
  requiresPlayer: boolean;
  requiresPropType: boolean;
  outcomeType: 'team' | 'over_under' | 'yes_no';
  sports?: string[];
  color: string;
}

const BET_TYPES: BetTypeConfig[] = [
  {
    key: 'moneyline',
    label: 'Moneyline',
    shortLabel: 'ML',
    requiresLine: false,
    requiresPlayer: false,
    requiresPropType: false,
    outcomeType: 'team',
    color: 'bg-slate-600',
  },
  {
    key: 'spread',
    label: 'Spread',
    shortLabel: 'SPR',
    requiresLine: true,
    requiresPlayer: false,
    requiresPropType: false,
    outcomeType: 'team',
    color: 'bg-indigo-600',
  },
  {
    key: 'total',
    label: 'Game Total',
    shortLabel: 'O/U',
    requiresLine: true,
    requiresPlayer: false,
    requiresPropType: false,
    outcomeType: 'over_under',
    color: 'bg-cyan-600',
  },
  {
    key: 'team_total',
    label: 'Team Total',
    shortLabel: 'TT',
    requiresLine: true,
    requiresPlayer: false,
    requiresPropType: false,
    outcomeType: 'over_under',
    color: 'bg-teal-600',
  },
  {
    key: 'player_prop',
    label: 'Player Prop',
    shortLabel: 'PROP',
    requiresLine: true,
    requiresPlayer: true,
    requiresPropType: true,
    outcomeType: 'over_under',
    color: 'bg-violet-600',
  },
  {
    key: 'nrfi',
    label: 'NRFI',
    shortLabel: 'NRFI',
    requiresLine: false,
    requiresPlayer: false,
    requiresPropType: false,
    outcomeType: 'yes_no',
    sports: ['MLB'],
    color: 'bg-rose-600',
  },
  {
    key: 'yrfi',
    label: 'YRFI',
    shortLabel: 'YRFI',
    requiresLine: false,
    requiresPlayer: false,
    requiresPropType: false,
    outcomeType: 'yes_no',
    sports: ['MLB'],
    color: 'bg-pink-600',
  },
  {
    key: 'puck_line',
    label: 'Puck Line',
    shortLabel: 'PL',
    requiresLine: true,
    requiresPlayer: false,
    requiresPropType: false,
    outcomeType: 'team',
    sports: ['NHL'],
    color: 'bg-sky-600',
  },
];

const PROP_TYPES_BY_SPORT: Record<string, string[]> = {
  NBA: ['PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'PRA', 'PR', 'PA', 'RA', 'DD', 'TD'],
  NFL: ['Pass YDS', 'Pass TDs', 'Rush YDS', 'Rec YDS', 'Receptions', 'INT', 'TD Scorer'],
  MLB: ['Hits', 'Runs', 'RBIs', 'HRs', 'Total Bases', 'Strikeouts', 'Earned Runs'],
  NHL: ['Goals', 'Assists', 'Points', 'Shots', 'Saves'],
  NCAAB: ['PTS', 'REB', 'AST', 'PRA'],
  NCAAF: ['Pass YDS', 'Rush YDS', 'Rec YDS', 'TDs'],
  UFC: ['Significant Strikes', 'Takedowns'],
  SOCCER: ['Goals', 'Assists', 'Shots'],
};

const PROVIDERS = [
  { code: 'fanduel', name: 'FanDuel', short: 'FD' },
  { code: 'draftkings', name: 'DraftKings', short: 'DK' },
  { code: 'betmgm', name: 'BetMGM', short: 'MGM' },
  { code: 'caesars', name: 'Caesars', short: 'CZR' },
  { code: 'espn_bet', name: 'ESPN BET', short: 'ESPN' },
  { code: 'bet365', name: 'Bet365', short: '365' },
  { code: 'pinnacle', name: 'Pinnacle', short: 'PIN' },
];

// ============================================================================
// TYPES
// ============================================================================

interface ManualLeg {
  id: string;
  sport: string;
  matchup: string;
  team?: string;
  playerName?: string;
  propType?: string;
  betType: string;
  selection: Selection;
  line?: number;
  odds: number;
  provider: string;
}

interface BuilderState {
  sport: string;
  betType: string;
  matchup: string;
  team: string;
  playerName: string;
  propType: string;
  line: string;
  odds: string;
  selection: Selection | '';
  provider: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function calculateCombinedOdds(legs: ManualLeg[]): number {
  if (legs.length === 0) return 0;
  if (legs.length === 1) return legs[0].odds;

  // Convert American odds to decimal, multiply, convert back
  const decimalOdds = legs.map(leg => {
    if (leg.odds > 0) return leg.odds / 100 + 1;
    return 100 / Math.abs(leg.odds) + 1;
  });

  const combined = decimalOdds.reduce((acc, odd) => acc * odd, 1);

  // Convert back to American
  if (combined >= 2) return Math.round((combined - 1) * 100);
  return Math.round(-100 / (combined - 1));
}

function calculatePayout(stake: number, odds: number): number {
  if (odds > 0) return stake * (odds / 100);
  return stake * (100 / Math.abs(odds));
}

function formatLegCompact(leg: ManualLeg): string {
  const betType = BET_TYPES.find(bt => bt.key === leg.betType);
  const provider = PROVIDERS.find(p => p.code === leg.provider);

  if (leg.betType === 'player_prop' && leg.playerName) {
    const lineStr =
      leg.line !== undefined ? `${leg.selection === 'over' ? 'O' : 'U'}${leg.line}` : '';
    return `${leg.playerName} ${leg.propType} ${lineStr} ${formatOdds(leg.odds)} (${provider?.short || leg.provider})`;
  }

  if (leg.betType === 'moneyline') {
    return `${leg.team || leg.matchup} ML ${formatOdds(leg.odds)} (${provider?.short || leg.provider})`;
  }

  if (leg.betType === 'nrfi' || leg.betType === 'yrfi') {
    return `${leg.matchup} ${betType?.shortLabel} ${formatOdds(leg.odds)} (${provider?.short || leg.provider})`;
  }

  if (leg.betType === 'team_total' && leg.team) {
    const lineStr =
      leg.line !== undefined ? `${leg.selection === 'over' ? 'O' : 'U'}${leg.line}` : '';
    return `${leg.team} TT ${lineStr} ${formatOdds(leg.odds)} (${provider?.short || leg.provider})`;
  }

  // Spread, total, puck_line
  const lineStr = leg.line !== undefined ? (leg.line > 0 ? `+${leg.line}` : `${leg.line}`) : '';
  const selStr = leg.selection === 'over' ? 'O' : leg.selection === 'under' ? 'U' : '';

  return `${leg.team || leg.matchup} ${betType?.shortLabel} ${selStr}${lineStr} ${formatOdds(leg.odds)} (${provider?.short || leg.provider})`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SportsbookManualEntry() {
  const { toast } = useToast();
  const builderRef = useRef<HTMLDivElement>(null);

  // Ticket state
  const [legs, setLegs] = useState<ManualLeg[]>([]);
  const [stake, setStake] = useState(1);
  const [betSlipId, setBetSlipId] = useState(generateBetSlipId());
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<V3SubmitTicketResult | null>(null);

  // Builder state
  const [builder, setBuilder] = useState<BuilderState>({
    sport: 'NBA',
    betType: 'moneyline',
    matchup: '',
    team: '',
    playerName: '',
    propType: '',
    line: '',
    odds: '',
    selection: '',
    provider: 'fanduel',
  });

  // Derived state
  const ticketType: TicketType = legs.length > 1 ? 'parlay' : 'single';
  const combinedOdds = calculateCombinedOdds(legs);
  const potentialPayout = calculatePayout(stake, combinedOdds);

  // Available bet types for selected sport
  const availableBetTypes = useMemo(() => {
    return BET_TYPES.filter(bt => !bt.sports || bt.sports.includes(builder.sport));
  }, [builder.sport]);

  // Current bet type config
  const currentBetType = useMemo(() => {
    return BET_TYPES.find(bt => bt.key === builder.betType);
  }, [builder.betType]);

  // Prop types for selected sport
  const propTypes = useMemo(() => {
    return PROP_TYPES_BY_SPORT[builder.sport] || [];
  }, [builder.sport]);

  // Validation errors
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!builder.matchup.trim()) errors.push('Matchup required');
    if (!builder.odds.trim()) errors.push('Odds required');

    if (currentBetType?.outcomeType === 'team' && !builder.team.trim()) {
      errors.push('Team required');
    }

    if (currentBetType?.requiresLine && !builder.line.trim()) {
      errors.push('Line required');
    }

    if (currentBetType?.requiresPlayer && !builder.playerName.trim()) {
      errors.push('Player required');
    }

    if (currentBetType?.requiresPropType && !builder.propType.trim()) {
      errors.push('Stat type required');
    }

    if (!builder.selection) errors.push('Selection required');

    return errors;
  }, [builder, currentBetType]);

  const canAddLeg = validationErrors.length === 0;

  // Update builder when sport changes
  useEffect(() => {
    const newBetTypes = BET_TYPES.filter(bt => !bt.sports || bt.sports.includes(builder.sport));
    if (!newBetTypes.find(bt => bt.key === builder.betType)) {
      setBuilder(prev => ({ ...prev, betType: 'moneyline', selection: '' }));
    }
  }, [builder.sport, builder.betType]);

  // Reset selection when bet type changes
  useEffect(() => {
    setBuilder(prev => ({ ...prev, selection: '' }));
  }, [builder.betType]);

  // Add leg
  const addLeg = useCallback(() => {
    if (!canAddLeg) return;

    const newLeg: ManualLeg = {
      id: crypto.randomUUID(),
      sport: builder.sport,
      matchup: builder.matchup,
      team: builder.team || undefined,
      playerName: builder.playerName || undefined,
      propType: builder.propType || undefined,
      betType: builder.betType,
      selection: builder.selection as Selection,
      line: builder.line ? parseFloat(builder.line) : undefined,
      odds: parseInt(builder.odds, 10),
      provider: builder.provider,
    };

    setLegs(prev => [...prev, newLeg]);

    // Reset builder (keep sport and provider)
    setBuilder(prev => ({
      ...prev,
      matchup: '',
      team: '',
      playerName: '',
      propType: '',
      line: '',
      odds: '',
      selection: '',
    }));

    toast({ title: 'Pick added' });
  }, [canAddLeg, builder, toast]);

  // Remove leg
  const removeLeg = useCallback((legId: string) => {
    setLegs(prev => prev.filter(l => l.id !== legId));
  }, []);

  // Clear builder
  const clearBuilder = useCallback(() => {
    setBuilder(prev => ({
      ...prev,
      matchup: '',
      team: '',
      playerName: '',
      propType: '',
      line: '',
      odds: '',
      selection: '',
    }));
  }, []);

  // Copy bet slip ID
  const copyBetSlipId = useCallback(() => {
    navigator.clipboard.writeText(betSlipId);
    toast({ title: 'Copied!' });
  }, [betSlipId, toast]);

  // Regenerate bet slip ID
  const regenerateBetSlipId = useCallback(() => {
    setBetSlipId(generateBetSlipId());
    toast({ title: 'New ID generated' });
  }, [toast]);

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && canAddLeg) {
        e.preventDefault();
        addLeg();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        clearBuilder();
      }
    },
    [canAddLeg, addLeg, clearBuilder]
  );

  // Submit ticket
  const handleSubmit = useCallback(async () => {
    if (legs.length === 0) {
      toast({ title: 'No picks', description: 'Add at least one pick', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const legPayloads = legs.map(leg => ({
        sport: leg.sport,
        bet_type: leg.betType,
        home_team:
          leg.matchup.split('@')[1]?.trim() || leg.matchup.split('vs')[1]?.trim() || leg.matchup,
        away_team: leg.matchup.split('@')[0]?.trim() || leg.matchup.split('vs')[0]?.trim() || '',
        matchup_text: leg.matchup,
        player_name: leg.playerName || null,
        prop_type: leg.propType || null,
        selection: leg.selection,
        line: leg.line,
        odds: leg.odds,
        provider: leg.provider,
      }));

      const result = await submitTicketV3({
        bet_slip_id: betSlipId,
        user_id: TEST_USER_ID,
        ticket_type: ticketType,
        total_stake: stake,
        legs: legPayloads as any,
        meta: {
          entry_mode: 'manual',
          source: 'sportsbook_manual_entry',
          form_version: 'v085',
        },
      });

      setSubmitResult(result);

      if (result.status === 'inserted') {
        toast({
          title: 'Ticket submitted!',
          description: `ID: ${result.ticket_id?.slice(0, 8)}...`,
        });
        setLegs([]);
        setBetSlipId(generateBetSlipId());
      } else if (result.status === 'exists') {
        toast({ title: 'Already exists', variant: 'default' });
      } else {
        const errMsg =
          result.error_details?.map(e => e.errors.join(', ')).join('; ') || 'Unknown error';
        toast({ title: 'Failed', description: errMsg, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }, [legs, betSlipId, ticketType, stake, toast]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#1a1d24]" onKeyDown={handleKeyDown}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Manual Entry</h1>
          <p className="text-slate-400 text-sm mt-1">
            Build your ticket • Enter to add • Esc to clear
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT: Builder Panel */}
          <div className="flex-1" ref={builderRef}>
            <Card className="bg-[#252830] border-slate-700 p-5">
              {/* Sport Selector */}
              <div className="mb-5">
                <Label className="text-slate-300 text-xs uppercase tracking-wide mb-2 block">
                  Sport
                </Label>
                <div className="flex flex-wrap gap-2">
                  {SPORTS.map(sport => (
                    <button
                      key={sport.code}
                      onClick={() => setBuilder(prev => ({ ...prev, sport: sport.code }))}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                        builder.sport === sport.code
                          ? `${sport.color} text-white`
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      )}
                    >
                      {sport.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bet Type Selector */}
              <div className="mb-5">
                <Label className="text-slate-300 text-xs uppercase tracking-wide mb-2 block">
                  Bet Type
                </Label>
                <div className="flex flex-wrap gap-2">
                  {availableBetTypes.map(bt => (
                    <button
                      key={bt.key}
                      onClick={() => setBuilder(prev => ({ ...prev, betType: bt.key }))}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                        builder.betType === bt.key
                          ? `${bt.color} text-white`
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      )}
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-700 my-5" />

              {/* Dynamic Fields Based on Bet Type */}
              <div className="space-y-4">
                {/* Matchup */}
                <div>
                  <Label className="text-slate-300 text-xs uppercase tracking-wide">
                    Matchup / Event
                  </Label>
                  <Input
                    value={builder.matchup}
                    onChange={e => setBuilder(prev => ({ ...prev, matchup: e.target.value }))}
                    placeholder="e.g., Lakers @ Celtics"
                    className="mt-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>

                {/* Team (for team-based bets) */}
                {currentBetType?.outcomeType === 'team' && (
                  <div>
                    <Label className="text-slate-300 text-xs uppercase tracking-wide">
                      Team Selection
                    </Label>
                    <Input
                      value={builder.team}
                      onChange={e => setBuilder(prev => ({ ...prev, team: e.target.value }))}
                      placeholder="e.g., Celtics"
                      className="mt-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                    />
                  </div>
                )}

                {/* Player (for player props) */}
                {currentBetType?.requiresPlayer && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-300 text-xs uppercase tracking-wide">
                        Player
                      </Label>
                      <Input
                        value={builder.playerName}
                        onChange={e =>
                          setBuilder(prev => ({ ...prev, playerName: e.target.value }))
                        }
                        placeholder="e.g., Donovan Mitchell"
                        className="mt-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 text-xs uppercase tracking-wide">
                        Stat Type
                      </Label>
                      <Select
                        value={builder.propType}
                        onValueChange={v => setBuilder(prev => ({ ...prev, propType: v }))}
                      >
                        <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-white">
                          <SelectValue placeholder="Select stat" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {propTypes.map(pt => (
                            <SelectItem
                              key={pt}
                              value={pt}
                              className="text-white hover:bg-slate-700"
                            >
                              {pt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Line (when required) */}
                {currentBetType?.requiresLine && (
                  <div>
                    <Label className="text-slate-300 text-xs uppercase tracking-wide">Line</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={builder.line}
                      onChange={e => setBuilder(prev => ({ ...prev, line: e.target.value }))}
                      placeholder={
                        currentBetType.requiresPlayer ? 'e.g., 8.5' : 'e.g., -3.5 or 220.5'
                      }
                      className="mt-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                    />
                  </div>
                )}

                {/* Selection Buttons */}
                <div>
                  <Label className="text-slate-300 text-xs uppercase tracking-wide">
                    Selection
                  </Label>
                  <div className="flex gap-2 mt-1">
                    {currentBetType?.outcomeType === 'team' && (
                      <>
                        <Button
                          variant={builder.selection === 'home' ? 'default' : 'outline'}
                          onClick={() => setBuilder(prev => ({ ...prev, selection: 'home' }))}
                          className={cn(
                            'flex-1',
                            builder.selection === 'home'
                              ? 'bg-blue-600'
                              : 'bg-slate-700 border-slate-600 text-white'
                          )}
                        >
                          {builder.team || 'Home'}
                        </Button>
                        <Button
                          variant={builder.selection === 'away' ? 'default' : 'outline'}
                          onClick={() => setBuilder(prev => ({ ...prev, selection: 'away' }))}
                          className={cn(
                            'flex-1',
                            builder.selection === 'away'
                              ? 'bg-blue-600'
                              : 'bg-slate-700 border-slate-600 text-white'
                          )}
                        >
                          Away
                        </Button>
                      </>
                    )}
                    {currentBetType?.outcomeType === 'over_under' && (
                      <>
                        <Button
                          variant={builder.selection === 'over' ? 'default' : 'outline'}
                          onClick={() => setBuilder(prev => ({ ...prev, selection: 'over' }))}
                          className={cn(
                            'flex-1',
                            builder.selection === 'over'
                              ? 'bg-green-600'
                              : 'bg-slate-700 border-slate-600 text-white'
                          )}
                        >
                          Over
                        </Button>
                        <Button
                          variant={builder.selection === 'under' ? 'default' : 'outline'}
                          onClick={() => setBuilder(prev => ({ ...prev, selection: 'under' }))}
                          className={cn(
                            'flex-1',
                            builder.selection === 'under'
                              ? 'bg-red-600'
                              : 'bg-slate-700 border-slate-600 text-white'
                          )}
                        >
                          Under
                        </Button>
                      </>
                    )}
                    {currentBetType?.outcomeType === 'yes_no' && (
                      <>
                        <Button
                          variant={builder.selection === 'yes' ? 'default' : 'outline'}
                          onClick={() => setBuilder(prev => ({ ...prev, selection: 'yes' }))}
                          className={cn(
                            'flex-1',
                            builder.selection === 'yes'
                              ? 'bg-green-600'
                              : 'bg-slate-700 border-slate-600 text-white'
                          )}
                        >
                          Yes
                        </Button>
                        <Button
                          variant={builder.selection === 'no' ? 'default' : 'outline'}
                          onClick={() => setBuilder(prev => ({ ...prev, selection: 'no' }))}
                          className={cn(
                            'flex-1',
                            builder.selection === 'no'
                              ? 'bg-red-600'
                              : 'bg-slate-700 border-slate-600 text-white'
                          )}
                        >
                          No
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Odds + Provider Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-300 text-xs uppercase tracking-wide">Odds</Label>
                    <Input
                      type="number"
                      value={builder.odds}
                      onChange={e => setBuilder(prev => ({ ...prev, odds: e.target.value }))}
                      placeholder="-110"
                      className="mt-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs uppercase tracking-wide">
                      Sportsbook
                    </Label>
                    <Select
                      value={builder.provider}
                      onValueChange={v => setBuilder(prev => ({ ...prev, provider: v }))}
                    >
                      <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {PROVIDERS.map(p => (
                          <SelectItem
                            key={p.code}
                            value={p.code}
                            className="text-white hover:bg-slate-700"
                          >
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Validation Summary */}
              {validationErrors.length > 0 && (
                <div className="mt-4 p-3 bg-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                    Missing:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {validationErrors.map((err, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="bg-red-900/30 text-red-400 border-red-800 text-xs"
                      >
                        {err}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Leg Button */}
              <div className="mt-5 flex gap-2">
                <Button
                  onClick={addLeg}
                  disabled={!canAddLeg}
                  className={cn(
                    'flex-1 font-semibold',
                    canAddLeg
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-slate-600 cursor-not-allowed'
                  )}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pick
                </Button>
                <Button
                  onClick={clearBuilder}
                  variant="outline"
                  className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            {/* Select from Games - Disabled */}
            <Card className="bg-[#252830] border-slate-700 p-4 mt-4 opacity-60">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Select from Games</div>
                  <div className="text-slate-400 text-sm">Catalog-based selection</div>
                </div>
                <Badge variant="outline" className="text-slate-400 border-slate-600">
                  Coming Soon
                </Badge>
              </div>
            </Card>
          </div>

          {/* RIGHT: Bet Slip Panel (Sticky) */}
          <div className="lg:w-96 lg:sticky lg:top-6 lg:self-start">
            <Card className="bg-[#252830] border-slate-700 overflow-hidden">
              {/* Header */}
              <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold">Bet Slip</h2>
                  <Badge
                    className={cn(
                      ticketType === 'parlay' ? 'bg-purple-600' : 'bg-blue-600',
                      'text-white'
                    )}
                  >
                    {ticketType === 'parlay' ? `${legs.length}-Leg Parlay` : 'Single'}
                  </Badge>
                </div>
              </div>

              {/* Bet Slip ID */}
              <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">Slip ID</div>
                  <div className="flex items-center gap-1">
                    <code className="text-xs text-slate-300 font-mono">
                      {betSlipId.slice(0, 20)}...
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyBetSlipId}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={regenerateBetSlipId}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Legs List */}
              <div className="p-4">
                {legs.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-slate-500 text-sm">No picks added</div>
                    <div className="text-slate-600 text-xs mt-1">Build your picks on the left</div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {legs.map((leg, idx) => {
                      const sport = SPORTS.find(s => s.code === leg.sport);
                      const betType = BET_TYPES.find(bt => bt.key === leg.betType);
                      return (
                        <div key={leg.id} className="bg-slate-800 rounded-lg p-3 relative group">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={cn('text-[10px] px-1.5 py-0', sport?.color)}>
                                  {leg.sport}
                                </Badge>
                                <Badge className={cn('text-[10px] px-1.5 py-0', betType?.color)}>
                                  {betType?.shortLabel}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 text-slate-400 border-slate-600"
                                >
                                  Manual
                                </Badge>
                              </div>
                              <div className="text-white text-sm font-medium truncate">
                                {formatLegCompact(leg)}
                              </div>
                              <div className="text-slate-400 text-xs truncate mt-0.5">
                                {leg.matchup}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLeg(leg.id)}
                              className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Stake & Payout */}
              {legs.length > 0 && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="border-t border-slate-700 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-slate-300 text-sm">Stake (Units)</Label>
                      <Input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={stake}
                        onChange={e => setStake(parseFloat(e.target.value) || 1)}
                        className="w-20 h-8 text-right bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    {legs.length > 1 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Combined Odds</span>
                        <span className="text-white font-medium">{formatOdds(combinedOdds)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Potential Payout</span>
                      <span className="text-green-400 font-semibold">
                        +{potentialPayout.toFixed(2)}u
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="p-4 bg-slate-800/50 border-t border-slate-700">
                <Button
                  onClick={handleSubmit}
                  disabled={legs.length === 0 || submitting}
                  className={cn(
                    'w-full font-semibold py-3',
                    legs.length > 0
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-slate-600 cursor-not-allowed'
                  )}
                >
                  {submitting ? (
                    <>
                      <Spinner className="h-4 w-4 mr-2" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Submit{' '}
                      {legs.length > 1
                        ? `${legs.length}-Leg Parlay`
                        : legs.length === 1
                          ? 'Single'
                          : 'Ticket'}
                    </>
                  )}
                </Button>

                {/* Result */}
                {submitResult && (
                  <div
                    className={cn(
                      'mt-3 p-3 rounded-lg text-sm',
                      submitResult.status === 'inserted'
                        ? 'bg-green-900/30 text-green-400 border border-green-800'
                        : submitResult.status === 'exists'
                          ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
                          : 'bg-red-900/30 text-red-400 border border-red-800'
                    )}
                  >
                    {submitResult.status === 'inserted' && (
                      <>
                        <div className="font-medium flex items-center gap-1">
                          <Check className="h-4 w-4" /> Success!
                        </div>
                        <div className="mt-1 text-xs opacity-80 break-all">
                          {submitResult.ticket_id}
                        </div>
                      </>
                    )}
                    {submitResult.status === 'exists' && (
                      <div className="font-medium">Already exists</div>
                    )}
                    {submitResult.status === 'error' && (
                      <>
                        <div className="font-medium flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" /> Failed
                        </div>
                        <div className="mt-1 text-xs opacity-80">
                          {submitResult.error_details?.map(e => e.errors.join(', ')).join('\n')}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
