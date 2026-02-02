'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const SHORTCUT_MAP: Record<string, string> = {
  'g+o': '/dashboard',
  'g+s': '/dashboard#settlement',
  'g+p': '/dashboard/picks',
  'g+a': '/dashboard/agents',
  'g+e': '/dashboard/events',
  'g+d': '/dashboard/data-flow',
};

/**
 * Global keyboard shortcuts for power-user navigation.
 * Press two keys in sequence (e.g. g then o) within 500ms.
 */
export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let buffer = '';
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (timer) clearTimeout(timer);
      buffer += e.key.toLowerCase();
      timer = setTimeout(() => {
        buffer = '';
      }, 500);

      const route = SHORTCUT_MAP[buffer];
      if (route) {
        buffer = '';
        router.push(route);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router]);
}
