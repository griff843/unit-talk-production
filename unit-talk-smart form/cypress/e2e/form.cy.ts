describe('Smart Form', () => {
  beforeEach(() => {
    cy.visit('/submit-ticket');
  });

  it('should load the form successfully', () => {
    cy.get('h1').should('contain', 'Smart Pick Submission');
    cy.get('form').should('exist');
  });

  it('should handle sport selection', () => {
    cy.get('button').contains('NFL Football').click();
    cy.get('button').contains('NFL Football').should('have.class', 'border-blue-500');
  });

  it('should handle capper selection', () => {
    cy.get('select').contains('Griff').should('exist');
    cy.get('select').select('Griff');
  });

  it('should validate required fields', () => {
    cy.get('button').contains('Submit').click();
    cy.get('.text-red-700').should('exist');
  });

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

  it('should handle form submission', () => {
    // Fill out form
    cy.get('select[name="capper"]').select('Griff');
    cy.get('input[name="unit_size"]').clear().type('1');
    cy.get('input[name="confidence_level"]').invoke('val', 5).trigger('change');
    
    // Fill out leg
    cy.get('select[name="bet_type"]').select('Player Prop');
    cy.get('input[name="player_name"]').type('Test Player');
    cy.get('input[name="line"]').type('1.5');
    cy.get('input[name="odds"]').type('-110');

    // Submit
    cy.get('button').contains('Submit').click();

    // Should show success message
    cy.get('.text-green-500').should('exist');
  });

  it('should handle VIP features', () => {
    // Mock VIP user
    cy.window().then((win) => {
      win.localStorage.setItem('userTier', 'vip');
    });
    cy.reload();

    // Should see VIP features
    cy.get('.text-yellow-400').should('exist');
    cy.get('button').contains('AI Optimized').should('exist');
  });
}); 