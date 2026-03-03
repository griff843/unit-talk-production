/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)
 * Wizard State Reducer
 *
 * Extracted state management from PickWizard.tsx for:
 * - Predictable state transitions
 * - Unit testability
 * - Clear action/state boundaries
 */

import { Sport, BetCategory, Direction, TicketLeg } from '../types';
import { PickState } from './validation';

// Entry mode types
export type EntryMode = 'search' | 'manual';

// Wizard state
export interface WizardState {
  currentStep: number;
  completedSteps: number[];
  entryMode: EntryMode;
  pick: PickState;
  legs: TicketLeg[];
}

// Action types
export type WizardAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'COMPLETE_STEP'; step: number }
  | { type: 'SET_ENTRY_MODE'; mode: EntryMode }
  | { type: 'UPDATE_PICK'; updates: Partial<PickState> }
  | { type: 'SET_SPORT'; sport: Sport }
  | { type: 'SET_BET_CATEGORY'; category: BetCategory }
  | { type: 'ADD_LEG'; leg: TicketLeg }
  | { type: 'REMOVE_LEG'; legId: string }
  | { type: 'RESET_WIZARD' }
  | { type: 'RESET_PICK' };

// Initial pick state
export const initialPickState: PickState = {
  sport: '',
  betCategory: '',
  team: '',
  teamId: '',
  player: '',
  playerId: '',
  statType: '',
  line: '',
  direction: '',
  odds: '',
  gameId: '',
  gameLabel: '',
  source: 'api',
};

// Initial wizard state
export const initialWizardState: WizardState = {
  currentStep: 1,
  completedSteps: [],
  entryMode: 'search',
  pick: initialPickState,
  legs: [],
};

/**
 * Wizard state reducer
 */
export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return {
        ...state,
        currentStep: action.step,
      };

    case 'COMPLETE_STEP':
      return {
        ...state,
        completedSteps: state.completedSteps.includes(action.step)
          ? state.completedSteps
          : [...state.completedSteps, action.step],
      };

    case 'SET_ENTRY_MODE':
      return {
        ...state,
        entryMode: action.mode,
        pick: {
          ...state.pick,
          source: action.mode === 'manual' ? 'manual' : 'api',
        },
      };

    case 'UPDATE_PICK':
      return {
        ...state,
        pick: {
          ...state.pick,
          ...action.updates,
        },
      };

    case 'SET_SPORT':
      // Reset downstream fields when sport changes
      return {
        ...state,
        pick: {
          ...state.pick,
          sport: action.sport,
          team: '',
          teamId: '',
          player: '',
          playerId: '',
          statType: '',
          gameId: '',
          gameLabel: '',
        },
      };

    case 'SET_BET_CATEGORY':
      // Reset participant fields when bet type changes
      return {
        ...state,
        pick: {
          ...state.pick,
          betCategory: action.category,
          team: '',
          teamId: '',
          player: '',
          playerId: '',
          statType: '',
          direction: '',
        },
      };

    case 'ADD_LEG':
      return {
        ...state,
        legs: [...state.legs, action.leg],
        // Reset for next leg
        pick: initialPickState,
        currentStep: 1,
        completedSteps: [],
      };

    case 'REMOVE_LEG':
      return {
        ...state,
        legs: state.legs.filter(l => l.id !== action.legId),
      };

    case 'RESET_WIZARD':
      return initialWizardState;

    case 'RESET_PICK':
      return {
        ...state,
        pick: initialPickState,
      };

    default:
      return state;
  }
}

// Action creators for type safety
export const actions = {
  setStep: (step: number): WizardAction => ({ type: 'SET_STEP', step }),
  completeStep: (step: number): WizardAction => ({ type: 'COMPLETE_STEP', step }),
  setEntryMode: (mode: EntryMode): WizardAction => ({ type: 'SET_ENTRY_MODE', mode }),
  updatePick: (updates: Partial<PickState>): WizardAction => ({ type: 'UPDATE_PICK', updates }),
  setSport: (sport: Sport): WizardAction => ({ type: 'SET_SPORT', sport }),
  setBetCategory: (category: BetCategory): WizardAction => ({ type: 'SET_BET_CATEGORY', category }),
  addLeg: (leg: TicketLeg): WizardAction => ({ type: 'ADD_LEG', leg }),
  removeLeg: (legId: string): WizardAction => ({ type: 'REMOVE_LEG', legId }),
  resetWizard: (): WizardAction => ({ type: 'RESET_WIZARD' }),
  resetPick: (): WizardAction => ({ type: 'RESET_PICK' }),
};
