'use client';

import { useState, useCallback, useEffect } from 'react';

import type { Pick } from './PickForm';

// ============================================================================
// SPRINT-OPS-SUBMIT-V2-071B: Ops Submit Hook
// ============================================================================

export interface Capper {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface SubmitResult {
  success: boolean;
  message: string;
  data?: {
    pick_ids?: string[];
    bet_slip_id?: string;
    is_duplicate?: boolean;
  };
}

const defaultPick: Pick = {
  selection: '',
  line: null,
  odds: -110,
  stat_type: 'spread',
  side: 'favorite',
  confidence: 75,
  units: 1.0,
  notes: '',
};

interface FormState {
  capperId: string;
  cappers: Capper[];
  loadingCappers: boolean;
  sport: string;
  ticketType: 'straight' | 'parlay';
  manualMatchupHome: string;
  manualMatchupAway: string;
  manualGameDate: string;
  picks: Pick[];
  parlayOdds: number | null;
  notes: string;
  submitting: boolean;
  result: SubmitResult | null;
}

function useFormState(): FormState & { setters: Record<string, (v: unknown) => void> } {
  const [capperId, setCapperId] = useState('');
  const [cappers, setCappers] = useState<Capper[]>([]);
  const [loadingCappers, setLoadingCappers] = useState(true);
  const [sport, setSport] = useState('NFL');
  const [ticketType, setTicketType] = useState<'straight' | 'parlay'>('straight');
  const [manualMatchupHome, setManualMatchupHome] = useState('');
  const [manualMatchupAway, setManualMatchupAway] = useState('');
  const [manualGameDate, setManualGameDate] = useState('');
  const [picks, setPicks] = useState<Pick[]>([{ ...defaultPick }]);
  const [parlayOdds, setParlayOdds] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  return {
    capperId,
    cappers,
    loadingCappers,
    sport,
    ticketType,
    manualMatchupHome,
    manualMatchupAway,
    manualGameDate,
    picks,
    parlayOdds,
    notes,
    submitting,
    result,
    setters: {
      setCapperId,
      setCappers,
      setLoadingCappers,
      setSport,
      setTicketType,
      setManualMatchupHome,
      setManualMatchupAway,
      setManualGameDate,
      setPicks,
      setParlayOdds,
      setNotes,
      setSubmitting,
      setResult,
    } as Record<string, (v: unknown) => void>,
  };
}

function useCappersFetch(setters: Record<string, (v: unknown) => void>) {
  useEffect(() => {
    fetch('/api/ops/cappers')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.cappers) {
          setters.setCappers(data.cappers);
          if (data.cappers.length > 0) setters.setCapperId(data.cappers[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setters.setLoadingCappers(false));
  }, [setters]);
}

function usePickActions(setters: Record<string, (v: unknown) => void>) {
  const addPick = useCallback(() => {
    (setters.setPicks as (fn: (p: Pick[]) => Pick[]) => void)(prev => [
      ...prev,
      { ...defaultPick },
    ]);
  }, [setters]);

  const removePick = useCallback(
    (index: number) => {
      (setters.setPicks as (fn: (p: Pick[]) => Pick[]) => void)(prev =>
        prev.filter((_, i) => i !== index)
      );
    },
    [setters]
  );

  const updatePick = useCallback(
    (index: number, field: keyof Pick, value: string | number | null) => {
      (setters.setPicks as (fn: (p: Pick[]) => Pick[]) => void)(prev =>
        prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
      );
    },
    [setters]
  );

  return { addPick, removePick, updatePick };
}

function buildPayload(state: FormState) {
  const selectedCapper = state.cappers.find(c => c.id === state.capperId);
  return {
    capper_id: state.capperId,
    capper_username: selectedCapper?.username || 'unknown',
    sport: state.sport,
    ticket_type: state.ticketType,
    picks: state.picks.map(p => ({
      ...p,
      manual_matchup_home: state.manualMatchupHome,
      manual_matchup_away: state.manualMatchupAway,
      manual_game_date: state.manualGameDate || null,
    })),
    manual_matchup_home: state.manualMatchupHome,
    manual_matchup_away: state.manualMatchupAway,
    manual_game_date: state.manualGameDate || null,
    parlay_odds: state.ticketType === 'parlay' ? state.parlayOdds : null,
    total_units: state.picks.reduce((sum, p) => sum + p.units, 0),
    notes: state.notes,
  };
}

// eslint-disable-next-line max-lines-per-function -- Main hook composing multiple sub-hooks
export function useOpsSubmit() {
  const formState = useFormState();
  const { setters } = formState;
  useCappersFetch(setters);
  const { addPick, removePick, updatePick } = usePickActions(setters);

  const resetForm = useCallback(() => {
    setters.setPicks([{ ...defaultPick }]);
    setters.setManualMatchupHome('');
    setters.setManualMatchupAway('');
    setters.setManualGameDate('');
    setters.setNotes('');
  }, [setters]);

  const handleSubmit = useCallback(async () => {
    if (!formState.capperId) {
      setters.setResult({ success: false, message: 'Please select a capper' });
      return;
    }
    if (formState.picks.length === 0 || !formState.picks[0].selection) {
      setters.setResult({
        success: false,
        message: 'Please add at least one pick with a selection',
      });
      return;
    }

    setters.setSubmitting(true);
    setters.setResult(null);

    try {
      const res = await fetch('/api/ops/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(formState)),
      });
      const data = await res.json();

      if (data.success) {
        const msg = data.is_duplicate
          ? `Ticket already submitted (idempotent): ${data.bet_slip_id}`
          : `Ticket submitted successfully! Bet Slip ID: ${data.bet_slip_id}`;
        setters.setResult({ success: true, message: msg, data });
        if (!data.is_duplicate) resetForm();
      } else {
        setters.setResult({ success: false, message: data.error || 'Submission failed', data });
      }
    } catch (error) {
      setters.setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
      });
    } finally {
      setters.setSubmitting(false);
    }
  }, [formState, setters, resetForm]);

  return {
    capperId: formState.capperId,
    setCapperId: setters.setCapperId as (v: string) => void,
    cappers: formState.cappers,
    loadingCappers: formState.loadingCappers,
    sport: formState.sport,
    setSport: setters.setSport as (v: string) => void,
    ticketType: formState.ticketType,
    setTicketType: setters.setTicketType as (v: 'straight' | 'parlay') => void,
    manualMatchupHome: formState.manualMatchupHome,
    setManualMatchupHome: setters.setManualMatchupHome as (v: string) => void,
    manualMatchupAway: formState.manualMatchupAway,
    setManualMatchupAway: setters.setManualMatchupAway as (v: string) => void,
    manualGameDate: formState.manualGameDate,
    setManualGameDate: setters.setManualGameDate as (v: string) => void,
    picks: formState.picks,
    parlayOdds: formState.parlayOdds,
    setParlayOdds: setters.setParlayOdds as (v: number | null) => void,
    notes: formState.notes,
    setNotes: setters.setNotes as (v: string) => void,
    addPick,
    removePick,
    updatePick,
    handleSubmit,
    submitting: formState.submitting,
    result: formState.result,
  };
}
