'use client';

import { Filter, Search } from 'lucide-react';

import type { PicksPageFilters } from './usePicksPage';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function PicksFilterCard({ filters }: { filters: PicksPageFilters }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Filter className="h-5 w-5" />
          <span>Advanced Filtering</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <SearchInput value={filters.searchTerm} onChange={filters.setSearchTerm} />
          <SportFilter value={filters.selectedSport} onChange={filters.setSelectedSport} />
          <TierFilter value={filters.selectedTier} onChange={filters.setSelectedTier} />
          <StatusFilter value={filters.selectedStatus} onChange={filters.setSelectedStatus} />
          <LifecycleStageFilter
            value={filters.selectedLifecycleStage || 'all'}
            onChange={filters.setSelectedLifecycleStage || (() => {})}
          />
          <Button variant="outline" onClick={filters.clearAll}>
            Clear Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search picks, cappers..."
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
}

function SportFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="All Sports" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Sports</SelectItem>
        <SelectItem value="MLB">MLB</SelectItem>
        <SelectItem value="NBA">NBA</SelectItem>
        <SelectItem value="NFL">NFL</SelectItem>
        <SelectItem value="NHL">NHL</SelectItem>
        <SelectItem value="NCAAF">NCAAF</SelectItem>
      </SelectContent>
    </Select>
  );
}

function TierFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="All Tiers" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Tiers</SelectItem>
        <SelectItem value="S">S Tier</SelectItem>
        <SelectItem value="A">A Tier</SelectItem>
        <SelectItem value="B">B Tier</SelectItem>
        <SelectItem value="C">C Tier</SelectItem>
        <SelectItem value="D">D Tier</SelectItem>
      </SelectContent>
    </Select>
  );
}

function StatusFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="All Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Status</SelectItem>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="approved">Approved</SelectItem>
        <SelectItem value="rejected">Rejected</SelectItem>
      </SelectContent>
    </Select>
  );
}

function LifecycleStageFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Lifecycle Stage" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Stages</SelectItem>
        <SelectItem value="SUBMITTED">Submitted</SelectItem>
        <SelectItem value="QUEUED">Queued</SelectItem>
        <SelectItem value="POSTED">Posted</SelectItem>
        <SelectItem value="SETTLING">Settling</SelectItem>
        <SelectItem value="SETTLED">Settled</SelectItem>
        <SelectItem value="BLOCKED">Blocked</SelectItem>
        <SelectItem value="FAILED">Failed</SelectItem>
        <SelectItem value="needs_attention">Needs Attention</SelectItem>
        <SelectItem value="stuck">Stuck</SelectItem>
      </SelectContent>
    </Select>
  );
}
