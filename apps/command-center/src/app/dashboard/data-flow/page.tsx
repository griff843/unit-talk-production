'use client';

import { RealTimeDataFlow } from '@/components/monitoring/RealTimeDataFlow';

export default function DataFlowPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Real-Time Data Flow Monitor</h1>
        <p className="text-muted-foreground">
          Live tracking of FeedAgent props ingestion, grading results, approval queues, and agent
          activity
        </p>
      </div>

      {/* Real-Time Data Flow Component */}
      <RealTimeDataFlow />
    </div>
  );
}
