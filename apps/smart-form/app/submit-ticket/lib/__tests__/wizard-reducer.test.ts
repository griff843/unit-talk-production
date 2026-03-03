/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)
 * Unit Tests: Wizard State Transitions
 *
 * Tests for predictable state management in the PickWizard.
 */

import {
  wizardReducer,
  initialWizardState,
  initialPickState,
  actions,
  WizardState,
} from '../wizard-reducer';
import { TicketLeg } from '../../types';

describe('wizardReducer', () => {
  describe('SET_STEP', () => {
    it('should update current step', () => {
      const state = wizardReducer(initialWizardState, actions.setStep(2));
      expect(state.currentStep).toBe(2);
    });

    it('should not affect other state', () => {
      const state = wizardReducer(initialWizardState, actions.setStep(3));
      expect(state.entryMode).toBe('search');
      expect(state.legs).toHaveLength(0);
    });
  });

  describe('COMPLETE_STEP', () => {
    it('should add step to completedSteps', () => {
      const state = wizardReducer(initialWizardState, actions.completeStep(1));
      expect(state.completedSteps).toContain(1);
    });

    it('should not duplicate completed steps', () => {
      let state = wizardReducer(initialWizardState, actions.completeStep(1));
      state = wizardReducer(state, actions.completeStep(1));
      expect(state.completedSteps.filter(s => s === 1)).toHaveLength(1);
    });

    it('should allow multiple steps to be completed', () => {
      let state = wizardReducer(initialWizardState, actions.completeStep(1));
      state = wizardReducer(state, actions.completeStep(2));
      expect(state.completedSteps).toContain(1);
      expect(state.completedSteps).toContain(2);
    });
  });

  describe('SET_ENTRY_MODE', () => {
    it('should update entry mode to manual', () => {
      const state = wizardReducer(initialWizardState, actions.setEntryMode('manual'));
      expect(state.entryMode).toBe('manual');
      expect(state.pick.source).toBe('manual');
    });

    it('should update entry mode to search', () => {
      const manualState: WizardState = {
        ...initialWizardState,
        entryMode: 'manual',
        pick: { ...initialPickState, source: 'manual' },
      };
      const state = wizardReducer(manualState, actions.setEntryMode('search'));
      expect(state.entryMode).toBe('search');
      expect(state.pick.source).toBe('api');
    });
  });

  describe('UPDATE_PICK', () => {
    it('should update pick fields', () => {
      const state = wizardReducer(
        initialWizardState,
        actions.updatePick({ odds: '-110', line: '24.5' })
      );
      expect(state.pick.odds).toBe('-110');
      expect(state.pick.line).toBe('24.5');
    });

    it('should preserve other pick fields', () => {
      const stateWithSport: WizardState = {
        ...initialWizardState,
        pick: { ...initialPickState, sport: 'NBA' },
      };
      const state = wizardReducer(stateWithSport, actions.updatePick({ odds: '-110' }));
      expect(state.pick.sport).toBe('NBA');
      expect(state.pick.odds).toBe('-110');
    });
  });

  describe('SET_SPORT', () => {
    it('should update sport', () => {
      const state = wizardReducer(initialWizardState, actions.setSport('NBA'));
      expect(state.pick.sport).toBe('NBA');
    });

    it('should reset downstream fields on sport change', () => {
      const stateWithTeam: WizardState = {
        ...initialWizardState,
        pick: {
          ...initialPickState,
          sport: 'NBA',
          team: 'Lakers',
          teamId: '123',
          player: 'LeBron',
          playerId: '456',
          statType: 'PTS',
        },
      };
      const state = wizardReducer(stateWithTeam, actions.setSport('NFL'));
      expect(state.pick.sport).toBe('NFL');
      expect(state.pick.team).toBe('');
      expect(state.pick.teamId).toBe('');
      expect(state.pick.player).toBe('');
      expect(state.pick.playerId).toBe('');
      expect(state.pick.statType).toBe('');
    });
  });

  describe('SET_BET_CATEGORY', () => {
    it('should update bet category', () => {
      const state = wizardReducer(initialWizardState, actions.setBetCategory('player_prop'));
      expect(state.pick.betCategory).toBe('player_prop');
    });

    it('should reset participant fields on bet type change', () => {
      const stateWithPlayer: WizardState = {
        ...initialWizardState,
        pick: {
          ...initialPickState,
          betCategory: 'player_prop',
          player: 'LeBron',
          playerId: '456',
          statType: 'PTS',
          direction: 'over',
        },
      };
      const state = wizardReducer(stateWithPlayer, actions.setBetCategory('spread'));
      expect(state.pick.betCategory).toBe('spread');
      expect(state.pick.player).toBe('');
      expect(state.pick.playerId).toBe('');
      expect(state.pick.statType).toBe('');
      expect(state.pick.direction).toBe('');
    });
  });

  describe('ADD_LEG', () => {
    it('should add leg to legs array', () => {
      const leg: TicketLeg = {
        id: 'leg-1',
        sport: 'NBA',
        bet_category: 'player_prop',
        player_name: 'LeBron James',
        prop_type: 'PTS',
        line: '24.5',
        direction: 'over',
        odds: '-110',
        status: 'open',
      };
      const state = wizardReducer(initialWizardState, actions.addLeg(leg));
      expect(state.legs).toHaveLength(1);
      expect(state.legs[0].id).toBe('leg-1');
    });

    it('should reset pick and step after adding leg', () => {
      const stateWithPick: WizardState = {
        ...initialWizardState,
        currentStep: 3,
        completedSteps: [1, 2],
        pick: {
          ...initialPickState,
          sport: 'NBA',
          betCategory: 'player_prop',
          player: 'LeBron',
        },
      };
      const leg: TicketLeg = {
        id: 'leg-1',
        sport: 'NBA',
        bet_category: 'player_prop',
        player_name: 'LeBron',
        odds: '-110',
        status: 'open',
      };
      const state = wizardReducer(stateWithPick, actions.addLeg(leg));
      expect(state.currentStep).toBe(1);
      expect(state.completedSteps).toHaveLength(0);
      expect(state.pick).toEqual(initialPickState);
    });
  });

  describe('REMOVE_LEG', () => {
    it('should remove leg by id', () => {
      const stateWithLegs: WizardState = {
        ...initialWizardState,
        legs: [
          { id: 'leg-1', sport: 'NBA', bet_category: 'spread', odds: '-110', status: 'open' },
          { id: 'leg-2', sport: 'NFL', bet_category: 'moneyline', odds: '+150', status: 'open' },
        ],
      };
      const state = wizardReducer(stateWithLegs, actions.removeLeg('leg-1'));
      expect(state.legs).toHaveLength(1);
      expect(state.legs[0].id).toBe('leg-2');
    });

    it('should not affect state if leg not found', () => {
      const stateWithLegs: WizardState = {
        ...initialWizardState,
        legs: [{ id: 'leg-1', sport: 'NBA', bet_category: 'spread', odds: '-110', status: 'open' }],
      };
      const state = wizardReducer(stateWithLegs, actions.removeLeg('non-existent'));
      expect(state.legs).toHaveLength(1);
    });
  });

  describe('RESET_WIZARD', () => {
    it('should reset to initial state', () => {
      const modifiedState: WizardState = {
        currentStep: 4,
        completedSteps: [1, 2, 3],
        entryMode: 'manual',
        pick: {
          ...initialPickState,
          sport: 'NBA',
          betCategory: 'player_prop',
          player: 'LeBron',
        },
        legs: [
          { id: 'leg-1', sport: 'NBA', bet_category: 'player_prop', odds: '-110', status: 'open' },
        ],
      };
      const state = wizardReducer(modifiedState, actions.resetWizard());
      expect(state).toEqual(initialWizardState);
    });
  });

  describe('RESET_PICK', () => {
    it('should reset only pick state', () => {
      const stateWithLegs: WizardState = {
        currentStep: 2,
        completedSteps: [1],
        entryMode: 'search',
        pick: {
          ...initialPickState,
          sport: 'NBA',
          player: 'LeBron',
        },
        legs: [{ id: 'leg-1', sport: 'NBA', bet_category: 'spread', odds: '-110', status: 'open' }],
      };
      const state = wizardReducer(stateWithLegs, actions.resetPick());
      expect(state.pick).toEqual(initialPickState);
      expect(state.legs).toHaveLength(1);
      expect(state.currentStep).toBe(2);
    });
  });
});
