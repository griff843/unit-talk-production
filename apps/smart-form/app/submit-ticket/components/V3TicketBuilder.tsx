'use client';

/**
 * V3TicketBuilder - Sportsbook-grade ticket submission UI
 * SPRINT-SMARTFORM-UX-REBUILD-080
 *
 * Single-page layout:
 * - Left panel: Ticket builder (sport, event, market, participant, offers)
 * - Right panel: Ticket summary with legs and submit
 *
 * Uses Canonical V3 views and atomic_submit_ticket_v2 RPC
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
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
import { Plus, Trash2, Edit3, Check, AlertCircle, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

import {
  fetchSports,
  fetchEvents,
  searchEvents,
  fetchMarketTypes,
  fetchParticipants,
  fetchOffers,
  fetchProviders,
  formatEventDisplay,
  formatScheduledAt,
  formatOdds,
  submitTicketV3,
  generateBetSlipId,
  validateLegs,
  formatErrorDetails,
  TEST_USER_ID,
  type V3Sport,
  type V3Event,
  type V3MarketType,
  type V3Participant,
  type V3ProviderOffer,
  type V3TicketLeg,
  type V3TicketState,
  type V3SubmitTicketResult,
  type Selection,
  type TicketType,
} from '@/lib/v3';

// ============================================================================
// COMPONENT STATE TYPES
// ============================================================================

interface LoadingState {
  sports: boolean;
  events: boolean;
  markets: boolean;
  participants: boolean;
  offers: boolean;
  providers: boolean;
  submitting: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function V3TicketBuilder() {
  const { toast } = useToast();

  // ========================================
  // DATA STATE
  // ========================================
  const [sports, setSports] = useState<V3Sport[]>([]);
  const [events, setEvents] = useState<V3Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<V3Event[]>([]);
  const [marketTypes, setMarketTypes] = useState<V3MarketType[]>([]);
  const [participants, setParticipants] = useState<V3Participant[]>([]);
  const [offers, setOffers] = useState<V3ProviderOffer[]>([]);
  const [providers, setProviders] = useState<{ code: string; display_name: string }[]>([]);

  // ========================================
  // FORM STATE
  // ========================================
  const [selectedSport, setSelectedSport] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<V3Event | null>(null);
  const [selectedMarketType, setSelectedMarketType] = useState<V3MarketType | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<V3Participant | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<V3ProviderOffer | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  // Manual entry state
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualLine, setManualLine] = useState('');
  const [manualOdds, setManualOdds] = useState('');
  const [manualProvider, setManualProvider] = useState('');

  // Override state (for editing selected offer)
  const [overrideLine, setOverrideLine] = useState('');
  const [overrideOdds, setOverrideOdds] = useState('');

  // ========================================
  // TICKET STATE
  // ========================================
  const [ticket, setTicket] = useState<V3TicketState>({
    ticket_type: 'single',
    total_stake: 1,
    bet_slip_id: generateBetSlipId(),
    legs: [],
  });

  // ========================================
  // LOADING STATE
  // ========================================
  const [loading, setLoading] = useState<LoadingState>({
    sports: true,
    events: false,
    markets: false,
    participants: false,
    offers: false,
    providers: true,
    submitting: false,
  });

  // ========================================
  // SUBMISSION RESULT
  // ========================================
  const [submitResult, setSubmitResult] = useState<V3SubmitTicketResult | null>(null);

  // ========================================
  // LOAD SPORTS ON MOUNT
  // ========================================
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [sportsData, providersData] = await Promise.all([fetchSports(), fetchProviders()]);
        setSports(sportsData);
        setProviders(providersData.map(p => ({ code: p.code, display_name: p.display_name })));
      } catch (error: any) {
        console.error('[V3Builder] Failed to load sports:', error);
        toast({
          title: 'Failed to load sports',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(prev => ({ ...prev, sports: false, providers: false }));
      }
    };
    loadInitial();
  }, [toast]);

  // ========================================
  // LOAD EVENTS WHEN SPORT CHANGES
  // ========================================
  useEffect(() => {
    if (!selectedSport) {
      setEvents([]);
      setFilteredEvents([]);
      return;
    }

    const loadEvents = async () => {
      setLoading(prev => ({ ...prev, events: true }));
      try {
        const data = await fetchEvents(selectedSport);
        setEvents(data);
        setFilteredEvents(data);
      } catch (error: any) {
        console.error('[V3Builder] Failed to load events:', error);
        setEvents([]);
        setFilteredEvents([]);
      } finally {
        setLoading(prev => ({ ...prev, events: false }));
      }
    };
    loadEvents();

    // Reset downstream selections
    setSelectedEvent(null);
    setSelectedMarketType(null);
    setSelectedParticipant(null);
    setSelectedOffer(null);
    setSelection(null);
    setMarketTypes([]);
    setParticipants([]);
    setOffers([]);
  }, [selectedSport]);

  // ========================================
  // LOAD MARKET TYPES WHEN SPORT CHANGES
  // ========================================
  useEffect(() => {
    if (!selectedSport) {
      setMarketTypes([]);
      return;
    }

    const loadMarkets = async () => {
      setLoading(prev => ({ ...prev, markets: true }));
      try {
        const data = await fetchMarketTypes(selectedSport);
        setMarketTypes(data);
      } catch (error: any) {
        console.error('[V3Builder] Failed to load market types:', error);
        setMarketTypes([]);
      } finally {
        setLoading(prev => ({ ...prev, markets: false }));
      }
    };
    loadMarkets();
  }, [selectedSport]);

  // ========================================
  // FILTER EVENTS ON SEARCH
  // ========================================
  useEffect(() => {
    if (!eventSearch.trim()) {
      setFilteredEvents(events);
      return;
    }

    const query = eventSearch.toLowerCase();
    const filtered = events.filter(
      e => e.home_team?.toLowerCase().includes(query) || e.away_team?.toLowerCase().includes(query)
    );
    setFilteredEvents(filtered);
  }, [eventSearch, events]);

  // ========================================
  // LOAD PARTICIPANTS WHEN EVENT SELECTED
  // ========================================
  useEffect(() => {
    if (!selectedEvent) {
      setParticipants([]);
      return;
    }

    const loadParticipants = async () => {
      setLoading(prev => ({ ...prev, participants: true }));
      try {
        const data = await fetchParticipants(selectedEvent.id);
        setParticipants(data);
      } catch (error: any) {
        console.error('[V3Builder] Failed to load participants:', error);
        setParticipants([]);
      } finally {
        setLoading(prev => ({ ...prev, participants: false }));
      }
    };
    loadParticipants();

    // Reset downstream
    setSelectedParticipant(null);
    setSelectedOffer(null);
    setOffers([]);
  }, [selectedEvent]);

  // ========================================
  // LOAD OFFERS WHEN MARKET/PARTICIPANT SELECTED
  // ========================================
  useEffect(() => {
    if (!selectedEvent || !selectedMarketType) {
      setOffers([]);
      return;
    }

    // If market requires participant but none selected, wait
    if (selectedMarketType.requires_participant && !selectedParticipant) {
      setOffers([]);
      return;
    }

    const loadOffers = async () => {
      setLoading(prev => ({ ...prev, offers: true }));
      try {
        const data = await fetchOffers({
          eventId: selectedEvent.id,
          marketTypeId: selectedMarketType.market_type_id,
          participantId: selectedParticipant?.participant_id,
        });
        setOffers(data);
      } catch (error: any) {
        console.error('[V3Builder] Failed to load offers:', error);
        setOffers([]);
      } finally {
        setLoading(prev => ({ ...prev, offers: false }));
      }
    };
    loadOffers();
  }, [selectedEvent, selectedMarketType, selectedParticipant]);

  // ========================================
  // COMPUTED: Can add leg?
  // ========================================
  const canAddLeg = useMemo(() => {
    if (!selectedEvent || !selectedMarketType || !selection) return false;

    if (selectedMarketType.requires_participant && !selectedParticipant) return false;

    if (isManualMode) {
      if (!manualOdds || !manualProvider) return false;
      if (selectedMarketType.requires_line && !manualLine) return false;
    } else {
      // Provider path: need offer or manual override
      if (!selectedOffer && !manualOdds) return false;
    }

    return true;
  }, [
    selectedEvent,
    selectedMarketType,
    selection,
    selectedParticipant,
    isManualMode,
    manualOdds,
    manualProvider,
    manualLine,
    selectedOffer,
  ]);

  // ========================================
  // ADD LEG
  // ========================================
  const addLeg = useCallback(() => {
    if (!canAddLeg || !selectedEvent || !selectedMarketType || !selection) return;

    const newLeg: V3TicketLeg = {
      id: crypto.randomUUID(),
      event_id: selectedEvent.id,
      event_display: formatEventDisplay(selectedEvent),
      market_type_id: selectedMarketType.market_type_id,
      market_display: selectedMarketType.display_name,
      selection,
      isManual: isManualMode || !selectedOffer,
    };

    // Participant (if applicable)
    if (selectedParticipant) {
      newLeg.participant_id = selectedParticipant.participant_id;
      newLeg.participant_display = selectedParticipant.display_name || selectedParticipant.name;
    }

    if (selectedOffer && !isManualMode) {
      // Provider-first path
      newLeg.provider_offer_id = selectedOffer.id;
      newLeg.provider = selectedOffer.provider;
      newLeg.line = selectedOffer.line ?? undefined;

      // Get odds based on selection
      const offerOdds =
        selection === 'over'
          ? selectedOffer.over_odds
          : selection === 'under'
            ? selectedOffer.under_odds
            : selection === 'home'
              ? selectedOffer.home_odds
              : selection === 'away'
                ? selectedOffer.away_odds
                : selection === 'yes'
                  ? selectedOffer.yes_odds
                  : selectedOffer.no_odds;
      newLeg.odds = offerOdds ?? undefined;

      // Check for overrides
      const hasOverride = overrideLine || overrideOdds;
      if (hasOverride) {
        newLeg.override = {};
        if (overrideLine) newLeg.override.line = parseFloat(overrideLine);
        if (overrideOdds) newLeg.override.odds = parseInt(overrideOdds, 10);
        newLeg.isManual = false; // Still provider-first with override
      }
    } else {
      // Manual path
      newLeg.provider = manualProvider;
      newLeg.odds = parseInt(manualOdds, 10);
      if (manualLine) newLeg.line = parseFloat(manualLine);
    }

    // Add leg to ticket
    setTicket(prev => {
      const newLegs = [...prev.legs, newLeg];
      return {
        ...prev,
        legs: newLegs,
        ticket_type: newLegs.length > 1 ? 'parlay' : 'single',
      };
    });

    // Reset form for next leg
    setSelectedOffer(null);
    setSelection(null);
    setOverrideLine('');
    setOverrideOdds('');
    setManualLine('');
    setManualOdds('');

    toast({
      title: 'Leg added',
      description: `${newLeg.participant_display || newLeg.event_display} - ${newLeg.market_display}`,
    });
  }, [
    canAddLeg,
    selectedEvent,
    selectedMarketType,
    selection,
    selectedParticipant,
    selectedOffer,
    isManualMode,
    manualLine,
    manualOdds,
    manualProvider,
    overrideLine,
    overrideOdds,
    toast,
  ]);

  // ========================================
  // REMOVE LEG
  // ========================================
  const removeLeg = useCallback((legId: string) => {
    setTicket(prev => {
      const newLegs = prev.legs.filter(l => l.id !== legId);
      return {
        ...prev,
        legs: newLegs,
        ticket_type: newLegs.length > 1 ? 'parlay' : 'single',
      };
    });
  }, []);

  // ========================================
  // SUBMIT TICKET
  // ========================================
  const handleSubmit = useCallback(async () => {
    if (ticket.legs.length === 0) {
      toast({
        title: 'No legs',
        description: 'Add at least one leg to submit',
        variant: 'destructive',
      });
      return;
    }

    // Validate legs
    const validationErrors = validateLegs(ticket.legs);
    if (validationErrors.size > 0) {
      toast({
        title: 'Validation errors',
        description: 'Please fix errors before submitting',
        variant: 'destructive',
      });
      return;
    }

    setLoading(prev => ({ ...prev, submitting: true }));
    setSubmitResult(null);

    try {
      const result = await submitTicketV3({
        bet_slip_id: ticket.bet_slip_id,
        user_id: TEST_USER_ID,
        ticket_type: ticket.ticket_type,
        total_stake: ticket.total_stake,
        legs: ticket.legs.map(leg => ({
          event_id: leg.event_id,
          market_type_id: leg.market_type_id,
          segment_type_id: leg.segment_type_id,
          selection: leg.selection,
          provider_offer_id: leg.provider_offer_id,
          participant_id: leg.participant_id,
          line: leg.line,
          odds: leg.odds,
          provider: leg.provider,
          override: leg.override,
        })),
      });

      setSubmitResult(result);

      if (result.status === 'inserted') {
        toast({
          title: 'Ticket submitted',
          description: `Ticket ID: ${result.ticket_id}`,
        });

        // Reset for new ticket
        setTicket({
          ticket_type: 'single',
          total_stake: 1,
          bet_slip_id: generateBetSlipId(),
          legs: [],
        });
      } else if (result.status === 'exists') {
        toast({
          title: 'Ticket already exists',
          description: `Existing ticket ID: ${result.ticket_id}`,
        });
      } else {
        toast({
          title: 'Submission failed',
          description: formatErrorDetails(result.error_details),
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Submission error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, submitting: false }));
    }
  }, [ticket, toast]);

  // ========================================
  // COPY BET SLIP ID
  // ========================================
  const copyBetSlipId = useCallback(() => {
    navigator.clipboard.writeText(ticket.bet_slip_id);
    toast({ title: 'Copied', description: 'Bet slip ID copied to clipboard' });
  }, [ticket.bet_slip_id, toast]);

  // ========================================
  // REGENERATE BET SLIP ID
  // ========================================
  const regenerateBetSlipId = useCallback(() => {
    setTicket(prev => ({ ...prev, bet_slip_id: generateBetSlipId() }));
  }, []);

  // ========================================
  // RENDER: Market type groups for dropdown
  // ========================================
  const groupedMarkets = useMemo(() => {
    const groups = new Map<string, V3MarketType[]>();
    marketTypes.forEach(mt => {
      const groupName = mt.market_group_name || 'Other';
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(mt);
    });
    return groups;
  }, [marketTypes]);

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">V3 Ticket Builder</h1>
          <p className="text-slate-400 text-sm">Sportsbook-grade submission via Canonical V3</p>
        </div>

        {/* Main Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ============================================ */}
          {/* LEFT PANEL: Builder */}
          {/* ============================================ */}
          <div className="flex-1 lg:max-w-3xl space-y-4">
            {/* Sport Selection */}
            <Card className="p-4 bg-white">
              <Label className="text-sm font-medium mb-2 block">Sport</Label>
              {loading.sports ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Spinner className="h-4 w-4" /> Loading sports...
                </div>
              ) : (
                <Select value={selectedSport} onValueChange={setSelectedSport}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sport" />
                  </SelectTrigger>
                  <SelectContent>
                    {sports.map(s => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Card>

            {/* Event Selection */}
            {selectedSport && (
              <Card className="p-4 bg-white">
                <Label className="text-sm font-medium mb-2 block">Event / Matchup</Label>

                {/* Search input */}
                <Input
                  placeholder="Search by team name..."
                  value={eventSearch}
                  onChange={e => setEventSearch(e.target.value)}
                  className="mb-3"
                />

                {loading.events ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Spinner className="h-4 w-4" /> Loading events...
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="text-slate-500 text-sm py-4 text-center border rounded">
                    No upcoming events found for {selectedSport}
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto border rounded divide-y">
                    {filteredEvents.map(event => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={cn(
                          'w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors',
                          selectedEvent?.id === event.id && 'bg-blue-50 border-l-4 border-blue-500'
                        )}
                      >
                        <div className="font-medium text-sm">{formatEventDisplay(event)}</div>
                        <div className="text-xs text-slate-500">
                          {formatScheduledAt(event.scheduled_at)} • {event.league || event.sport}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Market Type Selection */}
            {selectedEvent && (
              <Card className="p-4 bg-white">
                <Label className="text-sm font-medium mb-2 block">Market Type</Label>
                {loading.markets ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Spinner className="h-4 w-4" /> Loading markets...
                  </div>
                ) : (
                  <Select
                    value={selectedMarketType?.market_type_id.toString() || ''}
                    onValueChange={val => {
                      const mt = marketTypes.find(m => m.market_type_id.toString() === val);
                      setSelectedMarketType(mt || null);
                      setSelectedParticipant(null);
                      setSelectedOffer(null);
                      setSelection(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select market type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(groupedMarkets.entries()).map(([group, markets]) => (
                        <div key={group}>
                          <div className="px-2 py-1 text-xs font-semibold text-slate-500 bg-slate-50">
                            {group}
                          </div>
                          {markets.map(mt => (
                            <SelectItem
                              key={mt.market_type_id}
                              value={mt.market_type_id.toString()}
                            >
                              {mt.display_name}
                              {mt.requires_participant && (
                                <span className="text-xs text-slate-400 ml-2">
                                  (requires participant)
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Card>
            )}

            {/* Participant Selection (if required) */}
            {selectedMarketType?.requires_participant && (
              <Card className="p-4 bg-white">
                <Label className="text-sm font-medium mb-2 block">Participant (Player/Team)</Label>
                {loading.participants ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <Spinner className="h-4 w-4" /> Loading participants...
                  </div>
                ) : participants.length === 0 ? (
                  <div className="text-slate-500 text-sm py-4 text-center border rounded">
                    No participants found for this event
                  </div>
                ) : (
                  <Select
                    value={selectedParticipant?.participant_id || ''}
                    onValueChange={val => {
                      const p = participants.find(x => x.participant_id === val);
                      setSelectedParticipant(p || null);
                      setSelectedOffer(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select participant" />
                    </SelectTrigger>
                    <SelectContent>
                      {participants.map(p => (
                        <SelectItem key={p.participant_id} value={p.participant_id}>
                          {p.display_name || p.name}
                          {p.team_name && (
                            <span className="text-xs text-slate-400 ml-2">({p.team_name})</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Card>
            )}

            {/* Offers / Manual Entry */}
            {selectedMarketType &&
              (!selectedMarketType.requires_participant || selectedParticipant) && (
                <Card className="p-4 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">
                      {isManualMode ? 'Manual Entry' : 'Provider Offers'}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsManualMode(!isManualMode);
                        setSelectedOffer(null);
                      }}
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      {isManualMode ? 'Show Offers' : 'Manual Entry'}
                    </Button>
                  </div>

                  {isManualMode ? (
                    // Manual Entry Mode
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {selectedMarketType.requires_line && (
                          <div>
                            <Label className="text-xs text-slate-500">Line</Label>
                            <Input
                              type="number"
                              step="0.5"
                              placeholder="e.g., 25.5"
                              value={manualLine}
                              onChange={e => setManualLine(e.target.value)}
                            />
                          </div>
                        )}
                        <div>
                          <Label className="text-xs text-slate-500">Odds</Label>
                          <Input
                            type="number"
                            placeholder="-110"
                            value={manualOdds}
                            onChange={e => setManualOdds(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Provider</Label>
                        <Select value={manualProvider} onValueChange={setManualProvider}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map(p => (
                              <SelectItem key={p.code} value={p.code}>
                                {p.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    // Offer Selection Mode
                    <>
                      {loading.offers ? (
                        <div className="flex items-center gap-2 text-slate-500">
                          <Spinner className="h-4 w-4" /> Loading offers...
                        </div>
                      ) : offers.length === 0 ? (
                        <div className="text-slate-500 text-sm py-4 text-center border rounded">
                          No offers available. Use manual entry.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {offers.map(offer => (
                            <button
                              key={offer.id}
                              onClick={() => {
                                setSelectedOffer(offer);
                                setOverrideLine('');
                                setOverrideOdds('');
                              }}
                              className={cn(
                                'w-full text-left px-3 py-2 border rounded hover:border-blue-300 transition-colors',
                                selectedOffer?.id === offer.id && 'border-blue-500 bg-blue-50'
                              )}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-sm">{offer.provider_name}</span>
                                <div className="text-sm space-x-3">
                                  {offer.line !== null && (
                                    <span className="text-slate-600">Line: {offer.line}</span>
                                  )}
                                  {offer.over_odds && (
                                    <span className="text-green-600">
                                      O {formatOdds(offer.over_odds)}
                                    </span>
                                  )}
                                  {offer.under_odds && (
                                    <span className="text-red-600">
                                      U {formatOdds(offer.under_odds)}
                                    </span>
                                  )}
                                  {offer.home_odds && (
                                    <span>Home {formatOdds(offer.home_odds)}</span>
                                  )}
                                  {offer.away_odds && (
                                    <span>Away {formatOdds(offer.away_odds)}</span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Override Section (when offer selected) */}
                      {selectedOffer && (
                        <div className="mt-3 pt-3 border-t">
                          <Label className="text-xs text-slate-500 mb-2 block">
                            Override (optional)
                          </Label>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-slate-400">Line</Label>
                              <Input
                                type="number"
                                step="0.5"
                                placeholder={selectedOffer.line?.toString() || '-'}
                                value={overrideLine}
                                onChange={e => setOverrideLine(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-slate-400">Odds</Label>
                              <Input
                                type="number"
                                placeholder="Override odds"
                                value={overrideOdds}
                                onChange={e => setOverrideOdds(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </Card>
              )}

            {/* Selection (Over/Under/Home/Away) */}
            {selectedMarketType && (isManualMode || selectedOffer || offers.length === 0) && (
              <Card className="p-4 bg-white">
                <Label className="text-sm font-medium mb-2 block">Selection</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedMarketType.outcome_type === 'over_under' && (
                    <>
                      <Button
                        variant={selection === 'over' ? 'default' : 'outline'}
                        onClick={() => setSelection('over')}
                        className="flex-1"
                      >
                        Over
                      </Button>
                      <Button
                        variant={selection === 'under' ? 'default' : 'outline'}
                        onClick={() => setSelection('under')}
                        className="flex-1"
                      >
                        Under
                      </Button>
                    </>
                  )}
                  {(selectedMarketType.outcome_type === 'moneyline_2way' ||
                    selectedMarketType.outcome_type === 'spread') && (
                    <>
                      <Button
                        variant={selection === 'home' ? 'default' : 'outline'}
                        onClick={() => setSelection('home')}
                        className="flex-1"
                      >
                        Home
                      </Button>
                      <Button
                        variant={selection === 'away' ? 'default' : 'outline'}
                        onClick={() => setSelection('away')}
                        className="flex-1"
                      >
                        Away
                      </Button>
                    </>
                  )}
                  {selectedMarketType.outcome_type === 'moneyline_3way' && (
                    <>
                      <Button
                        variant={selection === 'home' ? 'default' : 'outline'}
                        onClick={() => setSelection('home')}
                      >
                        Home
                      </Button>
                      <Button
                        variant={selection === 'draw' ? 'default' : 'outline'}
                        onClick={() => setSelection('draw')}
                      >
                        Draw
                      </Button>
                      <Button
                        variant={selection === 'away' ? 'default' : 'outline'}
                        onClick={() => setSelection('away')}
                      >
                        Away
                      </Button>
                    </>
                  )}
                  {selectedMarketType.outcome_type === 'yes_no' && (
                    <>
                      <Button
                        variant={selection === 'yes' ? 'default' : 'outline'}
                        onClick={() => setSelection('yes')}
                        className="flex-1"
                      >
                        Yes
                      </Button>
                      <Button
                        variant={selection === 'no' ? 'default' : 'outline'}
                        onClick={() => setSelection('no')}
                        className="flex-1"
                      >
                        No
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            )}

            {/* Add Leg Button */}
            {selectedMarketType && (
              <Button
                onClick={addLeg}
                disabled={!canAddLeg}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Leg to Ticket
              </Button>
            )}
          </div>

          {/* ============================================ */}
          {/* RIGHT PANEL: Ticket Summary */}
          {/* ============================================ */}
          <div className="lg:w-96 lg:flex-shrink-0">
            <div className="lg:sticky lg:top-6">
              <Card className="p-4 bg-white">
                <h2 className="text-lg font-semibold mb-4">Ticket Summary</h2>

                {/* Ticket Type & Stake */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <Label className="text-xs text-slate-500">Type</Label>
                    <Select
                      value={ticket.ticket_type}
                      onValueChange={val =>
                        setTicket(prev => ({
                          ...prev,
                          ticket_type: val as TicketType,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="parlay">Parlay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Stake (units)</Label>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={ticket.total_stake}
                      onChange={e =>
                        setTicket(prev => ({
                          ...prev,
                          total_stake: parseFloat(e.target.value) || 1,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Bet Slip ID */}
                <div className="mb-4">
                  <Label className="text-xs text-slate-500">Bet Slip ID</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-slate-100 px-2 py-1 rounded truncate">
                      {ticket.bet_slip_id}
                    </code>
                    <Button variant="ghost" size="sm" onClick={copyBetSlipId}>
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={regenerateBetSlipId}>
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Legs */}
                <div className="mb-4">
                  <Label className="text-xs text-slate-500 mb-2 block">
                    Legs ({ticket.legs.length})
                  </Label>
                  {ticket.legs.length === 0 ? (
                    <div className="text-slate-400 text-sm text-center py-6 border-2 border-dashed rounded">
                      No legs added yet
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {ticket.legs.map((leg, idx) => (
                        <div key={leg.id} className="p-2 border rounded text-sm bg-slate-50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {leg.participant_display || leg.event_display}
                              </div>
                              <div className="text-xs text-slate-500">
                                {leg.market_display} • {leg.selection.toUpperCase()}
                              </div>
                              <div className="text-xs text-slate-500 flex gap-2">
                                {leg.line !== undefined && <span>Line: {leg.line}</span>}
                                {leg.odds !== undefined && (
                                  <span>Odds: {formatOdds(leg.odds)}</span>
                                )}
                                <span>{leg.provider}</span>
                              </div>
                              {leg.override && (
                                <Badge variant="secondary" className="text-xs mt-1">
                                  Override
                                </Badge>
                              )}
                              {leg.isManual && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  Manual
                                </Badge>
                              )}
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
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit */}
                <Button
                  onClick={handleSubmit}
                  disabled={ticket.legs.length === 0 || loading.submitting}
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
                      Submit{' '}
                      {ticket.legs.length > 1 ? `${ticket.legs.length}-Leg Parlay` : 'Ticket'}
                    </>
                  )}
                </Button>

                {/* Submit Result */}
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
                          <Check className="h-4 w-4" /> Ticket Submitted
                        </div>
                        <div className="mt-1">
                          <code className="text-xs">{submitResult.ticket_id}</code>
                        </div>
                      </>
                    )}
                    {submitResult.status === 'exists' && (
                      <>
                        <div className="font-medium flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" /> Already Exists
                        </div>
                        <div className="mt-1">
                          <code className="text-xs">{submitResult.ticket_id}</code>
                        </div>
                      </>
                    )}
                    {submitResult.status === 'error' && (
                      <>
                        <div className="font-medium flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" /> Submission Failed
                        </div>
                        <div className="mt-1 text-xs whitespace-pre-wrap">
                          {formatErrorDetails(submitResult.error_details)}
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
    </div>
  );
}
