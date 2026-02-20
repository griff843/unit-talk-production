'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================================
// SPRINT-OPS-SUBMIT-V2-071B: Pick Form Component
// ============================================================================

const STAT_TYPES = [
  'spread',
  'total',
  'moneyline',
  'player_prop',
  'team_prop',
  'alt_line',
  'first_half',
  'first_quarter',
];
const SIDES = ['over', 'under', 'home', 'away', 'favorite', 'underdog'];

export interface Pick {
  selection: string;
  line: number | null;
  odds: number;
  stat_type: string;
  side: string;
  confidence: number;
  units: number;
  notes: string;
}

interface PickFormProps {
  pick: Pick;
  index: number;
  showRemove: boolean;
  onUpdate: (field: keyof Pick, value: string | number | null) => void;
  onRemove: () => void;
}

function PickHeader({
  index,
  showRemove,
  onRemove,
}: {
  index: number;
  showRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <CardHeader className="py-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg">Pick #{index + 1}</CardTitle>
        {showRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove} data-testid={`remove-pick-${index}`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </CardHeader>
  );
}

// eslint-disable-next-line max-lines-per-function -- React form row component
function SelectionRow({
  pick,
  index,
  onUpdate,
}: {
  pick: Pick;
  index: number;
  onUpdate: PickFormProps['onUpdate'];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="space-y-2 md:col-span-2">
        <Label>Selection *</Label>
        <Input
          data-testid={`pick-selection-${index}`}
          placeholder="e.g., KC -3.5"
          value={pick.selection}
          onChange={e => onUpdate('selection', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Stat Type</Label>
        <Select value={pick.stat_type} onValueChange={v => onUpdate('stat_type', v)}>
          <SelectTrigger data-testid={`pick-stat-type-${index}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAT_TYPES.map(t => (
              <SelectItem key={t} value={t}>
                {t.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Side</Label>
        <Select value={pick.side} onValueChange={v => onUpdate('side', v)}>
          <SelectTrigger data-testid={`pick-side-${index}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIDES.map(s => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// eslint-disable-next-line max-lines-per-function -- React form row component
function NumericRow({
  pick,
  index,
  onUpdate,
}: {
  pick: Pick;
  index: number;
  onUpdate: PickFormProps['onUpdate'];
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="space-y-2">
        <Label>Line</Label>
        <Input
          type="number"
          step="0.5"
          data-testid={`pick-line-${index}`}
          placeholder="-3.5"
          value={pick.line ?? ''}
          onChange={e => onUpdate('line', e.target.value ? parseFloat(e.target.value) : null)}
        />
      </div>
      <div className="space-y-2">
        <Label>Odds *</Label>
        <Input
          type="number"
          data-testid={`pick-odds-${index}`}
          value={pick.odds}
          onChange={e => onUpdate('odds', parseInt(e.target.value) || -110)}
        />
      </div>
      <div className="space-y-2">
        <Label>Units</Label>
        <Input
          type="number"
          step="0.5"
          data-testid={`pick-units-${index}`}
          value={pick.units}
          onChange={e => onUpdate('units', parseFloat(e.target.value) || 1)}
        />
      </div>
      <div className="space-y-2">
        <Label>Confidence %</Label>
        <Input
          type="number"
          min="0"
          max="100"
          data-testid={`pick-confidence-${index}`}
          value={pick.confidence}
          onChange={e => onUpdate('confidence', parseInt(e.target.value) || 75)}
        />
      </div>
    </div>
  );
}

export function PickForm({ pick, index, showRemove, onUpdate, onRemove }: PickFormProps) {
  return (
    <Card>
      <PickHeader index={index} showRemove={showRemove} onRemove={onRemove} />
      <CardContent className="space-y-4">
        <SelectionRow pick={pick} index={index} onUpdate={onUpdate} />
        <NumericRow pick={pick} index={index} onUpdate={onUpdate} />
      </CardContent>
    </Card>
  );
}
