#!/usr/bin/env node

/**
 * Simple Bot Starter for FAQ Testing
 * Starts the bot with minimal dependencies to test FAQ functionality
 */

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { FAQService } from '../src/services/faqService';

console.log('🤖 Starting Unit Talk Bot for FAQ Testing...');

// Create client with minimal intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Initialize FAQ service
let faqService: FAQService;

client.once('ready', async () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user?.tag}`);
  
  // Initialize FAQ service
  faqService = new FAQService(client);
  console.log('✅ FAQ Service initialized');
  
  // Test getting FAQ threads
  try {
    const threads = await faqService.getAllFAQThreads();
    console.log(`📋 Found ${threads.length} existing FAQ threads`);
    
    if (threads.length > 0) {
      console.log('📝 Existing FAQ threads:');
      threads.forEach((thread, index) => {
        console.log(`  ${index + 1}. ${thread.name} (ID: ${thread.id})`);
      });
    }
  } catch (error) {
    console.error('❌ Error fetching FAQ threads:', error);
  }
  
  console.log('🎯 Bot is ready for FAQ commands!');
  console.log('💡 You can now use /faq-init, /faq-add, and /faq-edit commands in Discord');
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  console.log(`🎮 Command received: /${interaction.commandName} from ${interaction.user.tag}`);
  
  // Handle FAQ commands
  if (interaction.commandName === 'faq-init') {
    console.log('🚀 FAQ Init command triggered');
    // The actual command handling is done by the command files
  } else if (interaction.commandName === 'faq-add') {
    console.log('➕ FAQ Add command triggered');
  } else if (interaction.commandName === 'faq-edit') {
    console.log('✏️ FAQ Edit command triggered');
  }
});

// Error handling
client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN)
  .then(() => {
    console.log('🔗 Connecting to Discord...');
  })
  .catch((error) => {
    console.error('❌ Failed to login to Discord:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down bot...');
  client.destroy();
  process.exit(0);
});