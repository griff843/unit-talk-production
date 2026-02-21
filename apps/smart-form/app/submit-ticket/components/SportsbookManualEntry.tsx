'use client';

/**
 * SportsbookManualEntry - SPRINT-SMARTFORM-ENTITY-AUTOFILL-088
 *
 * Smart Form with entity autofill:
 * - Required capper selection (fail-closed if missing)
 * - Away/Home team dropdowns from teams catalog (no free-text matchup)
 * - Player search dropdown for player props
 * - Structured data stored in provider_value for Discord embeds
 *
 * Previous: SPRINT-SMARTFORM-Sportsbook-ManualEntry-UX-085
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
import { Plus, Trash2, Check, AlertCircle, Copy, RefreshCw, X, Search, User } from 'lucide-react';
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

interface Capper {
  id: string;
  display_name: string;
}

interface Team {
  id: string;
  name: string;
  abbr: string | null;
  sport: string;
}

interface Player {
  player_id: string;
  player_name: string;
  team_id: string | null;
  team_name: string | null;
  team_abbr: string | null;
  position: string | null;
}

interface ManualLeg {
  id: string;
  sport: string;
  awayTeamId: string | null;
  awayTeamName: string;
  homeTeamId: string | null;
  homeTeamName: string;
  matchup: string;
  team?: string;
  playerId?: string | null;
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
  awayTeamId: string;
  awayTeamName: string;
  homeTeamId: string;
  homeTeamName: string;
  teamSelection: 'home' | 'away' | '';
  playerId: string;
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

  const decimalOdds = legs.map(leg => {
    if (leg.odds > 0) return leg.odds / 100 + 1;
    return 100 / Math.abs(leg.odds) + 1;
  });

  const combined = decimalOdds.reduce((acc, odd) => acc * odd, 1);

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

  const lineStr = leg.line !== undefined ? (leg.line > 0 ? `+${leg.line}` : `${leg.line}`) : '';
  const selStr = leg.selection === 'over' ? 'O' : leg.selection === 'under' ? 'U' : '';

  return `${leg.team || leg.matchup} ${betType?.shortLabel} ${selStr}${lineStr} ${formatOdds(leg.odds)} (${provider?.short || leg.provider})`;
}

// ============================================================================
// COMPONENT
// ============================================================================

// eslint-disable-next-line max-lines-per-function, complexity -- Smart form with entity autofill
export function SportsbookManualEntry() {
  const { toast } = useToast();
  const builderRef = useRef<HTMLDivElement>(null);

  // ---- CAPPER STATE ----
  const [cappers, setCappers] = useState<Capper[]>([]);
  const [cappersLoading, setCappersLoading] = useState(true);
  const [selectedCapperId, setSelectedCapperId] = useState('');
  const [selectedCapperName, setSelectedCapperName] = useState('');

  // ---- TEAMS STATE ----
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');

  // ---- PLAYERS STATE ----
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // ---- TICKET STATE ----
  const [legs, setLegs] = useState<ManualLeg[]>([]);
  const [stake, setStake] = useState(1);
  const [betSlipId, setBetSlipId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<V3SubmitTicketResult | null>(null);

  // Generate bet slip ID on client-side only
  useEffect(() => {
    if (!betSlipId) {
      setBetSlipId(generateBetSlipId());
    }
  }, [betSlipId]);

  // ---- BUILDER STATE ----
  const [builder, setBuilder] = useState<BuilderState>({
    sport: 'NBA',
    betType: 'moneyline',
    awayTeamId: '',
    awayTeamName: '',
    homeTeamId: '',
    homeTeamName: '',
    teamSelection: '',
    playerId: '',
    playerName: '',
    propType: '',
    line: '',
    odds: '',
    selection: '',
    provider: 'fanduel',
  });

  // ---- DERIVED STATE ----
  const ticketType: TicketType = legs.length > 1 ? 'parlay' : 'single';
  const combinedOdds = calculateCombinedOdds(legs);
  const potentialPayout = calculatePayout(stake, combinedOdds);

  const availableBetTypes = useMemo(() => {
    return BET_TYPES.filter(bt => !bt.sports || bt.sports.includes(builder.sport));
  }, [builder.sport]);

  const currentBetType = useMemo(() => {
    return BET_TYPES.find(bt => bt.key === builder.betType);
  }, [builder.betType]);

  const propTypes = useMemo(() => {
    return PROP_TYPES_BY_SPORT[builder.sport] || [];
  }, [builder.sport]);

  // ---- FETCH CAPPERS ----
  useEffect(() => {
    async function fetchCappers() {
      setCappersLoading(true);
      try {
        const res = await fetch('/api/catalog/cappers');
        if (res.ok) {
          const data = await res.json();
          setCappers(data.cappers || []);
        }
      } catch (err) {
        console.error('Failed to fetch cappers:', err);
      } finally {
        setCappersLoading(false);
      }
    }
    fetchCappers();
  }, []);

  // ---- FETCH TEAMS BY SPORT ----
  useEffect(() => {
    async function fetchTeams() {
      setTeamsLoading(true);
      try {
        const res = await fetch(`/api/catalog/teams?sport=${builder.sport}&limit=100`);
        if (res.ok) {
          const data = await res.json();
          setTeams(data.teams || []);
        }
      } catch (err) {
        console.error('Failed to fetch teams:', err);
      } finally {
        setTeamsLoading(false);
      }
    }
    fetchTeams();
  }, [builder.sport]);

  // ---- FETCH PLAYERS BY SPORT (for player props) ----
  useEffect(() => {
    async function fetchPlayers() {
      if (!currentBetType?.requiresPlayer) {
        setPlayers([]);
        return;
      }
      setPlayersLoading(true);
      try {
        let url = `/api/catalog/players?sport=${builder.sport}&limit=100`;
        // If home team is selected, filter by that team
        if (builder.homeTeamId) {
          url += `&team_id=${builder.homeTeamId}`;
        } else if (builder.awayTeamId) {
          url += `&team_id=${builder.awayTeamId}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setPlayers(data.players || []);
        }
      } catch (err) {
        console.error('Failed to fetch players:', err);
      } finally {
        setPlayersLoading(false);
      }
    }
    fetchPlayers();
  }, [builder.sport, builder.homeTeamId, builder.awayTeamId, currentBetType?.requiresPlayer]);

  // ---- FILTERED TEAMS ----
  const filteredTeams = useMemo(() => {
    if (!teamSearchQuery) return teams;
    const q = teamSearchQuery.toLowerCase();
    return teams.filter(
      t => t.name.toLowerCase().includes(q) || (t.abbr && t.abbr.toLowerCase().includes(q))
    );
  }, [teams, teamSearchQuery]);

  // ---- FILTERED PLAYERS ----
  const filteredPlayers = useMemo(() => {
    if (!playerSearchQuery) return players;
    const q = playerSearchQuery.toLowerCase();
    return players.filter(p => p.player_name.toLowerCase().includes(q));
  }, [players, playerSearchQuery]);

  // ---- VALIDATION ERRORS ----
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    // Capper required
    if (!selectedCapperId) errors.push('Capper required');

    // Teams required for matchup
    if (!builder.awayTeamName.trim() && !builder.homeTeamName.trim()) {
      errors.push('Teams required');
    }

    if (!builder.odds.trim()) errors.push('Odds required');

    if (currentBetType?.outcomeType === 'team' && !builder.teamSelection) {
      errors.push('Team selection required');
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

    if (currentBetType?.outcomeType === 'over_under' && !builder.selection) {
      errors.push('Over/Under required');
    }

    if (currentBetType?.outcomeType === 'yes_no' && !builder.selection) {
      errors.push('Yes/No required');
    }

    return errors;
  }, [builder, currentBetType, selectedCapperId]);

  const canAddLeg = validationErrors.length === 0;

  // Update builder when sport changes
  useEffect(() => {
    const newBetTypes = BET_TYPES.filter(bt => !bt.sports || bt.sports.includes(builder.sport));
    if (!newBetTypes.find(bt => bt.key === builder.betType)) {
      setBuilder(prev => ({ ...prev, betType: 'moneyline', selection: '' }));
    }
    // Reset team selections when sport changes
    setBuilder(prev => ({
      ...prev,
      awayTeamId: '',
      awayTeamName: '',
      homeTeamId: '',
      homeTeamName: '',
      teamSelection: '',
      playerId: '',
      playerName: '',
    }));
  }, [builder.sport]);

  // Reset selection when bet type changes
  useEffect(() => {
    setBuilder(prev => ({ ...prev, selection: '', playerId: '', playerName: '' }));
  }, [builder.betType]);

  // ---- ADD LEG ----
  const addLeg = useCallback(() => {
    if (!canAddLeg) return;

    const matchupText = `${builder.awayTeamName} @ ${builder.homeTeamName}`;
    const teamName = builder.teamSelection === 'home' ? builder.homeTeamName : builder.awayTeamName;

    const newLeg: ManualLeg = {
      id: crypto.randomUUID(),
      sport: builder.sport,
      awayTeamId: builder.awayTeamId || null,
      awayTeamName: builder.awayTeamName,
      homeTeamId: builder.homeTeamId || null,
      homeTeamName: builder.homeTeamName,
      matchup: matchupText,
      team: teamName || undefined,
      playerId: builder.playerId || null,
      playerName: builder.playerName || undefined,
      propType: builder.propType || undefined,
      betType: builder.betType,
      selection: builder.selection as Selection,
      line: builder.line ? parseFloat(builder.line) : undefined,
      odds: parseInt(builder.odds, 10),
      provider: builder.provider,
    };

    setLegs(prev => [...prev, newLeg]);

    // Reset builder (keep sport, provider, and teams for quick add)
    setBuilder(prev => ({
      ...prev,
      teamSelection: '',
      playerId: '',
      playerName: '',
      propType: '',
      line: '',
      odds: '',
      selection: '',
    }));

    toast({ title: 'Pick added' });
  }, [canAddLeg, builder, toast]);

  // ---- REMOVE LEG ----
  const removeLeg = useCallback((legId: string) => {
    setLegs(prev => prev.filter(l => l.id !== legId));
  }, []);

  // ---- CLEAR BUILDER ----
  const clearBuilder = useCallback(() => {
    setBuilder(prev => ({
      ...prev,
      awayTeamId: '',
      awayTeamName: '',
      homeTeamId: '',
      homeTeamName: '',
      teamSelection: '',
      playerId: '',
      playerName: '',
      propType: '',
      line: '',
      odds: '',
      selection: '',
    }));
  }, []);

  // ---- COPY BET SLIP ID ----
  const copyBetSlipId = useCallback(() => {
    navigator.clipboard.writeText(betSlipId);
    toast({ title: 'Copied!' });
  }, [betSlipId, toast]);

  // ---- REGENERATE BET SLIP ID ----
  const regenerateBetSlipId = useCallback(() => {
    setBetSlipId(generateBetSlipId());
    toast({ title: 'New ID generated' });
  }, [toast]);

  // ---- KEYBOARD HANDLER ----
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

  // ---- SUBMIT TICKET ----
  const handleSubmit = useCallback(async () => {
    // FAIL-CLOSED: Capper required
    if (!selectedCapperId) {
      toast({
        title: 'Capper required',
        description: 'Select a capper before submitting',
        variant: 'destructive',
      });
      return;
    }

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
        home_team: leg.homeTeamName,
        away_team: leg.awayTeamName,
        home_team_id: leg.homeTeamId,
        away_team_id: leg.awayTeamId,
        matchup_text: leg.matchup,
        player_id: leg.playerId || null,
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
          form_version: 'v088',
          capper_id: selectedCapperId,
          capper_name: selectedCapperName,
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
  }, [legs, betSlipId, ticketType, stake, selectedCapperId, selectedCapperName, toast]);

  // ---- TEAM SELECT HANDLER ----
  const handleTeamSelect = useCallback(
    (type: 'away' | 'home', teamId: string, teamName: string) => {
      if (type === 'away') {
        setBuilder(prev => ({ ...prev, awayTeamId: teamId, awayTeamName: teamName }));
      } else {
        setBuilder(prev => ({ ...prev, homeTeamId: teamId, homeTeamName: teamName }));
      }
    },
    []
  );

  // ---- PLAYER SELECT HANDLER ----
  const handlePlayerSelect = useCallback((playerId: string, playerName: string) => {
    setBuilder(prev => ({ ...prev, playerId, playerName }));
  }, []);

  // ---- CAPPER SELECT HANDLER ----
  const handleCapperSelect = useCallback(
    (capperId: string) => {
      const capper = cappers.find(c => c.id === capperId);
      setSelectedCapperId(capperId);
      setSelectedCapperName(capper?.display_name || '');
    },
    [cappers]
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-[#1a1d24]" onKeyDown={handleKeyDown}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Smart Manual Entry</h1>
          <p className="text-slate-400 text-sm mt-1">
            Select capper + teams • Enter to add • Esc to clear
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT: Builder Panel */}
          <div className="flex-1" ref={builderRef}>
            {/* Capper Selection Card - REQUIRED */}
            <Card className="bg-[#252830] border-slate-700 p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-5 w-5 text-blue-400" />
                <Label className="text-slate-300 text-sm font-semibold">
                  Capper <span className="text-red-400">*</span>
                </Label>
              </div>
              {cappersLoading ? (
                <div className="flex items-center gap-2 text-slate-400">
                  <Spinner className="h-4 w-4" />
                  <span>Loading cappers...</span>
                </div>
              ) : (
                <Select value={selectedCapperId} onValueChange={handleCapperSelect}>
                  <SelectTrigger
                    className={cn(
                      'bg-slate-800 border-slate-600 text-white',
                      !selectedCapperId && 'border-red-500/50'
                    )}
                  >
                    <SelectValue placeholder="Select capper (required)" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {cappers.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-white hover:bg-slate-700">
                        {c.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!selectedCapperId && !cappersLoading && (
                <p className="text-red-400 text-xs mt-2">
                  Capper is required for ticket submission
                </p>
              )}
            </Card>

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
                {/* Teams Selection - Away @ Home */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Away Team */}
                  <div>
                    <Label className="text-slate-300 text-xs uppercase tracking-wide">
                      Away Team
                    </Label>
                    <Select
                      value={builder.awayTeamId}
                      onValueChange={teamId => {
                        const team = teams.find(t => t.id === teamId);
                        handleTeamSelect('away', teamId, team?.name || '');
                      }}
                    >
                      <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-white">
                        <SelectValue placeholder="Select away team" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                        <div className="px-2 py-1.5">
                          <Input
                            placeholder="Search teams..."
                            value={teamSearchQuery}
                            onChange={e => setTeamSearchQuery(e.target.value)}
                            className="bg-slate-700 border-slate-600 text-white text-sm"
                          />
                        </div>
                        {teamsLoading ? (
                          <div className="px-3 py-2 text-slate-400 text-sm">Loading...</div>
                        ) : filteredTeams.length === 0 ? (
                          <div className="px-3 py-2 text-slate-400 text-sm">No teams found</div>
                        ) : (
                          filteredTeams.slice(0, 20).map(t => (
                            <SelectItem
                              key={t.id}
                              value={t.id}
                              className="text-white hover:bg-slate-700"
                            >
                              {t.name} {t.abbr && `(${t.abbr})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {builder.awayTeamName && (
                      <div className="mt-1 text-xs text-slate-400">{builder.awayTeamName}</div>
                    )}
                  </div>

                  {/* Home Team */}
                  <div>
                    <Label className="text-slate-300 text-xs uppercase tracking-wide">
                      Home Team
                    </Label>
                    <Select
                      value={builder.homeTeamId}
                      onValueChange={teamId => {
                        const team = teams.find(t => t.id === teamId);
                        handleTeamSelect('home', teamId, team?.name || '');
                      }}
                    >
                      <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-white">
                        <SelectValue placeholder="Select home team" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                        <div className="px-2 py-1.5">
                          <Input
                            placeholder="Search teams..."
                            value={teamSearchQuery}
                            onChange={e => setTeamSearchQuery(e.target.value)}
                            className="bg-slate-700 border-slate-600 text-white text-sm"
                          />
                        </div>
                        {teamsLoading ? (
                          <div className="px-3 py-2 text-slate-400 text-sm">Loading...</div>
                        ) : filteredTeams.length === 0 ? (
                          <div className="px-3 py-2 text-slate-400 text-sm">No teams found</div>
                        ) : (
                          filteredTeams.slice(0, 20).map(t => (
                            <SelectItem
                              key={t.id}
                              value={t.id}
                              className="text-white hover:bg-slate-700"
                            >
                              {t.name} {t.abbr && `(${t.abbr})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {builder.homeTeamName && (
                      <div className="mt-1 text-xs text-slate-400">{builder.homeTeamName}</div>
                    )}
                  </div>
                </div>

                {/* Auto-generated matchup display */}
                {builder.awayTeamName && builder.homeTeamName && (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                      Matchup
                    </div>
                    <div className="text-white font-medium">
                      {builder.awayTeamName} @ {builder.homeTeamName}
                    </div>
                  </div>
                )}

                {/* Team Selection (for team-based bets) */}
                {currentBetType?.outcomeType === 'team' &&
                  builder.awayTeamName &&
                  builder.homeTeamName && (
                    <div>
                      <Label className="text-slate-300 text-xs uppercase tracking-wide">
                        Pick Team
                      </Label>
                      <div className="flex gap-2 mt-1">
                        <Button
                          variant={builder.teamSelection === 'away' ? 'default' : 'outline'}
                          onClick={() =>
                            setBuilder(prev => ({
                              ...prev,
                              teamSelection: 'away',
                              selection: 'away',
                            }))
                          }
                          className={cn(
                            'flex-1',
                            builder.teamSelection === 'away'
                              ? 'bg-blue-600'
                              : 'bg-slate-700 border-slate-600 text-white'
                          )}
                        >
                          {builder.awayTeamName}
                        </Button>
                        <Button
                          variant={builder.teamSelection === 'home' ? 'default' : 'outline'}
                          onClick={() =>
                            setBuilder(prev => ({
                              ...prev,
                              teamSelection: 'home',
                              selection: 'home',
                            }))
                          }
                          className={cn(
                            'flex-1',
                            builder.teamSelection === 'home'
                              ? 'bg-blue-600'
                              : 'bg-slate-700 border-slate-600 text-white'
                          )}
                        >
                          {builder.homeTeamName}
                        </Button>
                      </div>
                    </div>
                  )}

                {/* Player Search (for player props) */}
                {currentBetType?.requiresPlayer && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-300 text-xs uppercase tracking-wide">
                        Player
                      </Label>
                      {players.length > 0 ? (
                        <Select
                          value={builder.playerId}
                          onValueChange={playerId => {
                            const player = players.find(p => p.player_id === playerId);
                            handlePlayerSelect(playerId, player?.player_name || '');
                          }}
                        >
                          <SelectTrigger className="mt-1 bg-slate-800 border-slate-600 text-white">
                            <SelectValue placeholder="Select player" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                            <div className="px-2 py-1.5">
                              <Input
                                placeholder="Search players..."
                                value={playerSearchQuery}
                                onChange={e => setPlayerSearchQuery(e.target.value)}
                                className="bg-slate-700 border-slate-600 text-white text-sm"
                              />
                            </div>
                            {playersLoading ? (
                              <div className="px-3 py-2 text-slate-400 text-sm">Loading...</div>
                            ) : filteredPlayers.length === 0 ? (
                              <div className="px-3 py-2 text-slate-400 text-sm">
                                No players found
                              </div>
                            ) : (
                              filteredPlayers.slice(0, 20).map(p => (
                                <SelectItem
                                  key={p.player_id}
                                  value={p.player_id}
                                  className="text-white hover:bg-slate-700"
                                >
                                  {p.player_name}
                                  {p.team_abbr && (
                                    <span className="text-slate-400 ml-1">({p.team_abbr})</span>
                                  )}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <>
                          <Input
                            value={builder.playerName}
                            onChange={e =>
                              setBuilder(prev => ({ ...prev, playerName: e.target.value }))
                            }
                            placeholder="Enter player name (fallback)"
                            className="mt-1 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                          />
                          <p className="text-xs text-amber-400 mt-1">
                            No players in database. Manual entry mode.
                          </p>
                        </>
                      )}
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

                {/* Over/Under Selection */}
                {currentBetType?.outcomeType === 'over_under' && (
                  <div>
                    <Label className="text-slate-300 text-xs uppercase tracking-wide">
                      Selection
                    </Label>
                    <div className="flex gap-2 mt-1">
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
                    </div>
                  </div>
                )}

                {/* Yes/No Selection */}
                {currentBetType?.outcomeType === 'yes_no' && (
                  <div>
                    <Label className="text-slate-300 text-xs uppercase tracking-wide">
                      Selection
                    </Label>
                    <div className="flex gap-2 mt-1">
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
                    </div>
                  </div>
                )}

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
          </div>

          {/* RIGHT: Bet Slip Panel (Sticky) */}
          <div className="lg:w-96 lg:sticky lg:top-6 lg:self-start">
            <Card className="bg-[#252830] border-slate-700 overflow-hidden">
              {/* Header with Capper */}
              <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-white font-semibold">Bet Slip</h2>
                    {selectedCapperName && (
                      <div className="text-xs text-blue-400 mt-0.5">
                        Capper: {selectedCapperName}
                      </div>
                    )}
                  </div>
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
                    {legs.map(leg => {
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
                  disabled={legs.length === 0 || submitting || !selectedCapperId}
                  className={cn(
                    'w-full font-semibold py-3',
                    legs.length > 0 && selectedCapperId
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

                {/* Capper warning */}
                {!selectedCapperId && legs.length > 0 && (
                  <div className="mt-2 text-center text-amber-400 text-xs">
                    Select a capper to submit
                  </div>
                )}

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
