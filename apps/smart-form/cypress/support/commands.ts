import { supabase } from '@/lib/supabase';

declare global {
  namespace Cypress {
    interface Cypress {
      supabase: typeof supabase;
    }
    interface Chainable {
      /**
       * Custom command to simulate keyboard interactions
       * @example cy.realPress('Tab')
       */
      realPress(key: string): Chainable<Element>;
    }
  }
}

// Add supabase to Cypress
Cypress.supabase = supabase;

// Add keyboard interaction command
Cypress.Commands.add('realPress', (key: string) => {
  cy.get('body').trigger('keydown', { key });
  cy.get('body').trigger('keyup', { key });
});
