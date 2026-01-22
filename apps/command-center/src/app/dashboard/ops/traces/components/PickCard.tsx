/* eslint-disable max-lines-per-function, complexity */
'use client';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface PublishInfo {
  id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  discord_channel_id: string | null;
  discord_message_id: string | null;
  last_error?: string | null;
}

interface PickDetail {
  id: string;
  sport: string;
  selection: string;
  line?: number | null;
  odds: number;
  stake: number;
  status: string;
  form_source: string;
  workflow_stage?: string;
  is_live?: boolean;
  created_at: string;
  capper: { username: string };
  publish?: PublishInfo | null;
}

interface PickCardProps {
  pick: PickDetail;
}

export function PickCard({ pick }: PickCardProps) {
  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="p-4 rounded-lg border">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-sm text-muted-foreground">{pick.id}</div>
          <div className="text-lg font-semibold mt-1">
            {pick.capper.username} • {pick.sport}
          </div>
          <div className="text-sm mt-1">
            {pick.selection} {pick.line && `@ ${pick.line}`} • Odds: {pick.odds > 0 ? '+' : ''}
            {pick.odds}
          </div>
        </div>
        <div className="text-right">
          <Badge variant={pick.status === 'pending' ? 'secondary' : 'default'}>{pick.status}</Badge>
          <div className="text-xs text-muted-foreground mt-1">
            {formatDateTime(pick.created_at)}
          </div>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Stake:</span>
          <span className="ml-2 font-medium">{pick.stake} units</span>
        </div>
        <div>
          <span className="text-muted-foreground">Source:</span>
          <span className="ml-2 font-medium">{pick.form_source}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Workflow:</span>
          <span className="ml-2 font-medium">{pick.workflow_stage || 'N/A'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Live:</span>
          <span className="ml-2 font-medium">{pick.is_live ? 'Yes' : 'No'}</span>
        </div>
      </div>

      {pick.publish && (
        <>
          <Separator className="my-3" />
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-sm font-medium mb-2">pick_publish</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>
                <Badge
                  className="ml-2"
                  variant={pick.publish.status === 'sent' ? 'default' : 'secondary'}
                >
                  {pick.publish.status}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Attempts:</span>
                <span className="ml-2">
                  {pick.publish.attempts}/{pick.publish.max_attempts}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Channel:</span>
                <span className="ml-2 font-mono text-xs">
                  {pick.publish.discord_channel_id || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Message:</span>
                <span className="ml-2 font-mono text-xs">
                  {pick.publish.discord_message_id || 'N/A'}
                </span>
              </div>
            </div>
            {pick.publish.last_error && (
              <div className="mt-2 text-sm text-red-600">Error: {pick.publish.last_error}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
