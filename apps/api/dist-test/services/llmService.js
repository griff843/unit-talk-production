"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const openai_1 = __importDefault(require("openai"));
const env_1 = require("../config/env");
const logger_1 = require("../shared/logger");
const llmCircuitBreaker_1 = require("./llmCircuitBreaker");
class LLMService {
    constructor() {
        this.defaultConfig = {
            provider: 'openai',
            model: 'gpt-4-turbo-preview',
            temperature: 0.7,
            maxTokens: 1000,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0
        };
        // Initialize providers
        this.openai = new openai_1.default({
            apiKey: env_1.env.OPENAI_API_KEY
        });
        this.anthropic = new sdk_1.default({
            apiKey: env_1.env.ANTHROPIC_API_KEY
        });
        // Initialize circuit breaker
        this.circuitBreaker = llmCircuitBreaker_1.LLMCircuitBreaker.getInstance({
            failureThreshold: 5,
            resetTimeout: 60000,
            dailyTokenQuota: 1000000,
            maxConcurrentRequests: 50,
            timeoutMs: 30000
        });
    }
    static getInstance() {
        if (!LLMService.instance) {
            LLMService.instance = new LLMService();
        }
        return LLMService.instance;
    }
    async generateResponse(request) {
        const config = { ...this.defaultConfig, ...request.config };
        const startTime = Date.now();
        try {
            return await this.circuitBreaker.executeRequest(async () => {
                if (config.provider === 'openai') {
                    return this.generateOpenAIResponse(request.messages, config);
                }
                else {
                    return this.generateAnthropicResponse(request.messages, config);
                }
            }, request.tokenEstimate || this.estimateTokens(request.messages), () => this.getFallbackResponse(request));
        }
        catch (error) {
            logger_1.logger.error('LLM request failed:', error);
            throw error;
        }
        finally {
            const latency = Date.now() - startTime;
            logger_1.logger.info('LLM request completed', { latency, config: config.provider });
        }
    }
    async generateOpenAIResponse(messages, config) {
        const startTime = Date.now();
        const completion = await this.openai.chat.completions.create({
            model: config.model,
            messages: messages,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            top_p: config.topP,
            frequency_penalty: config.frequencyPenalty,
            presence_penalty: config.presencePenalty
        });
        const tokenUsage = completion.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        const cost = this.calculateOpenAICost(config.model, tokenUsage.total_tokens);
        return {
            content: completion.choices[0]?.message?.content || '',
            model: config.model,
            provider: 'openai',
            tokenUsage: {
                prompt: tokenUsage.prompt_tokens,
                completion: tokenUsage.completion_tokens,
                total: tokenUsage.total_tokens
            },
            metadata: {
                latency: Date.now() - startTime,
                cost
            }
        };
    }
    async generateAnthropicResponse(messages, config) {
        const startTime = Date.now();
        const message = await this.anthropic.messages.create({
            model: config.model,
            max_tokens: config.maxTokens || 1000,
            temperature: config.temperature,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }))
        });
        const response = message.content[0];
        if (response.type !== 'text') {
            throw new Error('Invalid response type from Claude');
        }
        // Anthropic doesn't provide token usage, so we estimate
        const tokenUsage = {
            prompt: this.estimateTokens(messages),
            completion: this.estimateTokens([{ role: 'assistant', content: response.text }]),
            total: 0
        };
        tokenUsage.total = tokenUsage.prompt + tokenUsage.completion;
        const cost = this.calculateAnthropicCost(config.model, tokenUsage.total);
        return {
            content: response.text,
            model: config.model,
            provider: 'anthropic',
            tokenUsage,
            metadata: {
                latency: Date.now() - startTime,
                cost
            }
        };
    }
    async getFallbackResponse(_request) {
        // Implement rule-based or template fallback
        const fallbackResponse = 'I apologize, but I am currently experiencing technical difficulties. Please try again later.';
        return {
            content: fallbackResponse,
            model: 'fallback',
            provider: 'fallback',
            tokenUsage: {
                prompt: 0,
                completion: 0,
                total: 0
            },
            metadata: {
                latency: 0,
                cost: 0
            }
        };
    }
    estimateTokens(messages) {
        // Simple estimation: ~4 chars per token
        return messages.reduce((total, msg) => total + Math.ceil(msg.content.length / 4), 0);
    }
    calculateOpenAICost(model, tokens) {
        const rates = {
            'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
            'gpt-4': { input: 0.03, output: 0.06 },
            'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
        };
        const rate = rates[model] || rates['gpt-3.5-turbo'];
        return (tokens * ((rate.input + rate.output) / 2)) / 1000; // Average cost per token
    }
    calculateAnthropicCost(model, tokens) {
        const rates = {
            'claude-3-opus-20240229': 0.015,
            'claude-3-sonnet-20240229': 0.003
        };
        const rate = rates[model] || 0.003;
        return (tokens * rate) / 1000;
    }
}
exports.LLMService = LLMService;
