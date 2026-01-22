'use client';

import { CheckCircle, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export interface TraceRecord {
  trace_id: string;
  pick: {
    id: string;
    sport: string;
    selection: string;
    odds: number;
    stake: number;
    status: string;
    form_source: string;
    created_at: string;
    capper: string;
  };
  publish: {
    id: string;
    status: string;
    attempts: number;
    discord_channel_id: string | null;
    discord_message_id: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  bridge_events: number;
  lifecycle_stage: string;
  created_at: string;
}

export const LIFECYCLE_COLORS: Record<string, string> = {
  pick_created: 'bg-blue-500',
  pick_approved: 'bg-indigo-500',
  awaiting_publish: 'bg-yellow-500',
  publishing: 'bg-orange-500',
  discord_published: 'bg-green-500',
  publish_failed: 'bg-red-500',
  pick_settled: 'bg-purple-500',
  unknown: 'bg-gray-500',
};

export const LIFECYCLE_LABELS: Record<string, string> = {
  pick_created: 'Pick Created',
  pick_approved: 'Approved',
  awaiting_publish: 'Awaiting Publish',
  publishing: 'Publishing...',
  discord_published: 'Published',
  publish_failed: 'Failed',
  pick_settled: 'Settled',
  unknown: 'Unknown',
};

interface TraceRowProps {
  trace: TraceRecord;
  onClick: () => void;
}

export function TraceRow({ trace, onClick }: TraceRowProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-3 h-3 rounded-full ${LIFECYCLE_COLORS[trace.lifecycle_stage] || LIFECYCLE_COLORS.unknown}`}
        />
        <div>
          <div className="font-mono text-sm font-medium">{trace.trace_id.slice(0, 8)}...</div>
          <div className="text-sm text-muted-foreground">
            {trace.pick.capper} • {trace.pick.sport} • {trace.pick.selection}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Badge
          variant={trace.lifecycle_stage === 'discord_published' ? 'default' : 'secondary'}
          className={trace.lifecycle_stage === 'publish_failed' ? 'bg-red-100 text-red-800' : ''}
        >
          {LIFECYCLE_LABELS[trace.lifecycle_stage] || trace.lifecycle_stage}
        </Badge>
        {trace.publish?.discord_message_id && <CheckCircle className="h-4 w-4 text-green-600" />}
        <div className="text-xs text-muted-foreground text-right">
          <div>{formatDate(trace.created_at)}</div>
          <div>{formatTime(trace.created_at)}</div>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
