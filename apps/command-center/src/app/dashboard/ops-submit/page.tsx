'use client';

import { Send, Plus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { PickForm } from './PickForm';
import { useOpsSubmit } from './useOpsSubmit';

import { PermissionGate } from '@/components/PermissionGate';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Permission } from '@/lib/rbac';

// ============================================================================
// SPRINT-OPS-SUBMIT-V2-071B: Operator Submit Page
// ============================================================================

const SPORTS = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'Soccer', 'Tennis', 'MMA', 'Golf'];
type FormType = ReturnType<typeof useOpsSubmit>;

export default function OpsSubmitPage() {
  const form = useOpsSubmit();
  return (
    <div className="space-y-6">
      <PageHeader />
      {form.result && <ResultAlert result={form.result} />}
      <MainForm form={form} />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground">Ops Submit</h1>
      <p className="text-muted-foreground">Submit picks directly to unified_picks via atomic RPC</p>
    </div>
  );
}

function ResultAlert({
  result,
}: {
  result: { success: boolean; message: string; data?: { pick_ids?: string[] } };
}) {
  return (
    <Alert variant={result.success ? 'default' : 'destructive'}>
      {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      <AlertTitle>{result.success ? 'Success' : 'Error'}</AlertTitle>
      <AlertDescription>
        {result.message}
        {result.data?.pick_ids && (
          <div className="mt-2 text-sm">Pick IDs: {result.data.pick_ids.join(', ')}</div>
        )}
      </AlertDescription>
    </Alert>
  );
}

function MainForm({ form }: { form: FormType }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>New Ticket</CardTitle>
        <CardDescription>
          Fill in the details below to submit a pick. All fields marked with * are required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <CapperSportRow form={form} />
        <MatchupCard form={form} />
        {form.picks.map((pick, idx) => (
          <PickForm
            key={idx}
            pick={pick}
            index={idx}
            showRemove={form.picks.length > 1}
            onUpdate={(field, value) => form.updatePick(idx, field, value)}
            onRemove={() => form.removePick(idx)}
          />
        ))}
        <Button
          variant="outline"
          onClick={form.addPick}
          className="w-full"
          data-testid="add-pick-btn"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Pick
        </Button>
        {form.ticketType === 'parlay' && <ParlayOddsInput form={form} />}
        <NotesInput form={form} />
        <PermissionGate
          permission={Permission.RUN_BACKFILL}
          fallback={
            <Button disabled className="w-full" size="lg">
              Submit Ticket (Not Authorized)
            </Button>
          }
        >
          <SubmitButton form={form} />
        </PermissionGate>
      </CardContent>
    </Card>
  );
}

function CapperSelect({ form }: { form: FormType }) {
  if (form.loadingCappers) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }
  return (
    <Select value={form.capperId} onValueChange={form.setCapperId}>
      <SelectTrigger data-testid="capper-select">
        <SelectValue placeholder="Select capper" />
      </SelectTrigger>
      <SelectContent>
        {form.cappers.map(c => (
          <SelectItem key={c.id} value={c.id}>
            {c.username} ({c.role})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SportSelect({ form }: { form: FormType }) {
  return (
    <Select value={form.sport} onValueChange={form.setSport}>
      <SelectTrigger data-testid="sport-select">
        <SelectValue placeholder="Select sport" />
      </SelectTrigger>
      <SelectContent>
        {SPORTS.map(s => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TypeSelect({ form }: { form: FormType }) {
  return (
    <Select
      value={form.ticketType}
      onValueChange={(v: 'straight' | 'parlay') => form.setTicketType(v)}
    >
      <SelectTrigger data-testid="type-select">
        <SelectValue placeholder="Select type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="straight">Straight</SelectItem>
        <SelectItem value="parlay">Parlay</SelectItem>
      </SelectContent>
    </Select>
  );
}

function CapperSportRow({ form }: { form: FormType }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label htmlFor="capper">Capper *</Label>
        <CapperSelect form={form} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sport">Sport *</Label>
        <SportSelect form={form} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="type">Ticket Type</Label>
        <TypeSelect form={form} />
      </div>
    </div>
  );
}

function MatchupCard({ form }: { form: FormType }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg">Matchup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="away">Away Team</Label>
            <Input
              id="away"
              data-testid="away-team-input"
              placeholder="e.g., Buffalo Bills"
              value={form.manualMatchupAway}
              onChange={e => form.setManualMatchupAway(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="home">Home Team</Label>
            <Input
              id="home"
              data-testid="home-team-input"
              placeholder="e.g., Kansas City Chiefs"
              value={form.manualMatchupHome}
              onChange={e => form.setManualMatchupHome(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Game Date</Label>
            <Input
              id="date"
              type="date"
              data-testid="game-date-input"
              value={form.manualGameDate}
              onChange={e => form.setManualGameDate(e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ParlayOddsInput({ form }: { form: FormType }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="parlay-odds">Parlay Odds</Label>
      <Input
        id="parlay-odds"
        type="number"
        data-testid="parlay-odds-input"
        placeholder="+350"
        value={form.parlayOdds ?? ''}
        onChange={e => form.setParlayOdds(e.target.value ? parseInt(e.target.value) : null)}
      />
    </div>
  );
}

function NotesInput({ form }: { form: FormType }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="notes">Notes</Label>
      <Textarea
        id="notes"
        data-testid="notes-input"
        placeholder="Optional notes about this ticket..."
        value={form.notes}
        onChange={e => form.setNotes(e.target.value)}
      />
    </div>
  );
}

function SubmitButton({ form }: { form: FormType }) {
  return (
    <Button
      onClick={form.handleSubmit}
      disabled={form.submitting || !form.capperId || form.picks.length === 0}
      className="w-full"
      size="lg"
      data-testid="submit-ticket-btn"
    >
      {form.submitting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Submitting...
        </>
      ) : (
        <>
          <Send className="h-4 w-4 mr-2" />
          Submit Ticket
        </>
      )}
    </Button>
  );
}
