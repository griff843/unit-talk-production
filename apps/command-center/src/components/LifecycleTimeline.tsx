'use client';

/**
 * LIFECYCLE TIMELINE COMPONENT
 * Sprint: COMMAND-CENTER-LIFECYCLE-OPS-039
 *
 * Displays a vertical timeline of lifecycle events for a pick.
 */

import { Clock, CheckCircle, XCircle, AlertTriangle, Ban, MessageSquare } from 'lucide-react';

import { StageBadge } from '@/components/ui/LifecycleBadge';
import { type LifecycleStage, STAGE_COLORS } from '@/lib/lifecycleDisplay';

interface TimelineEvent {
  stage: LifecycleStage;
  timestamp: string;
  label: string;
  reason?: string;
}

interface LifecycleTimelineProps {
  events: TimelineEvent[];
  currentStage: LifecycleStage;
  blockedReason?: string;
  failedReason?: string;
}

const STAGE_ICONS: Record<LifecycleStage, React.ReactNode> = {
  DRAFT: <Clock className="h-4 w-4" />,
  SUBMITTED: <Clock className="h-4 w-4" />,
  QUEUED: <Clock className="h-4 w-4" />,
  POSTED: <MessageSquare className="h-4 w-4" />,
  SETTLING: <Clock className="h-4 w-4" />,
  SETTLED: <CheckCircle className="h-4 w-4" />,
  BLOCKED: <Ban className="h-4 w-4" />,
  FAILED: <XCircle className="h-4 w-4" />,
  CANCELLED: <XCircle className="h-4 w-4" />,
  DISPUTED: <AlertTriangle className="h-4 w-4" />,
  VOID: <Ban className="h-4 w-4" />,
};

function formatTimestamp(timestamp: string): { date: string; time: string; relative: string } {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative: string;
  if (diffMins < 1) {
    relative = 'Just now';
  } else if (diffMins < 60) {
    relative = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours}h ago`;
  } else {
    relative = `${diffDays}d ago`;
  }

  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    relative,
  };
}

function calculateDuration(events: TimelineEvent[], index: number): string | null {
  if (index === 0) return null;

  const current = new Date(events[index].timestamp);
  const previous = new Date(events[index - 1].timestamp);
  const diffMs = current.getTime() - previous.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return '<1 min';
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
  return `${Math.floor(diffHours / 24)}d ${diffHours % 24}h`;
}

export function LifecycleTimeline({
  events,
  currentStage,
  blockedReason,
  failedReason,
}: LifecycleTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">No timeline events available</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Stage Header */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <span className="text-sm font-medium">Current Stage:</span>
        <StageBadge stage={currentStage} size="md" />
      </div>

      {/* Reason Display */}
      {(blockedReason || failedReason) && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            {blockedReason ? (
              <Ban className="h-4 w-4 text-red-500 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
            )}
            <div>
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                {blockedReason ? 'Blocked' : 'Failed'}:
              </span>
              <p className="text-sm text-red-600 dark:text-red-300">
                {blockedReason || failedReason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {events.map((event, index) => {
          const { date, time, relative } = formatTimestamp(event.timestamp);
          const duration = calculateDuration(events, index);
          const isLast = index === events.length - 1;

          return (
            <div key={`${event.stage}-${event.timestamp}`} className="relative flex gap-4">
              {/* Timeline line */}
              {!isLast && (
                <div className="absolute left-[11px] top-8 w-0.5 h-[calc(100%-16px)] bg-border" />
              )}

              {/* Icon */}
              <div
                className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full ${STAGE_COLORS[event.stage]} text-white`}
              >
                {STAGE_ICONS[event.stage]}
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{event.label}</span>
                  <span className="text-xs text-muted-foreground">{relative}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {date} at {time}
                  {duration && (
                    <span className="ml-2 text-blue-600 dark:text-blue-400">(+{duration})</span>
                  )}
                </div>
                {event.reason && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{event.reason}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
