import {
  CheckCircle,
  XCircle,
  MinusCircle,
  RefreshCw,
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableHead } from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface UnsettledPick {
  id: string;
  player_name: string;
  stat_type: string;
  line: number;
  side: string;
  sport: string;
  odds: number;
  confidence: number;
  professional_score: number | null;
  promotion_band: string | null;
  bet_type: string | null;
  market: string | null;
  capper_id: string | null;
  created_at: string;
}

export type SettleOutcome = 'win' | 'loss' | 'push';
export type SortField = 'player_name' | 'sport' | 'created_at' | 'line';
export type SortDir = 'asc' | 'desc';

export interface ConfirmState {
  pick: UnsettledPick;
  outcome: SettleOutcome;
}

// ---------------------------------------------------------------------------
// SettlementToolbar
// ---------------------------------------------------------------------------

export function SettlementToolbar({
  search,
  setSearch,
  sportFilter,
  setSportFilter,
  sports,
  count,
}: {
  search: string;
  setSearch: (v: string) => void;
  sportFilter: string;
  setSportFilter: (v: string) => void;
  sports: string[];
  count: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search player or prop..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>
      <Select value={sportFilter} onValueChange={setSportFilter}>
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue placeholder="Sport" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sports</SelectItem>
          {sports.map(s => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge variant="outline" className="text-xs ml-auto">
        {count} unsettled
      </Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableHeader
// ---------------------------------------------------------------------------

export function SortableHeader({
  label,
  field,
  sortField,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <TableHead className="cursor-pointer select-none" onClick={() => onSort(field)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active &&
          (sortDir === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          ))}
      </span>
    </TableHead>
  );
}

// ---------------------------------------------------------------------------
// SettlementActions
// ---------------------------------------------------------------------------

export function SettlementActions({
  pick,
  onSettle,
  isPending,
}: {
  pick: UnsettledPick;
  onSettle: (pick: UnsettledPick, outcome: SettleOutcome) => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
        disabled={isPending}
        onClick={() => onSettle(pick, 'win')}
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        WIN
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
        disabled={isPending}
        onClick={() => onSettle(pick, 'loss')}
      >
        <XCircle className="h-3 w-3 mr-1" />
        LOSS
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground border-border hover:bg-muted/50"
        disabled={isPending}
        onClick={() => onSettle(pick, 'push')}
      >
        <MinusCircle className="h-3 w-3 mr-1" />
        PUSH
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  state,
  onConfirm,
  onCancel,
  isPending,
}: {
  state: ConfirmState | null;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  if (!state) return null;
  const { pick, outcome } = state;
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Settlement</DialogTitle>
          <DialogDescription>
            Settle <strong>{pick.player_name}</strong> ({pick.stat_type} {pick.line} {pick.side}) as{' '}
            <strong className="uppercase">{outcome}</strong>?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirm {outcome.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
