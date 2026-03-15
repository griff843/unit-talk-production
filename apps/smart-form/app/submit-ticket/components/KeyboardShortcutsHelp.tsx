'use client';

/**
 * KeyboardShortcutsHelp
 *
 * SPRINT-051-LAYER3-PHASE9-SMARTFORM-UX-POLISH
 *
 * Documents and surfaces existing keyboard shortcuts available in the
 * Smart Form submission flow. Toggles open/closed via a help button.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShortcutEntry {
  keys: string[];
  description: string;
  context: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  {
    keys: ['Enter'],
    description: 'Add current leg to bet slip',
    context: 'Bet builder — when a capper and leg details are filled in',
  },
  {
    keys: ['Esc'],
    description: 'Clear the current leg form',
    context: 'Bet builder — resets sport, teams, and selection fields',
  },
  {
    keys: ['↑', '↓'],
    description: 'Navigate player suggestions',
    context: 'Player search dropdown — move between results',
  },
  {
    keys: ['Enter'],
    description: 'Select highlighted player',
    context: 'Player search dropdown — confirms the focused suggestion',
  },
  {
    keys: ['Esc'],
    description: 'Close player suggestions',
    context: 'Player search dropdown — dismiss without selecting',
  },
];

export function KeyboardShortcutsHelp({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(prev => !prev)}
        aria-label={open ? 'Close keyboard shortcuts help' : 'Show keyboard shortcuts'}
        aria-expanded={open}
        aria-controls="keyboard-shortcuts-panel"
        className="h-8 px-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
      >
        <Keyboard className="h-4 w-4 mr-1.5" aria-hidden="true" />
        <span className="text-xs">Shortcuts</span>
      </Button>

      {open && (
        <div
          id="keyboard-shortcuts-panel"
          role="dialog"
          aria-label="Keyboard shortcuts"
          aria-modal="false"
          className={cn(
            'absolute right-0 top-9 z-50 w-80',
            'bg-slate-800 border border-slate-600 rounded-lg shadow-xl',
            'p-4'
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Keyboard className="h-4 w-4" aria-hidden="true" />
              Keyboard Shortcuts
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Close keyboard shortcuts"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>

          <ul className="space-y-3" role="list">
            {SHORTCUTS.map((shortcut, idx) => (
              <li key={idx} className="text-xs">
                <div className="flex items-start gap-2">
                  <div className="flex gap-1 shrink-0 mt-0.5">
                    {shortcut.keys.map((key, ki) => (
                      <kbd
                        key={ki}
                        className={cn(
                          'inline-flex items-center justify-center',
                          'h-5 min-w-[20px] px-1',
                          'bg-slate-700 border border-slate-500 rounded',
                          'text-[10px] font-mono text-slate-200'
                        )}
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                  <div>
                    <p className="text-slate-200 font-medium">{shortcut.description}</p>
                    <p className="text-slate-400 mt-0.5">{shortcut.context}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
