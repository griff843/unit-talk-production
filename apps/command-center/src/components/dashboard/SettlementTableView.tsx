import {
  SettlementActions,
  SortableHeader,
  type SortDir,
  type SortField,
  type SettleOutcome,
  type UnsettledPick,
} from './SettlementParts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ---------------------------------------------------------------------------
// SettlementTable
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function
export function SettlementTable({
  picks,
  sortField,
  sortDir,
  onSort,
  onSettle,
  isPending,
  isLoading,
}: {
  picks: UnsettledPick[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  onSettle: (p: UnsettledPick, o: SettleOutcome) => void;
  isPending: boolean;
  isLoading: boolean;
}) {
  if (isLoading && picks.length === 0) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-20 animate-pulse rounded bg-muted" />
      </div>
    );
  }
  if (picks.length === 0) {
    return <p className="text-center py-6 text-sm text-muted-foreground">No unsettled picks</p>;
  }
  return (
    <div className="max-h-[420px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader
              label="Player"
              field="player_name"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <TableHead>Prop</TableHead>
            <SortableHeader
              label="Line"
              field="line"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <TableHead>Side</TableHead>
            <SortableHeader
              label="Sport"
              field="sport"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableHeader
              label="Created"
              field="created_at"
              sortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
            />
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {picks.map(pick => (
            <TableRow key={pick.id}>
              <TableCell className="font-medium text-xs">{pick.player_name || 'Unknown'}</TableCell>
              <TableCell className="text-xs">{pick.stat_type || '-'}</TableCell>
              <TableCell className="text-xs">{pick.line ?? '-'}</TableCell>
              <TableCell className="text-xs">
                <Badge variant="outline" className="text-xs">
                  {pick.side || '-'}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{pick.sport || '-'}</TableCell>
              <TableCell className="text-xs">
                {new Date(pick.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <SettlementActions pick={pick} onSettle={onSettle} isPending={isPending} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export function Pagination({
  page,
  pageCount,
  setPage,
  total,
}: {
  page: number;
  pageCount: number;
  setPage: (p: number) => void;
  total: number;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border text-xs text-muted-foreground">
      <span>{total} results</span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
          className="h-7 px-2 text-xs"
        >
          Prev
        </Button>
        <span>
          {page + 1} / {pageCount}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= pageCount - 1}
          onClick={() => setPage(page + 1)}
          className="h-7 px-2 text-xs"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
