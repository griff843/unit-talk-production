'use client';

/**
 * Build Info Footer Component
 *
 * PHASE-2-PRODUCTION-READINESS-019: System Reconciliation
 * Displays short SHA in footer for runtime verification
 */

import { useEffect, useState } from 'react';

interface VersionInfo {
  service: string;
  branch: string;
  commit: string;
  environment: string;
}

export function BuildInfo() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch('/api/version')
      .then((res) => res.json())
      .then((data) => setVersionInfo(data))
      .catch(() => {
        // Fallback to env vars
        setVersionInfo({
          service: 'smart-form',
          branch: 'unknown',
          commit: 'dev',
          environment: process.env.NODE_ENV || 'development',
        });
      });
  }, []);

  if (!versionInfo) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border py-1 px-4 text-xs text-muted-foreground flex justify-between items-center z-50">
      <span>Unit Talk Smart Form</span>
      <span className="font-mono">
        build:{versionInfo.commit} | env:{versionInfo.environment} | branch:{versionInfo.branch}
      </span>
    </div>
  );
}

export default BuildInfo;
