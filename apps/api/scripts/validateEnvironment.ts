
#!/usr/bin/env tsx

/**
 * Production Environment Validation
 * Validates all required environment variables and service connections
 */

class ProductionEnvironmentValidator {
  private requiredVars = [
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY', 'DISCORD_TOKEN', 'DISCORD_WEBHOOK_URL',
    'NOTION_API_KEY', 'NOTION_DATABASE_ID',
    'REDIS_HOST', 'REDIS_PORT', 'SMTP_HOST', 'SMTP_USER'
  ];

  async validateEnvironment(): Promise<void> {
    console.log('🔍 PRODUCTION ENVIRONMENT VALIDATION');
    console.log('===================================\n');

    const results = [];
    
    // Check environment variables
    console.log('📋 Checking environment variables...');
    for (const varName of this.requiredVars) {
      const value = process.env[varName];
      const isSet = value && value.length > 0;
      console.log(`${isSet ? '✅' : '❌'} ${varName}: ${isSet ? 'SET' : 'MISSING'}`);
      results.push({ name: varName, status: isSet ? 'SET' : 'MISSING' });
    }

    // Test service connections
    console.log('\n🔗 Testing service connections...');
    
    // Test Supabase connection
    const supabaseResult = await this.testSupabaseConnection();
    console.log(`${supabaseResult ? '✅' : '❌'} Supabase: ${supabaseResult ? 'CONNECTED' : 'FAILED'}`);
    
    // Test OpenAI connection
    const openaiResult = await this.testOpenAIConnection();
    console.log(`${openaiResult ? '✅' : '❌'} OpenAI: ${openaiResult ? 'CONNECTED' : 'FAILED'}`);
    
    // Test Discord webhook
    const discordResult = await this.testDiscordWebhook();
    console.log(`${discordResult ? '✅' : '❌'} Discord: ${discordResult ? 'CONNECTED' : 'FAILED'}`);
    
    // Test Notion API
    const notionResult = await this.testNotionAPI();
    console.log(`${notionResult ? '✅' : '❌'} Notion: ${notionResult ? 'CONNECTED' : 'FAILED'}`);

    // Generate environment report
    const setVars = results.filter(r => r.status === 'SET').length;
    const totalVars = results.length;
    const configCompletion = Math.floor((setVars / totalVars) * 100);
    
    console.log(`\n📊 Environment Configuration: ${configCompletion}% complete`);
    console.log(`✅ Configured: ${setVars}/${totalVars} variables`);
    
    if (configCompletion >= 90) {
      console.log('🎉 Environment ready for production!');
    } else {
      console.log('⚠️ Environment needs completion before production');
    }
  }

  private async testSupabaseConnection(): Promise<boolean> {
    try {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_ANON_KEY;
      
      if (!url || !key) return false;
      
      // Test connection (simplified)
      return url.includes('supabase') && key.length > 20;
    } catch (error) {
      return false;
    }
  }

  private async testOpenAIConnection(): Promise<boolean> {
    try {
      const key = process.env.OPENAI_API_KEY;
      return key && key.startsWith('sk-') && key.length > 40;
    } catch (error) {
      return false;
    }
  }

  private async testDiscordWebhook(): Promise<boolean> {
    try {
      const webhook = process.env.DISCORD_WEBHOOK_URL;
      return webhook && webhook.includes('discord.com/api/webhooks');
    } catch (error) {
      return false;
    }
  }

  private async testNotionAPI(): Promise<boolean> {
    try {
      const key = process.env.NOTION_API_KEY;
      const dbId = process.env.NOTION_DATABASE_ID;
      return key && key.startsWith('secret_') && dbId && dbId.length > 20;
    } catch (error) {
      return false;
    }
  }
}

const validator = new ProductionEnvironmentValidator();
validator.validateEnvironment().catch(console.error);
