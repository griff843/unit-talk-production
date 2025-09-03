import React from 'react';

export interface StatusPillProps {
  state: 'ok' | 'degraded' | 'down';
  label: string;
}

export function StatusPill({ state, label }: StatusPillProps) {
  const stateConfig = {
    ok: {
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      borderColor: 'border-green-200',
      dotColor: 'bg-green-500',
    },
    degraded: {
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      borderColor: 'border-yellow-200',
      dotColor: 'bg-yellow-500',
    },
    down: {
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      borderColor: 'border-red-200',
      dotColor: 'bg-red-500',
    },
  };

  const config = stateConfig[state];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.bgColor} ${config.textColor} ${config.borderColor}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dotColor} animate-pulse`} />
      {label}
    </span>
  );
}