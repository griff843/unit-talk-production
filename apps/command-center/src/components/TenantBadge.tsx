'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';

interface TenantBadgeProps {
  tenant: string | null;
}

export function TenantBadge({ tenant }: TenantBadgeProps) {
  if (!tenant || tenant === 'default') {
    return null;
  }

  return (
    <Badge variant="outline" className="ml-2">
      {tenant}
    </Badge>
  );
}