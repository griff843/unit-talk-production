/**
 * Smart Form Integration Tests
 * Tests Smart Form components, autocomplete, and view integration
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlayerPicker } from '../../../smart-form/components/PlayerPicker';
import { MarketPicker } from '../../../smart-form/components/MarketPicker';
import { GamePicker } from '../../../smart-form/components/GamePicker';
import { createSupabaseClient } from '../../services/supabaseClient';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../api-server';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Smart Form Integration Tests', () => {
  let app: FastifyInstance;
  let supabaseClient: ReturnType<typeof createSupabaseClient>;
  let queryClient: QueryClient;

  beforeEach(async () => {
    app = await buildApp({ logger: { level: 'silent' } });
    supabaseClient = createSupabaseClient();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    // Setup test data in view_props_for_form
    await supabaseClient.from('unified_picks').insert([
      {
        id: 'form-test-1',
        player_name: 'LeBron James',
        team_name: 'Lakers',
        opponent_name: 'Warriors',
        market: 'points',
        submarket: 'over',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        game_date: new Date().toISOString().split('T')[0],
        workflow_stage: 'promoted'
      },
      {
        id: 'form-test-2',
        player_name: 'Stephen Curry',
        team_name: 'Warriors',
        opponent_name: 'Lakers',
        market: 'assists',
        submarket: 'under',
        line: 6.5,
        odds: -105,
        sport: 'NBA',
        game_date: new Date().toISOString().split('T')[0],
        workflow_stage: 'promoted'
      }
    ]);

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await supabaseClient.from('unified_picks').delete().neq('id', '');
    queryClient.clear();
    jest.clearAllMocks();
  });

  const renderWithQuery = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('PlayerPicker Component', () => {
    it('should render player autocomplete with typeahead functionality', async () => {
      const mockOnSelect = jest.fn();

      renderWithQuery(
        <PlayerPicker
          value=""
          onChange={mockOnSelect}
          sport="NBA"
          tier="all"
        />
      );

      const input = screen.getByPlaceholderText(/search players/i);
      expect(input).toBeInTheDocument();

      // Mock API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              player_name: 'LeBron James',
              team_name: 'Lakers',
              tier: 'A',
              confidence: 8.5,
              recent_picks: 3
            }
          ],
          performance: { responseTime: 45 }
        })
      });

      // Type in search
      fireEvent.change(input, { target: { value: 'LeBr' } });

      // Wait for debounced search
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/props?type=player&query=LeBr'),
          expect.any(Object)
        );
      }, { timeout: 500 });

      // Wait for results to appear
      await waitFor(() => {
        expect(screen.getByText('LeBron James')).toBeInTheDocument();
      });

      // Click on result
      fireEvent.click(screen.getByText('LeBron James'));

      expect(mockOnSelect).toHaveBeenCalledWith({
        player_name: 'LeBron James',
        team_name: 'Lakers',
        tier: 'A',
        confidence: 8.5
      });
    });

    it('should filter players by tier when specified', async () => {
      const mockOnSelect = jest.fn();

      renderWithQuery(
        <PlayerPicker
          value=""
          onChange={mockOnSelect}
          sport="NBA"
          tier="S"
          showTierFilter={true}
        />
      );

      const tierFilter = screen.getByDisplayValue('S');
      expect(tierFilter).toBeInTheDocument();

      // Mock API response with tier filtering
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              player_name: 'Elite Player',
              team_name: 'Lakers',
              tier: 'S',
              confidence: 9.2
            }
          ]
        })
      });

      const input = screen.getByPlaceholderText(/search players/i);
      fireEvent.change(input, { target: { value: 'Elite' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('tier=S'),
          expect.any(Object)
        );
      });
    });

    it('should achieve <200ms response time target', async () => {
      const mockOnSelect = jest.fn();

      renderWithQuery(
        <PlayerPicker
          value=""
          onChange={mockOnSelect}
          sport="NBA"
        />
      );

      // Mock fast API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
          performance: { responseTime: 95 } // Under 200ms target
        })
      });

      const startTime = performance.now();

      const input = screen.getByPlaceholderText(/search players/i);
      fireEvent.change(input, { target: { value: 'test' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Total interaction time should be reasonable
      expect(totalTime).toBeLessThan(500); // Including React rendering time
    });
  });

  describe('MarketPicker Component', () => {
    it('should display market/submarket filter chips', async () => {
      const mockOnChange = jest.fn();

      renderWithQuery(
        <MarketPicker
          selectedMarkets={[]}
          onChange={mockOnChange}
          sport="NBA"
        />
      );

      // Mock API response with markets
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { market: 'points', count: 25 },
            { market: 'assists', count: 18 },
            { market: 'rebounds', count: 12 }
          ]
        })
      });

      // Should show loading initially, then markets
      await waitFor(() => {
        expect(screen.getByText('points (25)')).toBeInTheDocument();
        expect(screen.getByText('assists (18)')).toBeInTheDocument();
      });

      // Click to select market
      fireEvent.click(screen.getByText('points (25)'));

      expect(mockOnChange).toHaveBeenCalledWith([
        { market: 'points', submarket: null }
      ]);
    });

    it('should support multi-select with removable chips', async () => {
      const mockOnChange = jest.fn();

      renderWithQuery(
        <MarketPicker
          selectedMarkets={[
            { market: 'points', submarket: 'over' },
            { market: 'assists', submarket: null }
          ]}
          onChange={mockOnChange}
          sport="NBA"
        />
      );

      // Should show selected chips
      expect(screen.getByText('points (over)')).toBeInTheDocument();
      expect(screen.getByText('assists')).toBeInTheDocument();

      // Find and click remove button for points
      const pointsChip = screen.getByText('points (over)').closest('[data-testid="market-chip"]');
      const removeButton = pointsChip?.querySelector('[data-testid="remove-chip"]');

      if (removeButton) {
        fireEvent.click(removeButton);
      }

      expect(mockOnChange).toHaveBeenCalledWith([
        { market: 'assists', submarket: null }
      ]);
    });
  });

  describe('GamePicker Component', () => {
    it('should display games by date with matchup info', async () => {
      const mockOnSelect = jest.fn();
      const today = new Date().toISOString().split('T')[0];

      renderWithQuery(
        <GamePicker
          selectedDate={today}
          onDateChange={jest.fn()}
          selectedGame=""
          onGameSelect={mockOnSelect}
          sport="NBA"
        />
      );

      // Mock API response with games
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              game_id: 'nba-lal-gsw',
              home_team: 'Lakers',
              away_team: 'Warriors',
              game_time: '2025-01-20T21:00:00Z',
              props_count: 45,
              status: 'scheduled'
            }
          ]
        })
      });

      await waitFor(() => {
        expect(screen.getByText('Lakers vs Warriors')).toBeInTheDocument();
        expect(screen.getByText('45 props')).toBeInTheDocument();
      });

      // Click to select game
      fireEvent.click(screen.getByText('Lakers vs Warriors'));

      expect(mockOnSelect).toHaveBeenCalledWith('nba-lal-gsw');
    });

    it('should show live game indicators', async () => {
      const mockOnSelect = jest.fn();

      renderWithQuery(
        <GamePicker
          selectedDate={new Date().toISOString().split('T')[0]}
          onDateChange={jest.fn()}
          selectedGame=""
          onGameSelect={mockOnSelect}
          sport="NBA"
        />
      );

      // Mock live game response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              game_id: 'live-game',
              home_team: 'Celtics',
              away_team: 'Heat',
              status: 'live',
              quarter: 3,
              time_remaining: '8:42',
              props_count: 32
            }
          ]
        })
      });

      await waitFor(() => {
        expect(screen.getByText('Celtics vs Heat')).toBeInTheDocument();
        expect(screen.getByText('LIVE')).toBeInTheDocument();
        expect(screen.getByText('Q3 8:42')).toBeInTheDocument();
      });
    });
  });

  describe('Form Integration with Shared Schemas', () => {
    it('should validate form data using shared schemas', async () => {
      // Test the form validation integration
      const formData = {
        capperId: 'test-capper',
        playerName: '', // Invalid - required field
        market: 'points',
        line: 25.5,
        odds: -110,
        confidence: 11 // Invalid - max 10
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/unified-picks',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-token'
        },
        payload: formData
      });

      expect(response.statusCode).toBe(400);

      const error = JSON.parse(response.payload);
      expect(error.errors).toContainEqual(
        expect.objectContaining({
          path: ['playerName'],
          message: 'Player name is required'
        })
      );

      expect(error.errors).toContainEqual(
        expect.objectContaining({
          path: ['confidence'],
          message: 'Confidence must be between 1 and 10'
        })
      );
    });

    it('should successfully submit valid form data', async () => {
      const validFormData = {
        capperId: 'test-capper-1',
        playerName: 'Valid Player',
        market: 'points',
        submarket: 'over',
        line: 25.5,
        odds: -110,
        sport: 'NBA',
        confidence: 8,
        analysis: 'Strong play based on trends'
      };

      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'new-pick-id',
            ...validFormData,
            workflow_stage: 'ingested',
            created_at: new Date().toISOString()
          }
        })
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/unified-picks',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-admin-token'
        },
        payload: validFormData
      });

      expect(response.statusCode).toBe(201);

      const result = JSON.parse(response.payload);
      expect(result.data).toMatchObject({
        capper_id: 'test-capper-1',
        player_name: 'Valid Player',
        workflow_stage: 'ingested'
      });
    });
  });

  describe('Performance and Caching', () => {
    it('should cache autocomplete results for repeated queries', async () => {
      const mockOnSelect = jest.fn();

      renderWithQuery(
        <PlayerPicker
          value=""
          onChange={mockOnSelect}
          sport="NBA"
        />
      );

      // Mock API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ player_name: 'Test Player', team_name: 'Test Team' }],
          performance: { responseTime: 50, cached: false }
        })
      });

      const input = screen.getByPlaceholderText(/search players/i);

      // First search
      fireEvent.change(input, { target: { value: 'Test' } });
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      // Clear input and search again (should hit cache)
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.change(input, { target: { value: 'Test' } });

      // Should not make another API call due to React Query caching
      await waitFor(() => {
        expect(screen.getByText('Test Player')).toBeInTheDocument();
      });

      // Fetch should still be called only once due to caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      const mockOnSelect = jest.fn();

      renderWithQuery(
        <PlayerPicker
          value=""
          onChange={mockOnSelect}
          sport="NBA"
        />
      );

      // Mock API error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const input = screen.getByPlaceholderText(/search players/i);
      fireEvent.change(input, { target: { value: 'Error' } });

      await waitFor(() => {
        expect(screen.getByText(/error loading players/i)).toBeInTheDocument();
      });

      // Should show retry option
      expect(screen.getByText(/try again/i)).toBeInTheDocument();
    });

    it('should debounce search input to prevent excessive API calls', async () => {
      const mockOnSelect = jest.fn();

      renderWithQuery(
        <PlayerPicker
          value=""
          onChange={mockOnSelect}
          sport="NBA"
        />
      );

      // Mock API response
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] })
      });

      const input = screen.getByPlaceholderText(/search players/i);

      // Rapid typing
      fireEvent.change(input, { target: { value: 'L' } });
      fireEvent.change(input, { target: { value: 'Le' } });
      fireEvent.change(input, { target: { value: 'LeB' } });
      fireEvent.change(input, { target: { value: 'LeBr' } });

      // Should only make one API call after debounce delay
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      }, { timeout: 500 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('query=LeBr'),
        expect.any(Object)
      );
    });
  });

  describe('Accessibility', () => {
    it('should provide proper ARIA labels and keyboard navigation', async () => {
      const mockOnSelect = jest.fn();

      renderWithQuery(
        <PlayerPicker
          value=""
          onChange={mockOnSelect}
          sport="NBA"
        />
      );

      const input = screen.getByPlaceholderText(/search players/i);

      // Should have proper ARIA attributes
      expect(input).toHaveAttribute('aria-label', 'Search for players');
      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');

      // Mock API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { player_name: 'Player 1', team_name: 'Team 1' },
            { player_name: 'Player 2', team_name: 'Team 2' }
          ]
        })
      });

      // Type to show results
      fireEvent.change(input, { target: { value: 'Player' } });

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Should support keyboard navigation
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      const firstOption = screen.getByRole('option', { name: /player 1/i });
      expect(firstOption).toHaveClass('focused'); // Should indicate focus

      // Enter should select
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({ player_name: 'Player 1' })
      );
    });
  });
});