'use client';

import OpsConfidenceWidget from '@/components/dashboard/OpsConfidenceWidget';
import SettlementConsole from '@/components/dashboard/SettlementConsole';
import UnsettledSummaryWidget from '@/components/dashboard/UnsettledSummaryWidget';

/** Dedicated settlement page accessible via sidebar. */
export default function SettlementPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Settlement</h1>
      <SettlementConsole />
      <div className="grid gap-4 md:grid-cols-2">
        <OpsConfidenceWidget />
        <UnsettledSummaryWidget />
      </div>
    </div>
  );
}
