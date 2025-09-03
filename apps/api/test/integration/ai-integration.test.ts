import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

import { createMockPick } from '../utils/testData';

// Initialize AI clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

describe('AI Service Integration', () => {
  describe('OpenAI Integration', () => {
    it('should generate pick analysis', async () => {
      const testPick = createMockPick({
        pick_type: 'single',
        legs: [{
          game: 'Lakers vs Warriors',
          bet_type: 'Spread',
          selection: 'Lakers -5.5',
          odds: -110
        }]
      });

      const prompt = `Analyze this NBA pick:
Game: ${testPick.legs[0].game}
Pick: ${testPick.legs[0].selection} (${testPick.legs[0].odds})
Provide a brief analysis of the matchup and the pick's value.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200
      });

      expect(response.choices[0].message.content).toBeTruthy();
    });

    it('should generate betting insights', async () => {
      const prompt = `What are the key factors to consider when betting on NBA spreads?
Provide 3-5 key insights that bettors should consider.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200
      });

      expect(response.choices[0].message.content).toBeTruthy();
    });

    it('should handle API errors gracefully', async () => {
      const invalidOpenai = new OpenAI({
        apiKey: 'invalid-key'
      });

      try {
        await invalidOpenai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'test' }]
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });

  describe('Anthropic Integration', () => {
    it('should analyze betting patterns', async () => {
      const prompt = `Analyze these betting patterns:
1. Heavy public betting on favorites
2. Line movement against the public
3. Sharp money on underdogs
What insights can we draw from these patterns?`;

      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      });

      expect(response.content[0].text).toBeTruthy();
    });

    it('should provide statistical analysis', async () => {
      const data = {
        wins: 65,
        losses: 30,
        pushes: 5,
        roi: 0.15,
        avgOdds: -110
      };

      const prompt = `Analyze these betting statistics:
Wins: ${data.wins}
Losses: ${data.losses}
Pushes: ${data.pushes}
ROI: ${data.roi * 100}%
Average Odds: ${data.avgOdds}
What insights can we draw about this bettor's performance?`;

      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      });

      expect(response.content[0].text).toBeTruthy();
    });

    it('should handle API errors gracefully', async () => {
      const invalidAnthropic = new Anthropic({
        apiKey: 'invalid-key'
      });

      try {
        await invalidAnthropic.messages.create({
          model: 'claude-3-opus-20240229',
          max_tokens: 200,
          messages: [{ role: 'user', content: 'test' }]
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });

  describe('AI Service Performance', () => {
    it('should complete requests within timeout', async () => {
      const startTime = Date.now();
      const timeout = 10000; // 10 seconds

      const prompt = 'Provide a quick analysis of NBA betting strategies.';

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(timeout);
      expect(response.choices[0].message.content).toBeTruthy();
    });

    it('should handle concurrent requests', async () => {
      const prompts = [
        'Analyze NBA betting trends.',
        'Analyze MLB betting trends.',
        'Analyze NFL betting trends.'
      ];

      const startTime = Date.now();
      const results = await Promise.all(prompts.map(prompt =>
        openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100
        })
      ));

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(30000); // 30 seconds
      results.forEach(response => {
        expect(response.choices[0].message.content).toBeTruthy();
      });
    });
  });

  describe('AI Service Fallbacks', () => {
    it('should fallback to alternative model', async () => {
      const primaryModel = 'gpt-4';
      const fallbackModel = 'gpt-3.5-turbo';

      try {
        await openai.chat.completions.create({
          model: primaryModel,
          messages: [{ role: 'user', content: 'test' }]
        });
      } catch {
        // Fallback to alternative model
        const response = await openai.chat.completions.create({
          model: fallbackModel,
          messages: [{ role: 'user', content: 'test' }]
        });
        expect(response.choices[0].message.content).toBeTruthy();
      }
    });

    it('should fallback to alternative service', async () => {
      try {
        await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'test' }]
        });
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