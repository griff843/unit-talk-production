'use client';

/**
 * LIFECYCLE BADGE COMPONENT
 * Sprint: LIFECYCLE-CONTRACT-LOCK-037
 *
 * Displays the lifecycle stage of a pick with color coding.
 */

import { Badge } from '@/components/ui/badge';
import {
  deriveLifecycleStage,
  getStageDisplay,
  getBlockReason,
  needsAttention,
  type LifecyclePickData,
  type LifecycleStage,
} from '@/lib/lifecycleDisplay';
import { AlertTriangle, CheckCircle, Clock, XCircle, Ban, MessageSquare } from 'lucide-react';

// ============================================================
// ICONS
// ============================================================

const STAGE_ICONS: Record<LifecycleStage, React.ReactNode> = {
  DRAFT: <Clock className="h-3 w-3" />,
  SUBMITTED: <Clock className="h-3 w-3" />,
  QUEUED: <Clock className="h-3 w-3" />,
  POSTED: <MessageSquare className="h-3 w-3" />,
  SETTLING: <Clock className="h-3 w-3" />,
  SETTLED: <CheckCircle className="h-3 w-3" />,
  BLOCKED: <Ban className="h-3 w-3" />,
  FAILED: <XCircle className="h-3 w-3" />,
  CANCELLED: <XCircle className="h-3 w-3" />,
  DISPUTED: <AlertTriangle className="h-3 w-3" />,
  VOID: <Ban className="h-3 w-3" />,
};

// ============================================================
// COMPONENT
// ============================================================

interface LifecycleBadgeProps {
  pick: LifecyclePickData;
  showIcon?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function LifecycleBadge({
  pick,
  showIcon = true,
  showTooltip = true,
  size = 'sm',
}: LifecycleBadgeProps) {
  const stage = deriveLifecycleStage(pick);
  const { label, color, description } = getStageDisplay(stage);
  const reason = getBlockReason(pick);
  const attention = needsAttention(pick);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const tooltipText = showTooltip
    ? `${description}${reason ? ` - Reason: ${reason}` : ''}`
    : undefined;

  return (
    <Badge
      className={`${color} ${sizeClasses[size]} ${attention ? 'animate-pulse' : ''} inline-flex items-center gap-1`}
      title={tooltipText}
    >
      {showIcon && STAGE_ICONS[stage]}
      {label}
    </Badge>
  );
}

// ============================================================
// STAGE BADGE (for direct stage use)
// ============================================================

interface StageBadgeProps {
  stage: LifecycleStage;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StageBadge({ stage, showIcon = true, size = 'sm' }: StageBadgeProps) {
  const { label, color } = getStageDisplay(stage);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge className={`${color} ${sizeClasses[size]} inline-flex items-center gap-1`}>
      {showIcon && STAGE_ICONS[stage]}
      {label}
    </Badge>
  );
}
