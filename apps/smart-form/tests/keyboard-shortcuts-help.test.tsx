/**
 * Tests for KeyboardShortcutsHelp component
 *
 * SPRINT-051-LAYER3-PHASE9-SMARTFORM-UX-POLISH
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardShortcutsHelp } from '../app/submit-ticket/components/KeyboardShortcutsHelp';

describe('KeyboardShortcutsHelp', () => {
  it('renders the toggle button', () => {
    render(<KeyboardShortcutsHelp />);
    const btn = screen.getByRole('button', { name: /show keyboard shortcuts/i });
    expect(btn).toBeInTheDocument();
  });

  it('toggle button has aria-expanded=false initially', () => {
    render(<KeyboardShortcutsHelp />);
    const btn = screen.getByRole('button', { name: /show keyboard shortcuts/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('panel is not visible initially', () => {
    render(<KeyboardShortcutsHelp />);
    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeInTheDocument();
  });

  it('opens panel on button click', () => {
    render(<KeyboardShortcutsHelp />);
    const btn = screen.getByRole('button', { name: /show keyboard shortcuts/i });
    fireEvent.click(btn);
    expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument();
  });

  it('toggle button has aria-expanded=true when open', () => {
    render(<KeyboardShortcutsHelp />);
    const btn = screen.getByRole('button', { name: /show keyboard shortcuts/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });

  it('displays at least 5 shortcut entries when open', () => {
    render(<KeyboardShortcutsHelp />);
    fireEvent.click(screen.getByRole('button', { name: /show keyboard shortcuts/i }));
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it('shows Enter shortcut for adding a leg', () => {
    render(<KeyboardShortcutsHelp />);
    fireEvent.click(screen.getByRole('button', { name: /show keyboard shortcuts/i }));
    expect(screen.getByText(/add current leg to bet slip/i)).toBeInTheDocument();
  });

  it('shows Esc shortcut for clearing form', () => {
    render(<KeyboardShortcutsHelp />);
    fireEvent.click(screen.getByRole('button', { name: /show keyboard shortcuts/i }));
    expect(screen.getByText(/clear the current leg form/i)).toBeInTheDocument();
  });

  it('closes panel when close button is clicked', () => {
    render(<KeyboardShortcutsHelp />);
    fireEvent.click(screen.getByRole('button', { name: /show keyboard shortcuts/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click the X button inside the panel (not the toggle button)
    fireEvent.click(screen.getByRole('button', { name: /^close keyboard shortcuts$/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggle button label changes when open', () => {
    render(<KeyboardShortcutsHelp />);
    fireEvent.click(screen.getByRole('button', { name: /show keyboard shortcuts/i }));
    expect(
      screen.getByRole('button', { name: /close keyboard shortcuts help/i })
    ).toBeInTheDocument();
  });

  it('panel has aria-controls pointing to panel id', () => {
    render(<KeyboardShortcutsHelp />);
    const btn = screen.getByRole('button', { name: /show keyboard shortcuts/i });
    expect(btn).toHaveAttribute('aria-controls', 'keyboard-shortcuts-panel');
  });
});
