/**
 * Mock Infrastructure Test
 * 
 * This test verifies that all mocks are properly configured and working.
 */

describe('Mock Infrastructure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should have Discord.js mocked correctly', () => {
    const discord = require('discord.js');
    
    expect(discord.Client).toBeDefined();
    expect(discord.GatewayIntentBits).toBeDefined();
    expect(discord.EmbedBuilder).toBeDefined();
    expect(discord.Collection).toBeDefined();
    expect(discord.PermissionsBitField).toBeDefined();

    // Test Client creation
    const client = new discord.Client();
    expect(client.guilds).toBeDefined();
    expect(client.channels).toBeDefined();
    expect(client.users).toBeDefined();
    expect(client.user).toBeDefined();
  });

  it('should have Supabase mocked correctly', () => {
    const { createClient } = require('@supabase/supabase-js');
    
    expect(createClient).toBeDefined();
    
    const client = createClient('test-url', 'test-key');
    expect(client.from).toBeDefined();
    expect(client.auth).toBeDefined();
    
    const query = client.from('test-table');
    expect(query.select).toBeDefined();
    expect(query.insert).toBeDefined();
    expect(query.update).toBeDefined();
  });

  it('should have Winston logger mocked correctly', () => {
    const winston = require('winston');
    
    expect(winston.createLogger).toBeDefined();
    expect(winston.format).toBeDefined();
    expect(winston.transports).toBeDefined();
    
    const logger = winston.createLogger();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it('should have Pino logger mocked correctly', () => {
    const pino = require('pino');
    
    expect(pino.default).toBeDefined();
    
    const logger = pino.default();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it('should have Redis mocked correctly', () => {
    const Redis = require('ioredis');
    
    expect(Redis).toBeDefined();
    
    const redis = new Redis();
    expect(redis.get).toBeDefined();
    expect(redis.set).toBeDefined();
    expect(redis.del).toBeDefined();
    expect(redis.exists).toBeDefined();
  });

  it('should have OpenAI mocked correctly', () => {
    const OpenAI = require('openai');
    
    expect(OpenAI.default).toBeDefined();
    
    const openai = new OpenAI.default();
    expect(openai.chat).toBeDefined();
    expect(openai.chat.completions).toBeDefined();
    expect(openai.chat.completions.create).toBeDefined();
  });

  it('should have Anthropic mocked correctly', () => {
    const Anthropic = require('@anthropic-ai/sdk');
    
    expect(Anthropic.default).toBeDefined();
    
    const anthropic = new Anthropic.default();
    expect(anthropic.messages).toBeDefined();
    expect(anthropic.messages.create).toBeDefined();
  });

  it('should have Prometheus client mocked correctly', () => {
    const promClient = require('prom-client');
    
    expect(promClient.register).toBeDefined();
    expect(promClient.Counter).toBeDefined();
    expect(promClient.Gauge).toBeDefined();
    expect(promClient.Histogram).toBeDefined();
    expect(promClient.Summary).toBeDefined();
    
    const counter = new promClient.Counter({ name: 'test_counter', help: 'Test counter' });
    expect(counter.inc).toBeDefined();
  });

  it('should have Temporal activity mocked correctly', () => {
    const { Context } = require('@temporalio/activity');
    
    expect(Context).toBeDefined();
    expect(Context.current).toBeDefined();
    
    const context = Context.current();
    expect(context.info).toBeDefined();
    expect(context.info.activityId).toBe('test-activity-id');
  });

  it('should have environment variables set correctly', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.OPENAI_API_KEY).toBe('test-openai-key-for-testing');
    expect(process.env.ANTHROPIC_API_KEY).toBe('test-anthropic-key-for-testing');
    expect(process.env.SUPABASE_URL).toBe('https://test.supabase.co');
    expect(process.env.SUPABASE_ANON_KEY).toBe('test-supabase-key');
    expect(process.env.LOG_LEVEL).toBe('error');
    expect(process.env.METRICS_ENABLED).toBe('false');
  });

  it('should have crypto.randomUUID mocked correctly', () => {
    expect(global.crypto).toBeDefined();
    expect(global.crypto.randomUUID).toBeDefined();
    
    const uuid1 = global.crypto.randomUUID();
    const uuid2 = global.crypto.randomUUID();
    
    expect(typeof uuid1).toBe('string');
    expect(typeof uuid2).toBe('string');
    // UUIDs should be unique
    expect(uuid1).not.toBe(uuid2);
    
    // Should be valid UUID format or test format
    expect(uuid1.length).toBeGreaterThan(10);
    expect(uuid2.length).toBeGreaterThan(10);
  });
});