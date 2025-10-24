'use client';

import { useEffect, useState } from 'react';

interface ClientTimeProps {
  date: Date;
  format?: 'time' | 'datetime' | 'date';
}

export function ClientTime({ date, format = 'time' }: ClientTimeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span>--:--:--</span>;
  }

  switch (format) {
    case 'time':
      return <span>{date.toLocaleTimeString()}</span>;
    case 'date':
      return <span>{date.toLocaleDateString()}</span>;
    case 'datetime':
      return <span>{date.toLocaleString()}</span>;
    default:
      return <span>{date.toLocaleTimeString()}</span>;
  }
}
