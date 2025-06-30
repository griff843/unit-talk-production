#!/usr/bin/env node

/**
 * FAQ Bulk Creation Script
 * Creates all FAQ threads with detailed progress reporting
 */

import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { FAQService, FAQItem } from '../src/services/faqService';

// Updated FAQ data with current, accurate information
const FAQ_DATA: FAQItem[] = [
  {
    title: "🏆 What is Unit Talk?",
    icon: "🏆",
    description: `Unit Talk is the premier sports betting community where elite cappers share their winning picks and strategies.

Join thousands of members who trust our expert analysis, transparent track record, and proven results across all major sports.

**What makes us different:**
• Fully transparent grading and results tracking
• Expert cappers with verified win rates
• Real-time Discord alerts for every pick
• Comprehensive analytics and insights
• Active community of winning bettors

Ready to start winning? Join the Unit Talk family today!`,
    button_label: "Join Unit Talk",
    button_url: "https://whop.com/unit-talk/"
  },
  {
    title: "💎 What does my subscription include?",
    icon: "💎",
    description: `Unit Talk has two powerful membership options, each designed for a different level of access and winning edge:

**VIP ($49.99/month)**
✔️ All official capper picks (every sport, every day)
✔️ Instant Discord alerts for every pick—never miss a play
✔️ Access to Capper Corner (all expert picks, history, Q&A)
✔️ Daily, weekly, and monthly recaps with full, transparent grading
✔️ Private VIP channels: insights, strategies, exclusive live events
✔️ Early access to giveaways, contests, and limited-time promos
✔️ VIP Trial: Get everything for 1 week, just $1

**VIP+ (Coming Soon)**
Everything in VIP, plus:
🚀 Steam Alerts: Real-time market/odds movement
🚑 Injury Alerts: Automated player/team status changes
🛡️ Hedge Alerts: Smart triggers to lock in profit or minimize loss
🧠 Custom Personal Advice: AI-powered insights for your actual bets/tickets
📊 Personalized Bet Tracking: Your full bet history, stats, and ROI analytics
⚡ Middling Alerts: Find and act on premium middling opportunities
📚 Advanced Analytics Vault: Player trends, proprietary data models, more
🔥 VIP+ Only: Hot/cold streaks, advanced leaderboards, special contests

Ready to join the winning side? Try VIP for 1 week at just $1, or stay tuned for the VIP+ launch!`,
    button_label: "Start $1 VIP Trial",
    button_url: "https://whop.com/unit-talk/"
  },
  {
    title: "💰 How much does it cost?",
    icon: "💰",
    description: `**VIP Membership: $49.99/month**
Get full access to all cappers, picks, analytics, and exclusive features.

**Special Offer: $1 Trial Week**
Experience everything VIP has to offer for just $1 for your first week. No commitment—cancel anytime.

**VIP+ (Coming Soon)**
Advanced features and AI-powered tools for serious bettors.

Compare that to losing bets—Unit Talk pays for itself with just one winning day!`,
    button_label: "Start $1 Trial",
    button_url: "https://whop.com/unit-talk/"
  },
  {
    title: "🕒 Do I get a free trial?",
    icon: "🕒",
    description: `Yes—experience full VIP access for 1 week, just $1.

Get all the picks, analytics, alerts, and features with zero risk.

No commitment—cancel anytime in one click.`,
    button_label: "Start Trial for $1",
    button_url: "https://whop.com/unit-talk/"
  },
  {
    title: "📈 What's your track record?",
    icon: "📈",
    description: `Every Unit Talk result is tracked, graded, and transparently posted in our Recap section—updated daily, with nothing hidden.

• Daily, weekly, and monthly win/loss summaries—see your ROI at a glance
• Full breakdown by sport, capper, and ticket type
• Hot streaks, cold streaks, leaderboards, and big win highlights
• True, third-party-verified records—no "selective memory" or cherry-picking

**Slash Commands:**

Instantly view any capper's last 3, 5, or 10 picks:
\`/recap griff l5\` — shows Griff's last 5 plays
\`/recap jeffro l10\` — shows Jeffro's last 10 picks
(Try these in Discord for any capper!)`,
    button_label: "See Results & Recaps",
    button_url: "https://discord.com/channels/1284478946171293736/1387837517298139270"
  },
  {
    title: "❌ Can I cancel anytime?",
    icon: "❌",
    description: `Absolutely. Manage or cancel your subscription any time at Whop.com—no questions asked, no hidden fees.`,
    button_label: "Manage Subscription",
    button_url: "https://whop.com/unit-talk/"
  },
  {
    title: "📅 How often are tips provided?",
    icon: "📅",
    description: `Our cappers provide picks daily during active sports seasons. You'll get:

• Multiple picks per day across different sports
• Real-time Discord alerts for every new pick
• Early morning and evening pick releases
• Special event and playoff coverage
• Live betting opportunities

Never miss a pick—enable Discord notifications for instant alerts!`,
    button_label: "Go to Capper Corner",
    button_url: "https://discord.com/channels/1284478946171293736/1387837517298139270"
  },
  {
    title: "🏈 What sports do you cover?",
    icon: "🏈",
    description: `Unit Talk covers all major sports with expert cappers for each:

**Year-Round Coverage:**
• NFL & College Football
• NBA & College Basketball
• MLB Baseball
• NHL Hockey
• Soccer (Premier League, Champions League, World Cup)
• Tennis (Grand Slams, ATP/WTA)
• Golf (PGA, Major Championships)
• UFC/MMA
• Boxing

**Seasonal Specialties:**
• March Madness
• NFL Playoffs & Super Bowl
• World Series
• Stanley Cup Playoffs
• Olympics

Our team includes specialists for each sport, so you always get the sharpest picks where it matters most.`,
    button_label: "See All Picks",
    button_url: "https://discord.com/channels/1284478946171293736/1387837517298139270"
  },
  {
    title: "🛠️ What if I have questions or need support?",
    icon: "🛠️",
    description: `Fastest help is always just a click away:

• Open a ticket in our Support channel and our team will respond ASAP
• Tag @Staff for urgent issues or DM if private
• Check this FAQ section for common questions
• Join our community discussions for peer support

Our support team is active daily and committed to helping you succeed!`,
    button_label: "Support Channel",
    button_url: "https://discord.com/channels/1284478946171293736/1387837517298139271"
  },
  {
    title: "🔔 How do I get notified for new picks?",
    icon: "🔔",
    description: `Never miss a winning pick! Here's how to get instant notifications:

**Discord Notifications:**
1. Go to Capper Corner
2. Click the bell icon on threads you want to follow
3. Enable "All Messages" for instant alerts

**Mobile Alerts:**
• Download the Discord mobile app
• Enable push notifications
• Get picks delivered straight to your phone

**Pro Tip:** Follow your favorite cappers' threads for personalized alerts!`,
    button_label: "Go to Capper Corner",
    button_url: "https://discord.com/channels/1284478946171293736/1387837517298139270"
  },
  {
    title: "🛡️ Is my data secure?",
    icon: "🛡️",
    description: `Your privacy and security are our top priorities:

• We never store your payment information
• All payments processed securely through Whop
• Discord chats are private and encrypted
• No personal betting data is shared
• Full compliance with data protection regulations

For complete details, review our Privacy Policy.`,
    button_label: "Privacy Policy",
    button_url: "https://whop.com/unit-talk/privacy"
  },
  {
    title: "🧠 How do you promote responsible gambling?",
    icon: "🧠",
    description: `Unit Talk is committed to responsible gambling practices:

**Our Guidelines:**
• Always bet within your means
• Set daily/weekly limits and stick to them
• Never chase losses with bigger bets
• Take breaks when needed
• Remember: betting should be fun, not stressful

**Resources for Help:**
• National Problem Gambling Helpline: 1-800-522-4700
• Gamblers Anonymous: www.gamblersanonymous.org
• Responsible Gaming resources in our server

If you or someone you know needs help, please reach out. We're here to support responsible betting practices.`,
    button_label: "Responsible Gaming Resources",
    button_url: "https://www.ncpgambling.org/"
  }
];

async function bulkCreateFAQs() {
  console.log('🚀 Starting FAQ Bulk Creation...');
  console.log(`📋 Total FAQs to create: ${FAQ_DATA.length}`);

  // Create client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  try {
    // Login to Discord
    console.log('🔗 Connecting to Discord...');
    await client.login(process.env.DISCORD_TOKEN);

    // Wait for client to be ready
    await new Promise(resolve => {
      client.once('ready', resolve);
    });

    console.log(`✅ Bot ready as ${client.user?.tag}`);

    // Initialize FAQ service
    const faqService = new FAQService(client);
    console.log('✅ FAQ Service initialized');

    // Get existing threads first
    const existingThreads = await faqService.getAllFAQThreads();
    console.log(`📋 Found ${existingThreads.length} existing FAQ threads`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each FAQ
    for (let i = 0; i < FAQ_DATA.length; i++) {
      const faq = FAQ_DATA[i];
      const progress = `[${i + 1}/${FAQ_DATA.length}]`;
      
      console.log(`${progress} Processing: ${faq.title}`);
      
      try {
        const thread = await faqService.createOrUpdateFAQThread(faq);
        
        if (thread) {
          successCount++;
          console.log(`${progress} ✅ Success: ${faq.title} (ID: ${thread.id})`);
        } else {
          errorCount++;
          errors.push(faq.title);
          console.log(`${progress} ❌ Failed: ${faq.title} (returned null)`);
        }
      } catch (error) {
        errorCount++;
        errors.push(faq.title);
        console.log(`${progress} ❌ Error: ${faq.title} - ${error}`);
      }

      // Add delay to avoid rate limiting
      if (i < FAQ_DATA.length - 1) {
        console.log(`${progress} ⏳ Waiting 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Final report
    console.log('\n📊 FINAL REPORT:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Failed FAQs:');
      errors.forEach((title, index) => {
        console.log(`  ${index + 1}. ${title}`);
      });
    }

    // Get final thread count
    const finalThreads = await faqService.getAllFAQThreads();
    console.log(`\n📋 Total FAQ threads now: ${finalThreads.length}`);

    console.log('\n🎉 FAQ Bulk Creation completed!');

  } catch (error) {
    console.error('❌ FAQ Bulk Creation failed:', error);
  } finally {
    // Cleanup
    await client.destroy();
    console.log('✅ Disconnected from Discord');
    process.exit(0);
  }
}

// Run the bulk creation
bulkCreateFAQs();