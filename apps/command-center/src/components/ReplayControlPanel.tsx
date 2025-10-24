'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import {
  RotateCcw,
  Zap,
  Clock,
  Filter,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  PlayCircle,
  StopCircle,
  Settings,
  Activity,
  BarChart3,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/lib/rbac';
import { Permission } from '@/lib/rbac';

interface ReplayControlPanelProps {
  onReplayGrading: (criteria: ReplayCriteria) => Promise<ReplayResult>;
  onReemitAlerts: (criteria: ReplayCriteria) => Promise<ReplayResult>;
  onGetReplayStatus: (replayId: string) => Promise<ReplayStatus>;
  onCancelReplay: (replayId: string) => Promise<void>;
}

interface ReplayCriteria {
  timeRange: '1h' | '6h' | '24h' | 'custom';
  eventType?: string;
  status?: string;
  customStart?: string;
  customEnd?: string;
  batchSize?: number;
  priority?: 'critical' | 'high' | 'normal' | 'low';
  alertTypes?: string[];
  reason: string;
  dryRun?: boolean;
}

interface ReplayResult {
  replayId: string;
  success: boolean;
  message: string;
  eventCount: number;
  estimatedDuration?: number;
}

interface ReplayStatus {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    completed: number;
    total: number;
    currentStep: string;
    estimatedCompletion: string;
  };
  metrics: {
    processingTime: number;
    alertsGenerated: number;
    opportunitiesFound: number;
    errorsEncountered: number;
  };
  errors?: Array<{
    step: string;
    error: string;
    timestamp: string;
  }>;
}

export function ReplayControlPanel({
  onReplayGrading,
  onReemitAlerts,
  onGetReplayStatus,
  onCancelReplay,
}: ReplayControlPanelProps) {
  const { hasPermission } = usePermissions();
  const [criteria, setCriteria] = useState<ReplayCriteria>({
    timeRange: '1h',
    batchSize: 5,
    priority: 'normal',
    reason: '',
    dryRun: false,
  });

  const [isReplaying, setIsReplaying] = useState(false);
  const [activeReplays, setActiveReplays] = useState<Map<string, ReplayStatus>>(new Map());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewResults, setPreviewResults] = useState<any>(null);

  // Check permissions
  const canReplay = hasPermission(Permission.REPLAY_WORKFLOWS);
  const canControlAgents = hasPermission(Permission.CONTROL_AGENTS);

  useEffect(() => {
    // Poll for active replay status updates
    const pollReplays = async () => {
      for (const [replayId, status] of activeReplays) {
        if (['running'].includes(status.status)) {
          try {
            const updatedStatus = await onGetReplayStatus(replayId);
            setActiveReplays(prev => new Map(prev.set(replayId, updatedStatus)));

            // Remove completed/failed replays after 30 seconds
            if (['completed', 'failed', 'cancelled'].includes(updatedStatus.status)) {
              setTimeout(() => {
                setActiveReplays(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(replayId);
                  return newMap;
                });
              }, 30000);
            }
          } catch (error) {
            console.warn(`Failed to get status for replay ${replayId}:`, error);
          }
        }
      }
    };

    const interval = setInterval(pollReplays, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [activeReplays, onGetReplayStatus]);

  const handlePreview = async () => {
    if (!criteria.reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for the replay operation',
        variant: 'destructive',
      });
      return;
    }

    setPreviewMode(true);
    try {
      // This would call a preview endpoint to show what events would be replayed
      const previewData = await fetch('/api/replay/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(criteria),
      }).then(res => res.json());

      setPreviewResults(previewData);

      toast({
        title: 'Preview Generated',
        description: `Found ${previewData.eventCount} events matching criteria`,
      });
    } catch (error) {
      toast({
        title: 'Preview Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPreviewMode(false);
    }
  };

  const handleRerunGrading = async () => {
    if (!canReplay) {
      toast({
        title: 'Access Denied',
        description: "You don't have permission to replay workflows",
        variant: 'destructive',
      });
      return;
    }

    if (!criteria.reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for the grading replay',
        variant: 'destructive',
      });
      return;
    }

    setIsReplaying(true);
    try {
      const result = await onReplayGrading(criteria);

      if (result.success) {
        // Add to active replays for monitoring
        setActiveReplays(
          prev =>
            new Map(
              prev.set(result.replayId, {
                id: result.replayId,
                status: 'running',
                progress: {
                  completed: 0,
                  total: result.eventCount,
                  currentStep: 'Initializing replay...',
                  estimatedCompletion: new Date(
                    Date.now() + (result.estimatedDuration || 300000)
                  ).toISOString(),
                },
                metrics: {
                  processingTime: 0,
                  alertsGenerated: 0,
                  opportunitiesFound: 0,
                  errorsEncountered: 0,
                },
              })
            )
        );

        toast({
          title: 'Grading Replay Started',
          description: result.message,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        title: 'Replay Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsReplaying(false);
    }
  };

  const handleReemitAlerts = async () => {
    if (!canReplay) {
      toast({
        title: 'Access Denied',
        description: "You don't have permission to replay workflows",
        variant: 'destructive',
      });
      return;
    }

    if (!criteria.reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for alert re-emission',
        variant: 'destructive',
      });
      return;
    }

    setIsReplaying(true);
    try {
      const result = await onReemitAlerts(criteria);

      if (result.success) {
        setActiveReplays(
          prev =>
            new Map(
              prev.set(result.replayId, {
                id: result.replayId,
                status: 'running',
                progress: {
                  completed: 0,
                  total: result.eventCount,
                  currentStep: 'Re-emitting alerts...',
                  estimatedCompletion: new Date(
                    Date.now() + (result.estimatedDuration || 120000)
                  ).toISOString(),
                },
                metrics: {
                  processingTime: 0,
                  alertsGenerated: 0,
                  opportunitiesFound: 0,
                  errorsEncountered: 0,
                },
              })
            )
        );

        toast({
          title: 'Alert Re-emission Started',
          description: result.message,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        title: 'Re-emission Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsReplaying(false);
    }
  };

  const handleCancelReplay = async (replayId: string) => {
    try {
      await onCancelReplay(replayId);

      setActiveReplays(prev => {
        const newMap = new Map(prev);
        const status = newMap.get(replayId);
        if (status) {
          newMap.set(replayId, { ...status, status: 'cancelled' });
        }
        return newMap;
      });

      toast({
        title: 'Replay Cancelled',
        description: `Replay ${replayId.substring(0, 8)} has been cancelled`,
      });
    } catch (error) {
      toast({
        title: 'Cancellation Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <StopCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!canReplay) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <AlertTriangle className="w-5 h-5" />
            <span>You don't have permission to access replay controls</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Replay Control Panel */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <RotateCcw className="w-5 h-5 mr-2" />
              Event Replay Control Panel
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)}>
                <Settings className="w-4 h-4 mr-2" />
                {showAdvanced ? 'Basic' : 'Advanced'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Reason Field (Required) */}
          <div>
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason for Replay <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Describe why you're replaying these events (e.g., 'Fixing missing alerts after system downtime')"
              value={criteria.reason}
              onChange={e => setCriteria(prev => ({ ...prev, reason: e.target.value }))}
              className="mt-1"
              required
            />
          </div>

          {/* Time Range and Event Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timeRange">Time Range</Label>
              <Select
                value={criteria.timeRange}
                onValueChange={value => setCriteria(prev => ({ ...prev, timeRange: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="6h">Last 6 Hours</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="eventType">Event Type (Optional)</Label>
              <Select
                value={criteria.eventType || ''}
                onValueChange={value =>
                  setCriteria(prev => ({ ...prev, eventType: value || undefined }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Events</SelectItem>
                  <SelectItem value="ticket.submitted.v1">Ticket Submissions</SelectItem>
                  <SelectItem value="grading.completed.v1">Grading Completions</SelectItem>
                  <SelectItem value="alert.triggered.v1">Alert Triggers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Range */}
          {criteria.timeRange === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customStart">Start Time</Label>
                <Input
                  type="datetime-local"
                  value={criteria.customStart || ''}
                  onChange={e => setCriteria(prev => ({ ...prev, customStart: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="customEnd">End Time</Label>
                <Input
                  type="datetime-local"
                  value={criteria.customEnd || ''}
                  onChange={e => setCriteria(prev => ({ ...prev, customEnd: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <h4 className="font-medium">Advanced Options</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="batchSize">Batch Size</Label>
                  <Select
                    value={String(criteria.batchSize)}
                    onValueChange={value =>
                      setCriteria(prev => ({ ...prev, batchSize: Number(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 (Slowest, Safest)</SelectItem>
                      <SelectItem value="5">5 (Recommended)</SelectItem>
                      <SelectItem value="10">10 (Faster)</SelectItem>
                      <SelectItem value="20">20 (Fastest)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={criteria.priority}
                    onValueChange={value =>
                      setCriteria(prev => ({ ...prev, priority: value as any }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="dryRun"
                    checked={criteria.dryRun}
                    onCheckedChange={checked => setCriteria(prev => ({ ...prev, dryRun: checked }))}
                  />
                  <Label htmlFor="dryRun">Dry Run (Preview Only)</Label>
                </div>
              </div>
            </div>
          )}

          {/* Preview Button */}
          <div className="flex justify-center">
            <Button
              onClick={handlePreview}
              disabled={previewMode || !criteria.reason.trim()}
              variant="outline"
            >
              {previewMode ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Preview Events
            </Button>
          </div>

          {/* Preview Results */}
          {previewResults && (
            <div className="p-4 border rounded-lg bg-blue-50">
              <h4 className="font-medium mb-2">Preview Results</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Events Found:</span>
                  <div className="text-lg font-bold">{previewResults.eventCount}</div>
                </div>
                <div>
                  <span className="font-medium">Est. Duration:</span>
                  <div className="text-lg font-bold">
                    {Math.ceil(previewResults.estimatedDuration / 60000)}m
                  </div>
                </div>
                <div>
                  <span className="font-medium">Tickets:</span>
                  <div className="text-lg font-bold">{previewResults.ticketCount}</div>
                </div>
                <div>
                  <span className="font-medium">Grading Events:</span>
                  <div className="text-lg font-bold">{previewResults.gradingCount}</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <Button
              onClick={handleRerunGrading}
              disabled={isReplaying || !criteria.reason.trim()}
              className="flex-1"
              variant="outline"
            >
              {isReplaying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              {criteria.dryRun ? 'Preview Grading Replay' : 'Re-run Grading'}
            </Button>

            <Button
              onClick={handleReemitAlerts}
              disabled={isReplaying || !criteria.reason.trim()}
              className="flex-1"
              variant="outline"
            >
              {isReplaying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {criteria.dryRun ? 'Preview Alert Re-emission' : 'Re-emit Alerts'}
            </Button>
          </div>

          {/* Warning Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <strong>Important:</strong> Replay operations will reprocess events and may generate
              duplicate notifications. All operations are logged and include idempotency measures to
              prevent data corruption.
              {criteria.dryRun && (
                <div className="mt-2 font-medium">
                  🔍 Dry Run Mode: No actual changes will be made, only preview results will be
                  shown.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Replays Monitoring */}
      {activeReplays.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Active Replays ({activeReplays.size})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from(activeReplays.entries()).map(([replayId, status]) => (
                <div key={replayId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(status.status)}
                      <div>
                        <div className="font-medium">Replay {replayId.substring(0, 8)}</div>
                        <div className="text-sm text-muted-foreground">
                          {status.progress.currentStep}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(status.status)}>{status.status}</Badge>
                      {status.status === 'running' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelReplay(replayId)}
                        >
                          <StopCircle className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>
                        {status.progress.completed} / {status.progress.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(status.progress.completed / status.progress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Processing Time</span>
                      <div className="font-medium">
                        {Math.round(status.metrics.processingTime / 1000)}s
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Alerts Generated</span>
                      <div className="font-medium">{status.metrics.alertsGenerated}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Opportunities</span>
                      <div className="font-medium">{status.metrics.opportunitiesFound}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Errors</span>
                      <div
                        className={`font-medium ${status.metrics.errorsEncountered > 0 ? 'text-red-600' : ''}`}
                      >
                        {status.metrics.errorsEncountered}
                      </div>
                    </div>
                  </div>

                  {/* Errors */}
                  {status.errors && status.errors.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <h5 className="font-medium text-red-800 mb-2">Recent Errors:</h5>
                      <div className="space-y-1 max-h-20 overflow-y-auto">
                        {status.errors.slice(-3).map((error, index) => (
                          <div key={index} className="text-sm text-red-700">
                            <span className="font-medium">{error.step}:</span> {error.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
