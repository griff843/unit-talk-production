"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAICostGuard = void 0;
const gpt_tokenizer_1 = require("gpt-tokenizer");
class OpenAICostGuard {
    constructor() { }
    static getInstance() {
        if (!OpenAICostGuard.instance) {
            OpenAICostGuard.instance = new OpenAICostGuard();
        }
        return OpenAICostGuard.instance;
    }
    estimateTokenUsage(params) {
        const promptTokens = params.prompt ? this.countTokens(params.prompt) : 0;
        const completionTokens = params.completion ? this.countTokens(params.completion) : 0;
        return promptTokens + completionTokens;
    }
    countTokens(text) {
        return (0, gpt_tokenizer_1.encode)(text).length;
    }
    calculateCost(params, model = 'gpt-3.5-turbo') {
        const modelRates = {
            'gpt-3.5-turbo': { prompt: 0.0015, completion: 0.002 },
            'gpt-4': { prompt: 0.03, completion: 0.06 }
        };
        const rate = modelRates[model] || modelRates['gpt-3.5-turbo'];
        const promptTokens = params.prompt ? this.countTokens(params.prompt) : 0;
        const completionTokens = params.completion ? this.countTokens(params.completion) : 0;
        return (promptTokens * (rate?.prompt || 0.0015) + completionTokens * (rate?.completion || 0.002)) / 1000;
    }
}
exports.OpenAICostGuard = OpenAICostGuard;
