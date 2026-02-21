'use client';

/**
 * TrueManualEntryForm - Sprint SPRINT-SMARTFORM-TRUE-MANUAL-ENTRY-084
 *
 * True manual entry that does NOT depend on seeded events, participants,
 * or offers. Uses sentinel manual entry events per sport.
 *
 * 2-step tabs:
 * 1. Ticket Setup: Provider, unit size, parlay toggle
 * 2. Pick Details: Sport, teams, player, bet type, line, odds
 */

import { useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Plus, Trash2, Check, AlertCircle, ChevronRight } from 'lucide-react';
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

// NO SENTINEL EVENT IDS - Sprint 084 uses true manual entry with NULL FKs

// Available sports
const SPORTS = [
  { code: 'NBA', name: 'Basketball (NBA)' },
  { code: 'NFL', name: 'Football (NFL)' },
  { code: 'MLB', name: 'Baseball (MLB)' },
  { code: 'NHL', name: 'Hockey (NHL)' },
  { code: 'UFC', name: 'MMA/UFC' },
  { code: 'NCAAB', name: 'College Basketball' },
  { code: 'NCAAF', name: 'College Football' },
  { code: 'SOCCER', name: 'Soccer' },
  { code: 'TENNIS', name: 'Tennis' },
  { code: 'GOLF', name: 'Golf' },
];

// Bet types (archetypes)
interface BetType {
  key: string;
  name: string;
  requiresLine: boolean;
  outcomeType: 'spread' | 'moneyline' | 'over_under' | 'yes_no';
  sports?: string[]; // Limit to specific sports, undefined = all
  marketTypeId: number; // ID from market_types table
}

// Market type IDs from database (see market_types table)
// 1=team_moneyline, 5=nrfi, 6=yrfi, 7=puck_line, 8=run_line,
// 9=player_prop_generic, 13=team_spread, 14=game_total, 15=team_total
const BET_TYPES: BetType[] = [
  {
    key: 'moneyline',
    name: 'Moneyline',
    requiresLine: false,
    outcomeType: 'moneyline',
    marketTypeId: 1,
  },
  { key: 'spread', name: 'Spread', requiresLine: true, outcomeType: 'spread', marketTypeId: 13 },
  {
    key: 'total',
    name: 'Game Total',
    requiresLine: true,
    outcomeType: 'over_under',
    marketTypeId: 14,
  },
  {
    key: 'team_total',
    name: 'Team Total',
    requiresLine: true,
    outcomeType: 'over_under',
    marketTypeId: 15,
  },
  {
    key: 'player_prop',
    name: 'Player Prop',
    requiresLine: true,
    outcomeType: 'over_under',
    marketTypeId: 9,
  },
  {
    key: 'nrfi',
    name: 'NRFI (No Runs First Inning)',
    requiresLine: false,
    outcomeType: 'yes_no',
    sports: ['MLB'],
    marketTypeId: 5,
  },
  {
    key: 'yrfi',
    name: 'YRFI (Yes Runs First Inning)',
    requiresLine: false,
    outcomeType: 'yes_no',
    sports: ['MLB'],
    marketTypeId: 6,
  },
  {
    key: 'puck_line',
    name: 'Puck Line',
    requiresLine: true,
    outcomeType: 'spread',
    sports: ['NHL'],
    marketTypeId: 7,
  },
  {
    key: 'run_line',
    name: 'Run Line',
    requiresLine: true,
    outcomeType: 'spread',
    sports: ['MLB'],
    marketTypeId: 8,
  },
];

// Providers
const PROVIDERS = [
  { code: 'fanduel', name: 'FanDuel' },
  { code: 'draftkings', name: 'DraftKings' },
  { code: 'betmgm', name: 'BetMGM' },
  { code: 'caesars', name: 'Caesars' },
  { code: 'espn_bet', name: 'ESPN BET' },
  { code: 'bet365', name: 'Bet365' },
  { code: 'pinnacle', name: 'Pinnacle' },
  { code: 'fanatics', name: 'Fanatics' },
  { code: 'novig', name: 'NOVIG' },
  { code: 'prizepicks', name: 'PrizePicks' },
];

// ============================================================================
// TYPES
// ============================================================================

interface ManualLeg {
  id: string;
  sport: string;
  awayTeam: string;
  homeTeam: string;
  playerName?: string;
  propType?: string;
  betType: string;
  selection: Selection;
  line?: number;
  odds: number;
  provider: string;
}

interface TicketState {
  ticketType: TicketType;
  unitSize: number;
  provider: string;
  legs: ManualLeg[];
  betSlipId: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TrueManualEntryForm() {
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<'setup' | 'pick'>('setup');

  // Ticket state
  const [ticket, setTicket] = useState<TicketState>({
    ticketType: 'single',
    unitSize: 1,
    provider: 'fanduel',
    legs: [],
    betSlipId: generateBetSlipId(),
  });

  // Current leg being built
  const [currentLeg, setCurrentLeg] = useState<Partial<ManualLeg>>({
    sport: 'NBA',
    betType: 'moneyline',
    provider: 'fanduel',
  });

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<V3SubmitTicketResult | null>(null);

  // Get available bet types for selected sport
  const availableBetTypes = useMemo(() => {
    return BET_TYPES.filter(bt => !bt.sports || bt.sports.includes(currentLeg.sport || ''));
  }, [currentLeg.sport]);

  // Get current bet type config
  const currentBetType = useMemo(() => {
    return BET_TYPES.find(bt => bt.key === currentLeg.betType);
  }, [currentLeg.betType]);

  // Selection options based on outcome type
  const selectionOptions = useMemo(() => {
    if (!currentBetType) return [];

    switch (currentBetType.outcomeType) {
      case 'moneyline':
      case 'spread':
        return [
          { value: 'home', label: currentLeg.homeTeam || 'Home' },
          { value: 'away', label: currentLeg.awayTeam || 'Away' },
        ];
      case 'over_under':
        return [
          { value: 'over', label: 'Over' },
          { value: 'under', label: 'Under' },
        ];
      case 'yes_no':
        return [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ];
      default:
        return [];
    }
  }, [currentBetType, currentLeg.homeTeam, currentLeg.awayTeam]);

  // Can add leg?
  const canAddLeg = useMemo(() => {
    if (!currentLeg.sport) return false;
    if (!currentLeg.awayTeam || !currentLeg.homeTeam) return false;
    if (!currentLeg.betType) return false;
    if (!currentLeg.selection) return false;
    if (!currentLeg.odds) return false;
    if (!currentLeg.provider) return false;

    // Player prop requires player name
    if (currentLeg.betType === 'player_prop' && !currentLeg.playerName) return false;

    // Line required for certain bet types
    if (currentBetType?.requiresLine && currentLeg.line === undefined) return false;

    return true;
  }, [currentLeg, currentBetType]);

  // Add leg to ticket
  const addLeg = useCallback(() => {
    if (!canAddLeg) return;

    const newLeg: ManualLeg = {
      id: crypto.randomUUID(),
      sport: currentLeg.sport!,
      awayTeam: currentLeg.awayTeam!,
      homeTeam: currentLeg.homeTeam!,
      playerName: currentLeg.playerName,
      propType: currentLeg.propType,
      betType: currentLeg.betType!,
      selection: currentLeg.selection as Selection,
      line: currentLeg.line,
      odds: currentLeg.odds!,
      provider: currentLeg.provider!,
    };

    setTicket(prev => ({
      ...prev,
      legs: [...prev.legs, newLeg],
      ticketType: prev.legs.length >= 1 ? 'parlay' : 'single',
    }));

    // Reset current leg for next entry (keep sport and provider)
    setCurrentLeg(prev => ({
      sport: prev.sport,
      betType: 'moneyline',
      provider: prev.provider,
    }));

    toast({ title: 'Leg added', description: `${newLeg.awayTeam} @ ${newLeg.homeTeam}` });
  }, [canAddLeg, currentLeg, toast]);

  // Remove leg
  const removeLeg = useCallback((legId: string) => {
    setTicket(prev => {
      const newLegs = prev.legs.filter(l => l.id !== legId);
      return {
        ...prev,
        legs: newLegs,
        ticketType: newLegs.length > 1 ? 'parlay' : 'single',
      };
    });
  }, []);

  // Format leg display
  const formatLegDisplay = (leg: ManualLeg) => {
    const matchup = `${leg.awayTeam} @ ${leg.homeTeam}`;
    const betTypeConfig = BET_TYPES.find(bt => bt.key === leg.betType);

    let details = '';
    if (leg.playerName) {
      details = `${leg.playerName} ${leg.propType || ''} `;
    }

    const lineStr = leg.line !== undefined ? (leg.line > 0 ? `+${leg.line}` : `${leg.line}`) : '';
    const selectionStr = leg.selection.toUpperCase();

    return {
      matchup,
      details: `${details}${betTypeConfig?.name || leg.betType} ${lineStr} ${selectionStr}`.trim(),
      odds: formatOdds(leg.odds),
      provider: leg.provider,
    };
  };

  // Submit ticket
  const handleSubmit = useCallback(async () => {
    if (ticket.legs.length === 0) {
      toast({ title: 'No legs', description: 'Add at least one pick', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    setSubmitResult(null);

    try {
      // Convert ManualLeg[] to manual leg payloads (NO event_id, NO market_type_id)
      const legs = ticket.legs.map(leg => {
        const betTypeConfig = BET_TYPES.find(bt => bt.key === leg.betType);

        return {
          // Manual entry fields - NO event_id or market_type_id
          sport: leg.sport,
          bet_type: leg.betType,
          home_team: leg.homeTeam,
          away_team: leg.awayTeam,
          matchup_text: `${leg.awayTeam} @ ${leg.homeTeam}`,
          player_name: leg.playerName || null,
          prop_type: leg.propType || null,
          selection: leg.selection,
          line: leg.line,
          odds: leg.odds,
          provider: leg.provider,
        };
      });

      const result = await submitTicketV3({
        bet_slip_id: ticket.betSlipId,
        user_id: TEST_USER_ID,
        ticket_type: ticket.ticketType,
        total_stake: ticket.unitSize,
        legs: legs as any,
        meta: {
          entry_mode: 'manual', // Critical: tells RPC to use manual validation
          source: 'true_manual_entry',
          form_version: 'v084',
        },
      });

      setSubmitResult(result);

      if (result.status === 'inserted') {
        toast({ title: 'Ticket submitted!', description: `ID: ${result.ticket_id}` });

        // Reset for new ticket
        setTicket({
          ticketType: 'single',
          unitSize: 1,
          provider: ticket.provider,
          legs: [],
          betSlipId: generateBetSlipId(),
        });
        setActiveTab('setup');
      } else if (result.status === 'exists') {
        toast({ title: 'Already exists', description: `Ticket ID: ${result.ticket_id}` });
      } else {
        const errMsg =
          result.error_details?.map(e => e.errors.join(', ')).join('; ') || 'Unknown error';
        toast({ title: 'Submission failed', description: errMsg, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }, [ticket, toast]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Smart Form - Manual Entry</h1>
          <p className="text-slate-400 text-sm">True manual entry - no database dependency</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Form Panel */}
          <div className="flex-1">
            <Card className="p-0 bg-white overflow-hidden">
              <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'setup' | 'pick')}>
                <TabsList className="w-full justify-start rounded-none border-b bg-slate-50">
                  <TabsTrigger value="setup" className="flex-1 data-[state=active]:bg-white">
                    1. Ticket Setup
                  </TabsTrigger>
                  <TabsTrigger value="pick" className="flex-1 data-[state=active]:bg-white">
                    2. Add Picks
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Ticket Setup */}
                <TabsContent value="setup" className="p-4 space-y-4 mt-0">
                  <div className="space-y-4">
                    {/* Provider */}
                    <div>
                      <Label className="text-sm font-medium">Sportsbook</Label>
                      <Select
                        value={ticket.provider}
                        onValueChange={v => {
                          setTicket(prev => ({ ...prev, provider: v }));
                          setCurrentLeg(prev => ({ ...prev, provider: v }));
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDERS.map(p => (
                            <SelectItem key={p.code} value={p.code}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Unit Size */}
                    <div>
                      <Label className="text-sm font-medium">Unit Size</Label>
                      <Input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={ticket.unitSize}
                        onChange={e =>
                          setTicket(prev => ({
                            ...prev,
                            unitSize: parseFloat(e.target.value) || 1,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>

                    {/* Parlay Toggle */}
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label className="text-sm font-medium">Parlay Mode</Label>
                        <p className="text-xs text-slate-500">Enable for multi-leg tickets</p>
                      </div>
                      <Switch
                        checked={ticket.ticketType === 'parlay'}
                        onCheckedChange={checked =>
                          setTicket(prev => ({
                            ...prev,
                            ticketType: checked ? 'parlay' : 'single',
                          }))
                        }
                      />
                    </div>
                  </div>

                  {/* Continue Button */}
                  <Button
                    onClick={() => setActiveTab('pick')}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Continue to Add Picks <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </TabsContent>

                {/* Tab 2: Pick Details */}
                <TabsContent value="pick" className="p-4 space-y-4 mt-0">
                  {/* Sport Selection */}
                  <div>
                    <Label className="text-sm font-medium">Sport</Label>
                    <Select
                      value={currentLeg.sport}
                      onValueChange={v =>
                        setCurrentLeg(prev => ({ ...prev, sport: v, betType: 'moneyline' }))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SPORTS.map(s => (
                          <SelectItem key={s.code} value={s.code}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Teams */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Away Team</Label>
                      <Input
                        placeholder="e.g., Lakers"
                        value={currentLeg.awayTeam || ''}
                        onChange={e =>
                          setCurrentLeg(prev => ({ ...prev, awayTeam: e.target.value }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Home Team</Label>
                      <Input
                        placeholder="e.g., Celtics"
                        value={currentLeg.homeTeam || ''}
                        onChange={e =>
                          setCurrentLeg(prev => ({ ...prev, homeTeam: e.target.value }))
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Bet Type */}
                  <div>
                    <Label className="text-sm font-medium">Bet Type</Label>
                    <Select
                      value={currentLeg.betType}
                      onValueChange={v =>
                        setCurrentLeg(prev => ({ ...prev, betType: v, selection: undefined }))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBetTypes.map(bt => (
                          <SelectItem key={bt.key} value={bt.key}>
                            {bt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Player Name (for player props) */}
                  {currentLeg.betType === 'player_prop' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-medium">Player Name</Label>
                        <Input
                          placeholder="e.g., LeBron James"
                          value={currentLeg.playerName || ''}
                          onChange={e =>
                            setCurrentLeg(prev => ({ ...prev, playerName: e.target.value }))
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Prop Type</Label>
                        <Input
                          placeholder="e.g., Points"
                          value={currentLeg.propType || ''}
                          onChange={e =>
                            setCurrentLeg(prev => ({ ...prev, propType: e.target.value }))
                          }
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {/* Line (if required) */}
                  {currentBetType?.requiresLine && (
                    <div>
                      <Label className="text-sm font-medium">Line</Label>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder={
                          currentLeg.betType === 'player_prop' ? 'e.g., 25.5' : 'e.g., -3.5'
                        }
                        value={currentLeg.line ?? ''}
                        onChange={e =>
                          setCurrentLeg(prev => ({
                            ...prev,
                            line: e.target.value ? parseFloat(e.target.value) : undefined,
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                  )}

                  {/* Selection */}
                  {currentLeg.awayTeam && currentLeg.homeTeam && selectionOptions.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Selection</Label>
                      <div className="flex gap-2 mt-1">
                        {selectionOptions.map(opt => (
                          <Button
                            key={opt.value}
                            variant={currentLeg.selection === opt.value ? 'default' : 'outline'}
                            onClick={() =>
                              setCurrentLeg(prev => ({
                                ...prev,
                                selection: opt.value as Selection,
                              }))
                            }
                            className="flex-1"
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Odds */}
                  <div>
                    <Label className="text-sm font-medium">Odds</Label>
                    <Input
                      type="number"
                      placeholder="-110"
                      value={currentLeg.odds ?? ''}
                      onChange={e =>
                        setCurrentLeg(prev => ({
                          ...prev,
                          odds: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>

                  {/* Add Leg Button */}
                  <Button
                    onClick={addLeg}
                    disabled={!canAddLeg}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Pick to Ticket
                  </Button>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Ticket Summary Panel */}
          <div className="lg:w-80">
            <Card className="p-4 bg-white">
              <h2 className="text-lg font-semibold mb-4">Ticket Summary</h2>

              {/* Ticket Info */}
              <div className="text-sm text-slate-600 mb-4 space-y-1">
                <div>
                  Type:{' '}
                  <span className="font-medium">
                    {ticket.ticketType === 'parlay' ? 'Parlay' : 'Single'}
                  </span>
                </div>
                <div>
                  Units: <span className="font-medium">{ticket.unitSize}</span>
                </div>
                <div>
                  Sportsbook:{' '}
                  <span className="font-medium">
                    {PROVIDERS.find(p => p.code === ticket.provider)?.name}
                  </span>
                </div>
              </div>

              {/* Legs */}
              <div className="mb-4">
                <Label className="text-xs text-slate-500">Picks ({ticket.legs.length})</Label>
                {ticket.legs.length === 0 ? (
                  <div className="text-slate-400 text-sm text-center py-6 border-2 border-dashed rounded mt-2">
                    No picks added yet
                  </div>
                ) : (
                  <div className="space-y-2 mt-2 max-h-64 overflow-y-auto">
                    {ticket.legs.map(leg => {
                      const display = formatLegDisplay(leg);
                      return (
                        <div key={leg.id} className="p-2 border rounded text-sm bg-slate-50">
                          <div className="flex justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{display.matchup}</div>
                              <div className="text-xs text-slate-500">{display.details}</div>
                              <div className="text-xs text-slate-500">
                                {display.odds} @ {display.provider}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLeg(leg.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={ticket.legs.length === 0 || submitting}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Submit {ticket.legs.length > 1 ? `${ticket.legs.length}-Leg Parlay` : 'Ticket'}
                  </>
                )}
              </Button>

              {/* Result */}
              {submitResult && (
                <div
                  className={cn(
                    'mt-4 p-3 rounded text-sm',
                    submitResult.status === 'inserted'
                      ? 'bg-green-50 text-green-800'
                      : submitResult.status === 'exists'
                        ? 'bg-yellow-50 text-yellow-800'
                        : 'bg-red-50 text-red-800'
                  )}
                >
                  {submitResult.status === 'inserted' && (
                    <>
                      <div className="font-medium flex items-center gap-1">
                        <Check className="h-4 w-4" /> Success!
                      </div>
                      <div className="mt-1 text-xs break-all">{submitResult.ticket_id}</div>
                    </>
                  )}
                  {submitResult.status === 'exists' && (
                    <>
                      <div className="font-medium">Already Exists</div>
                      <div className="mt-1 text-xs">{submitResult.ticket_id}</div>
                    </>
                  )}
                  {submitResult.status === 'error' && (
                    <>
                      <div className="font-medium flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" /> Failed
                      </div>
                      <div className="mt-1 text-xs whitespace-pre-wrap">
                        {submitResult.error_details?.map(e => e.errors.join(', ')).join('\n') ||
                          'Unknown error'}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
