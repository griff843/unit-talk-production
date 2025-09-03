import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

import { Database } from '../../src/db/types/supabase';
import { createMockPick, createMockCapper } from '../utils/testData';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

describe('AI Services ↔ Core Platform Integration', () => {
  describe('Pick Analysis Flow', () => {
    it('should analyze pick and store results', async () => {
      // Create test pick
      const testPick = createMockPick({
        pick_type: 'single',
        legs: [{
          game: 'Lakers vs Warriors',
          bet_type: 'Spread',
          selection: 'Lakers -5.5',
          odds: -110
        }]
      });

      // Get AI analysis
      const prompt = `Analyze this NBA pick:
Game: ${testPick.legs[0].game}
Pick: ${testPick.legs[0].selection} (${testPick.legs[0].odds})
Provide a brief analysis of the matchup and the pick's value.`;

      const analysis = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200
      });

      // Store analysis
      const { data: storedAnalysis, error } = await supabase
        .from('pick_analysis')
        .insert({
          pick_id: testPick.id,
          analysis: analysis.choices[0].message.content,
          model: 'gpt-4',
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(storedAnalysis).toBeTruthy();
      expect(storedAnalysis.analysis).toBeTruthy();
    });

    it('should handle analysis failure gracefully', async () => {
      const testPick = createMockPick();

      try {
        // Simulate OpenAI failure
        await openai.chat.completions.create({
          model: 'invalid-model',
          messages: [{ role: 'user', content: 'test' }]
        });
        fail('Should have thrown an error');
      } catch {
        // Fallback to Anthropic
        const analysis = await anthropic.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 200,
          messages: [{ role: 'user', content: 'Analyze this pick' }]
        });

        // Store fallback analysis
        const { error } = await supabase
          .from('pick_analysis')
          .insert({
            pick_id: testPick.id,
            analysis: analysis.content[0].text,
            model: 'claude-3',
            is_fallback: true,
            timestamp: new Date().toISOString()
          });

        expect(error).toBeNull();
      }
    });

    it('should rate limit analysis requests', async () => {
      const testPicks = Array(5).fill(null).map(() => createMockPick());
      const startTime = Date.now();

      const analyses = await Promise.all(
        testPicks.map(pick =>
          openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: `Analyze pick ${pick.id}` }],
            max_tokens: 100
          })
        )
      );

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(1000); // Should take at least 1 second
      analyses.forEach(analysis => {
        expect(analysis.choices[0].message.content).toBeTruthy();
      });
    });
  });

  describe('Capper Profile Enhancement', () => {
    it('should enhance capper bio', async () => {
      const testCapper = createMockCapper({
        bio: 'NBA specialist with focus on player props'
      });

      // Get AI enhancement
      const prompt = `Enhance this capper bio while maintaining accuracy:
${testCapper.bio}`;

      const enhancement = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200
      });

      // Store enhanced bio
      const { data: updatedCapper, error } = await supabase
        .from('cappers')
        .update({
          bio: enhancement.choices[0].message.content,
          bio_enhanced: true,
          last_enhancement: new Date().toISOString()
        })
        .eq('id', testCapper.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updatedCapper?.bio).toBeTruthy();
      expect(updatedCapper?.bio).not.toBe(testCapper.bio);
    });

    it('should generate capper insights', async () => {
      const testCapper = createMockCapper();

      // Get performance data
      const { data: picks } = await supabase
        .from('daily_picks')
        .select()
        .eq('capper_id', testCapper.id);

      // Generate insights
      const prompt = `Generate insights for this capper's performance:
Total Picks: ${picks?.length}
Win Rate: ${calculateWinRate(picks)}
Average Odds: ${calculateAverageOdds(picks)}`;

      const insights = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      });

      // Store insights
      const { error } = await supabase
        .from('capper_insights')
        .insert({
          capper_id: testCapper.id,
          insights: insights.content[0].text,
          timestamp: new Date().toISOString()
        });

      expect(error).toBeNull();
    });

    it('should validate AI-generated content', async () => {
      const testCapper = createMockCapper();

      // Generate content
      const enhancement = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Generate capper bio' }],
        max_tokens: 200
      });

      const content = enhancement.choices[0].message.content;

      // Validate content
      const validation = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `Validate this content for accuracy and appropriateness:
${content}`
          }
        ]
      });

      const isValid = validation.content[0].text.toLowerCase().includes('valid');
      expect(isValid).toBe(true);
    });
  });

  describe('AI Model Management', () => {
    it('should track model performance', async () => {
      const testPick = createMockPick();

      // Generate analysis with both models
      const [openaiAnalysis, anthropicAnalysis] = await Promise.all([
        openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Analyze pick' }],
          max_tokens: 100
        }),
        anthropic.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Analyze pick' }]
        })
      ]);

      // Store analyses
      const { error } = await supabase
        .from('model_performance')
        .insert([
          {
            pick_id: testPick.id,
            model: 'gpt-4',
            response_time: 500,
            token_count: openaiAnalysis.usage?.total_tokens,
            timestamp: new Date().toISOString()
          },
          {
            pick_id: testPick.id,
            model: 'claude-3',
            response_time: 600,
            token_count: calculateTokenCount(anthropicAnalysis.content[0].text),
            timestamp: new Date().toISOString()
          }
        ]);

      expect(error).toBeNull();
    });

    it('should select optimal model', async () => {
      // Get model performance data
      const { data: performance } = await supabase
        .from('model_performance')
        .select();

      // Calculate average response times
      const avgTimes = performance?.reduce((acc, curr) => {
        acc[curr.model] = acc[curr.model] || { total: 0, count: 0 };
        acc[curr.model].total += curr.response_time;
        acc[curr.model].count++;
        return acc;
      }, {} as Record<string, { total: number; count: number }>);

      // Select fastest model
      const fastestModel = Object.entries(avgTimes || {}).reduce((a, b) =>
        (a[1].total / a[1].count) < (b[1].total / b[1].count) ? a : b
      )[0];

      expect(fastestModel).toBeTruthy();
    });

    it('should handle token limits', async () => {
      const longPrompt = 'a'.repeat(10000);

      try {
        await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: longPrompt }],
          max_tokens: 100
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('token');
      }
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed requests', async () => {
      const maxRetries = 3;
      let attempts = 0;

      while (attempts < maxRetries) {
        try {
          await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 100
          });
          break;
        } catch (error) {
          attempts++;
          if (attempts === maxRetries) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      expect(attempts).toBeLessThanOrEqual(maxRetries);
    });

    it('should cache successful responses', async () => {
      const testPick = createMockPick();
      const cacheKey = `analysis:${testPick.id}`;

      // Generate and cache analysis
      const analysis = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Analyze pick' }],
        max_tokens: 100
      });

      await supabase
        .from('analysis_cache')
        .insert({
          key: cacheKey,
          content: analysis.choices[0].message.content,
          expires_at: new Date(Date.now() + 3600000).toISOString()
        });

      // Retrieve from cache
      const { data: cached } = await supabase
        .from('analysis_cache')
        .select()
        .eq('key', cacheKey)
        .single();

      expect(cached?.content).toBe(analysis.choices[0].message.content);
    });

    it('should handle service outages', async () => {
      // Simulate OpenAI outage
      const invalidOpenai = new OpenAI({
        apiKey: 'invalid-key'
      });

      try {
        await invalidOpenai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'test' }]
        });
        fail('Should have thrown an error');
      } catch {
        // Fallback to Anthropic
        const response = await anthropic.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'test' }]
        });
        expect(response.content[0].text).toBeTruthy();
      }
    });
  });
});

// Helper functions
function calculateWinRate(picks: any[]): number {
  if (!picks?.length) {return 0;}
  const wins = picks.filter(p => p.result === 'win').length;
  return wins / picks.length;
}

function calculateAverageOdds(picks: any[]): number {
  if (!picks?.length) {return 0;}
  const totalOdds = picks.reduce((sum, pick) => sum + pick.odds, 0);
  return totalOdds / picks.length;
}

function calculateTokenCount(text: string): number {
  return text.split(/\s+/).length * 1.3; // Rough estimate
} 