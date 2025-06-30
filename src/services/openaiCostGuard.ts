import { encode } from 'gpt-tokenizer';

interface TokenUsageParams {
  prompt?: string;
  completion?: string;
  messages?: Array<{
    role: string;
    content: string;
  }>;
}



export class OpenAICostGuard {
  private static instance: OpenAICostGuard;

  private constructor() {}

  public static getInstance(): OpenAICostGuard {
    if (!OpenAICostGuard.instance) {
      OpenAICostGuard.instance = new OpenAICostGuard();
    }
    return OpenAICostGuard.instance;
  }

  public estimateTokenUsage(params: TokenUsageParams): number {
    const promptTokens = params.prompt ? this.countTokens(params.prompt) : 0;
    const completionTokens = params.completion ? this.countTokens(params.completion) : 0;
    return promptTokens + completionTokens;
  }

  private countTokens(text: string): number {
    return encode(text).length;
  }

  public calculateCost(params: TokenUsageParams, model = 'gpt-3.5-turbo'): number {
    const modelRates: Record<string, { prompt: number; completion: number }> = {
      'gpt-3.5-turbo': { prompt: 0.0015, completion: 0.002 },
      'gpt-4': { prompt: 0.03, completion: 0.06 }
    };

    const rate = modelRates[model] || modelRates['gpt-3.5-turbo'];
    const promptTokens = params.prompt ? this.countTokens(params.prompt) : 0;
    const completionTokens = params.completion ? this.countTokens(params.completion) : 0;

    return (promptTokens * (rate?.prompt || 0.0015) + completionTokens * (rate?.completion || 0.002)) / 1000;
  }
}