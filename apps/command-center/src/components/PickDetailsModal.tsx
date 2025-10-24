'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar,
  Clock,
  TrendingUp,
  Target,
  DollarSign,
  User,
  Trophy,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Shield,
  Zap,
} from 'lucide-react';
import { Pick } from '@/hooks/usePicks';
import { getTierColor, formatCurrency, formatPercentage } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface PickDetailsModalProps {
  pick: Pick | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: (pickId: string) => Promise<boolean>;
  onReject?: (pickId: string) => Promise<boolean>;
}

export function PickDetailsModal({
  pick,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: PickDetailsModalProps) {
  if (!pick) return null;

  const canTakeAction = pick.status === 'pending' && (onApprove || onReject);
  const canReverse = pick.status !== 'pending' && (onApprove || onReject);

  const handleApprove = async () => {
    if (onApprove) {
      const success = await onApprove(pick.id);
      if (success) {
        onClose();
      }
    }
  };

  const handleReject = async () => {
    if (onReject) {
      const success = await onReject(pick.id);
      if (success) {
        onClose();
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">Pick Details</DialogTitle>
            <Badge className={cn('ml-2', getStatusColor(pick.status))}>
              <span className="flex items-center gap-1">
                {getStatusIcon(pick.status)}
                {pick.status}
              </span>
            </Badge>
          </div>
          <DialogDescription>
            Complete analysis and management for pick #{pick.id.slice(0, 8)}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-4">
          <div className="space-y-6">
            {/* Capper Information */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Capper Information
                </h3>
                <Badge variant="outline" className={cn(getTierColor(pick.tier))}>
                  Tier {pick.tier}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{pick.capper}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Historical ROI:</span>
                  <p className="font-medium text-green-600 dark:text-green-400">
                    {formatPercentage(pick.roi || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Pick Details */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Target className="w-4 h-4" />
                Pick Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Sport:</span>
                  <p className="font-medium">{pick.sport}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Selection:</span>
                  <p className="font-medium">{pick.selection}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Odds:</span>
                  <p className="font-medium">{pick.odds || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Confidence:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{pick.confidence}%</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${pick.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4" />
                Analytics & Scoring
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Zap className="w-4 h-4 text-yellow-500" />
                  </div>
                  <span className="text-muted-foreground text-xs">EV Score</span>
                  <p className="font-bold text-lg">{pick.ev_score || 0}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Activity className="w-4 h-4 text-blue-500" />
                  </div>
                  <span className="text-muted-foreground text-xs">CLV</span>
                  <p className="font-bold text-lg">0%</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    <Shield className="w-4 h-4 text-green-500" />
                  </div>
                  <span className="text-muted-foreground text-xs">Risk</span>
                  <p className="font-bold text-lg">{pick.risk || 'Low'}</p>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" />
                Timeline
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">
                    {new Date(pick.created_at || pick.submitted_at).toLocaleString()}
                  </span>
                </div>
                {pick.status === 'approved' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status Updated:</span>
                    <span className="font-medium">
                      {new Date(pick.created_at || pick.submitted_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes/Reasoning */}
            {pick.notes && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4" />
                  Analysis Notes
                </h3>
                <p className="text-sm text-muted-foreground">{pick.notes}</p>
              </div>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        <DialogFooter className="gap-2">
          {/* Action buttons based on status */}
          {pick.status === 'pending' && (onApprove || onReject) && (
            <>
              {onReject && (
                <Button variant="destructive" onClick={handleReject} className="gap-2">
                  <XCircle className="w-4 h-4" />
                  Reject Pick
                </Button>
              )}
              {onApprove && (
                <Button
                  variant="default"
                  onClick={handleApprove}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve Pick
                </Button>
              )}
            </>
          )}

          {/* Reversal options for approved/rejected picks */}
          {pick.status === 'approved' && onReject && (
            <Button
              variant="outline"
              onClick={handleReject}
              className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
            >
              <XCircle className="w-4 h-4" />
              Reverse to Rejected
            </Button>
          )}

          {pick.status === 'rejected' && onApprove && (
            <Button
              variant="outline"
              onClick={handleApprove}
              className="gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <CheckCircle className="w-4 h-4" />
              Reverse to Approved
            </Button>
          )}

          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
