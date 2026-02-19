import { supabase } from '@/lib/supabase';

describe('Smart Form', () => {
  beforeEach(() => {
    cy.visit('/submit-ticket');
    // Reset Supabase mock data
    cy.window().then((win: any) => {
      win.Cypress = win.Cypress || {};
      win.Cypress.supabase = supabase;
    });
  });

  describe('Form Loading and Initial State', () => {
    it('should load the form successfully', () => {
      cy.get('h1').should('contain', 'Submit Ticket');
      cy.get('form').should('exist');
    });

    it('should have correct default values', () => {
      cy.get('select[name="capper"]').should('have.value', 'Griff');
      cy.get('input[name="unit_size"]').should('have.value', '1');
      cy.get('input[name="auto_parlay"]').should('be.checked');
      cy.get('[data-testid="leg-card"]').should('have.length', 1);
    });

    it('should show database connection error if Supabase is not configured', () => {
      // Simulate Supabase connection error
      cy.intercept('**/rest/v1/health_check*', {
        statusCode: 500,
        body: { error: 'Database connection failed' },
      }).as('healthCheck');

      cy.reload();
      cy.get('.toast').should('contain', 'Connection Error');
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', () => {
      cy.get('button[type="submit"]').click();
      cy.get('.text-destructive').should('exist');
    });

    it('should validate unit size range', () => {
      cy.get('input[name="unit_size"]').clear().type('6');
      cy.get('button[type="submit"]').click();
      cy.get('.toast').should('contain', 'Invalid Unit Size');
    });

    it('should validate leg data', () => {
      cy.get('[data-testid="leg-card"]').within(() => {
        cy.get('button[type="submit"]').click();
        cy.get('.text-destructive').should('exist');
      });
    });
  });

  describe('Leg Management', () => {
    it('should handle adding and removing legs', () => {
      // Initial leg should exist
      cy.get('[data-testid="leg-card"]').should('have.length', 1);

      // Add a leg
      cy.get('button').contains('Add Leg').click();
      cy.get('[data-testid="leg-card"]').should('have.length', 2);

      // Remove the second leg
      cy.get('[data-testid="remove-leg"]').last().click();
      cy.get('[data-testid="leg-card"]').should('have.length', 1);
    });

    it('should prevent removing primary leg', () => {
      cy.get('[data-testid="remove-leg"]').first().click();
      cy.get('.toast').should('contain', 'Cannot Remove Primary Leg');
      cy.get('[data-testid="leg-card"]').should('have.length', 1);
    });

    it('should handle leg type changes', () => {
      cy.get('select[name="bet_type"]').select('Game Line');
      cy.get('input[name="matchup"]').should('exist');
    });
  });

  describe('Search Functionality', () => {
    it('should handle player search', () => {
      // Mock player search response
      cy.intercept('**/rest/v1/players*', {
        statusCode: 200,
        body: [
          {
            id: '1',
            player_name: 'LeBron James',
            team: 'Lakers',
          },
        ],
      }).as('playerSearch');

      cy.get('input[name="player_search"]').type('LeBron');
      cy.wait('@playerSearch');
      cy.get('.search-results').should('contain', 'LeBron James');
      cy.get('.search-results').click();
      cy.get('input[name="player_name"]').should('have.value', 'LeBron James');
    });

    it('should handle game search', () => {
      cy.get('select[name="bet_type"]').select('Game Line');

      // Mock game search response
      cy.intercept('**/rest/v1/games*', {
        statusCode: 200,
        body: [
          {
            id: '1',
            matchup: 'Lakers vs Warriors',
            home_team: 'Lakers',
            away_team: 'Warriors',
            game_date: '2024-01-09',
          },
        ],
      }).as('gameSearch');

      cy.get('input[name="game_search"]').type('Lakers');
      cy.wait('@gameSearch');
      cy.get('.search-results').should('contain', 'Lakers vs Warriors');
      cy.get('.search-results').click();
      cy.get('input[name="matchup"]').should('have.value', 'Lakers vs Warriors');
    });

    it('should handle search errors gracefully', () => {
      cy.intercept('**/rest/v1/players*', {
        statusCode: 500,
        body: { error: 'Search failed' },
      }).as('failedSearch');

      cy.get('input[name="player_search"]').type('LeBron');
      cy.wait('@failedSearch');
      cy.get('.toast').should('contain', 'Search Error');
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      // Fill out form with valid data
      cy.get('select[name="capper"]').select('Griff');
      cy.get('input[name="unit_size"]').clear().type('1');
      cy.get('select[name="bet_type"]').select('Player Prop');
      cy.get('input[name="player_name"]').type('LeBron James');
      cy.get('input[name="line"]').type('25.5');
      cy.get('input[name="odds"]').type('-110');
    });

    it('should handle successful submission', () => {
      // Mock successful submission
      cy.intercept('POST', '**/rest/v1/tickets*', {
        statusCode: 200,
        body: { id: '1' },
      }).as('submitTicket');

      cy.get('button[type="submit"]').click();
      cy.wait('@submitTicket');
      cy.get('.toast').should('contain', 'Success');

      // Form should be reset
      cy.get('input[name="unit_size"]').should('have.value', '1');
      cy.get('[data-testid="leg-card"]').should('have.length', 1);
    });

    it('should handle submission errors', () => {
      // Mock submission error
      cy.intercept('POST', '**/rest/v1/tickets*', {
        statusCode: 500,
        body: { error: 'Submission failed' },
      }).as('failedSubmit');

      cy.get('button[type="submit"]').click();
      cy.wait('@failedSubmit');
      cy.get('.toast').should('contain', 'Error');
    });

    it('should show loading state during submission', () => {
      cy.intercept('POST', '**/rest/v1/tickets*', {
        delay: 1000,
        statusCode: 200,
        body: { id: '1' },
      }).as('slowSubmit');

      cy.get('button[type="submit"]').click();
      cy.get('button[type="submit"]').should('be.disabled');
      cy.get('.spinner').should('exist');
      cy.wait('@slowSubmit');
      cy.get('.spinner').should('not.exist');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      cy.get('form').should('have.attr', 'role', 'form');
      cy.get('button[type="submit"]').should('have.attr', 'aria-label');
      cy.get('select').should('have.attr', 'aria-label');
    });

    it('should handle keyboard navigation', () => {
      cy.get('form').first().focus();
      cy.realPress('Tab');
      cy.focused().should('exist');
    });

    it('should have sufficient color contrast', () => {
      // This requires additional plugins for color contrast checking
      cy.get('button[type="submit"]').should('have.css', 'background-color');
      cy.get('.text-destructive').should('have.css', 'color');
    });
  });

  describe('Theme Support', () => {
    it('should handle theme switching', () => {
      cy.get('[data-testid="theme-toggle"]').click();
      cy.get('html').should('have.class', 'dark');
      cy.get('[data-testid="theme-toggle"]').click();
      cy.get('html').should('not.have.class', 'dark');
    });

    it('should persist theme preference', () => {
      cy.get('[data-testid="theme-toggle"]').click();
      cy.reload();
      cy.get('html').should('have.class', 'dark');
    });
  });
});
