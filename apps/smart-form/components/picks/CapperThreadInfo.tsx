/**
 * CapperThreadInfo Component
 *
 * Displays Discord thread information for the selected capper.
 * Auto-hydrates thread data based on userId and league.
 */

'use client';

import * as React from 'react';
import { ExternalLink, MessageSquare, HelpCircle, AlertCircle } from 'lucide-react';

interface ThreadData {
  type: 'picks' | 'qa';
  threadId: string;
  name: string;
  url: string;
}

interface CapperThreadInfoProps {
  userId: string | null;
  league?: string | null;
}

export function CapperThreadInfo({ userId, league }: CapperThreadInfoProps) {
  const [threads, setThreads] = React.useState<ThreadData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [docsUrl, setDocsUrl] = React.useState<string | null>(null);

  // Fetch thread information when userId changes
  React.useEffect(() => {
    if (!userId) {
      setThreads([]);
      setWarning(null);
      return;
    }

    const fetchThreads = async () => {
      setLoading(true);
      try {
        const url = new URL('/api/cappers/threads', window.location.origin);
        url.searchParams.set('userId', userId);
        if (league) {
          url.searchParams.set('league', league);
        }

        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.success) {
          setThreads(data.threads || []);
          setWarning(data.warning || null);
          setDocsUrl(data.docsUrl || null);
        } else {
          setWarning('Failed to load thread information');
        }
      } catch (error) {
        console.error('Failed to fetch capper threads:', error);
        setWarning('Error loading thread information');
      } finally {
        setLoading(false);
      }
    };

    fetchThreads();
  }, [userId, league]);

  if (!userId) {
    return null;
  }

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <div className="w-3 h-3 border-2 border-border border-t-foreground rounded-full animate-spin" />
        Loading thread info...
      </div>
    );
  }

  if (warning && threads.length === 0) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
        <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            {warning}
          </p>
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-yellow-700 dark:text-yellow-300 hover:underline flex items-center gap-1"
            >
              Learn how to set up thread mappings
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    );
  }

  if (threads.length === 0) {
    return null;
  }

  const picksThread = threads.find(t => t.type === 'picks');
  const qaThread = threads.find(t => t.type === 'qa');

  return (
    <div className="space-y-2">
      {picksThread && (
        <a
          href={picksThread.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2.5 rounded-md border border-border bg-accent/50 hover:bg-accent transition-colors text-sm group"
        >
          <MessageSquare className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          <div className="flex-1">
            <div className="font-medium text-foreground">{picksThread.name}</div>
            <div className="text-xs text-muted-foreground">Picks Discussion Thread</div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
        </a>
      )}

      {qaThread && (
        <a
          href={qaThread.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2.5 rounded-md border border-border bg-accent/50 hover:bg-accent transition-colors text-sm group"
        >
          <HelpCircle className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          <div className="flex-1">
            <div className="font-medium text-foreground">{qaThread.name}</div>
            <div className="text-xs text-muted-foreground">Q&A Thread</div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
        </a>
      )}
    </div>
  );
}
