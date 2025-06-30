#!/usr/bin/env node

/**
 * Comprehensive FAQ Fix Script
 * - Remove duplicate threads
 * - Fix emoji formatting
 * - Update content quality
 */

require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

// Updated FAQ data with proper formatting (no emoji in title)
const FIXED_FAQ_DATA = [
  {
    title: "What is Unit Talk?",
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
    title: "What does my subscription include?",
    icon: "💎",
    description: `Unit Talk offers two powerful membership tiers designed for different levels of access and winning edge:

**VIP Membership ($49.99/month)**
✔️ All official capper picks across every sport, every day
✔️ Instant Discord alerts for every pick—never miss a winning play
✔️ Full access to Capper Corner with complete pick history and Q&A
✔️ Daily, weekly, and monthly recaps with 100% transparent grading
✔️ Private VIP channels with exclusive insights, strategies, and live events
✔️ Early access to giveaways, contests, and limited-time promotions
✔️ VIP Trial: Experience everything for 1 week at just $1

**VIP+ (Coming Soon)**
Everything in VIP, plus advanced features:
🚀 Steam Alerts: Real-time market and odds movement notifications
🚑 Injury Alerts: Automated player and team status change updates
🛡️ Hedge Alerts: Smart triggers to lock in profit or minimize losses
🧠 Custom Personal Advice: AI-powered insights tailored to your actual bets
📊 Personalized Bet Tracking: Complete bet history, statistics, and ROI analytics
⚡ Middling Alerts: Find and capitalize on premium middling opportunities
📚 Advanced Analytics Vault: Player trends, proprietary data models, and more
🔥 VIP+ Exclusive: Hot/cold streak analysis, advanced leaderboards, special contests

**Why Choose Unit Talk?**
• Proven track record with transparent results
• Expert cappers specializing in different sports
• Active community of successful bettors
• Cutting-edge technology and analytics
• Responsible gambling practices and support

Ready to join the winning side? Try VIP for 1 week at just $1, or stay tuned for the VIP+ launch!`,
    button_label: "Start $1 VIP Trial",
    button_url: "https://whop.com/unit-talk/"
  },
  {
    title: "How much does it cost?",
    icon: "💰",
    description: `**VIP Membership: $49.99/month**
Your gateway to professional sports betting success with full access to all cappers, picks, analytics, and exclusive features.

**🎯 What You Get for $49.99/month:**
• All official capper picks across every major sport
• Instant Discord alerts delivered to your phone
• Complete access to Capper Corner with full history
• Daily, weekly, and monthly transparent recaps
• Private VIP channels with exclusive content
• Early access to contests and giveaways
• Professional-grade analytics and insights

**💎 Special Offer: $1 Trial Week**
Experience the full VIP experience for just $1 for your first week:
• Zero commitment—cancel anytime with one click
• Full access to all features and picks
• See our transparent results firsthand
• Join thousands of winning members risk-free

**🚀 VIP+ (Coming Soon)**
Advanced tier with AI-powered tools and premium features for serious bettors. Pricing to be announced.

**💡 Value Comparison:**
• One winning bet typically covers your entire monthly subscription
• Professional cappers charge $100+ per pick elsewhere
• Our transparent track record speaks for itself
• Cancel anytime—no contracts or hidden fees

**🔒 Secure Payment:**
All payments processed securely through Whop with industry-standard encryption and fraud protection.

Ready to turn your betting into profit? Start with our $1 trial and see why thousands trust Unit Talk!`,
    button_label: "Start $1 Trial",
    button_url: "https://whop.com/unit-talk/"
  },
  {
    title: "Do I get a free trial?",
    icon: "🕒",
    description: `**Yes! Get VIP access for 1 week at just $1**

Experience everything Unit Talk has to offer with virtually no risk:

**What's Included in Your $1 Trial:**
✔️ Full VIP access to all cappers and picks
✔️ Real-time Discord alerts for every play
✔️ Complete access to Capper Corner
✔️ All analytics, recaps, and insights
✔️ Private VIP channels and exclusive content
✔️ Early access to contests and giveaways

**Trial Details:**
• Just $1 for your first week
• No commitment—cancel anytime
• One-click cancellation process
• Full refund if not satisfied
• Automatic conversion to monthly after trial

**Why We Offer This:**
We're confident in our results and transparent track record. Once you see the quality of our picks and the value we provide, you'll understand why thousands of members trust Unit Talk for their betting success.

Ready to test drive the best sports betting community?`,
    button_label: "Start Trial for $1",
    button_url: "https://whop.com/unit-talk/"
  },
  {
    title: "What's your track record?",
    icon: "📈",
    description: `**100% Transparent Results—Nothing Hidden**

Every Unit Talk result is tracked, graded, and publicly posted in our Recap section with daily updates and complete transparency.

**What You'll See:**
• Daily, weekly, and monthly win/loss summaries with exact ROI
• Full breakdown by sport, capper, and bet type
• Hot streaks, cold streaks, and performance leaderboards
• Big win highlights and detailed analysis
• Third-party verified records—no selective memory or cherry-picking

**Real-Time Tracking:**
Use our Discord slash commands to instantly view any capper's recent performance:
• \`/recap griff l5\` — Shows Griff's last 5 picks with results
• \`/recap jeffro l10\` — Shows Jeffro's last 10 plays with outcomes
• \`/recap [capper] l3\` — Any capper's last 3 picks

**Why Transparency Matters:**
• See exactly how each capper performs
• Make informed decisions about which picks to follow
• Track your own ROI and betting success
• No inflated claims or hidden losses

**Our Commitment:**
We post every result—wins AND losses—because we believe in honest, transparent betting. Our track record speaks for itself, and you can verify every claim in real-time.

Check our Recap section to see current performance across all cappers!`,
    button_label: "See Results & Recaps",
    button_url: "https://discord.com/channels/1284478946171293736/1387837517298139270"
  },
  {
    title: "Can I cancel anytime?",
    icon: "❌",
    description: `**Absolutely—Cancel Anytime with Zero Hassle**

**Easy Cancellation Process:**
• Manage your subscription at Whop.com
• One-click cancellation—no phone calls required
• No questions asked, no hidden fees
• Immediate confirmation of cancellation

**Flexible Options:**
• Pause your subscription temporarily
• Downgrade or upgrade tiers
• Cancel and rejoin anytime
• No long-term contracts or commitments

**Pro-Rated Refunds:**
If you're not satisfied, contact our support team for assistance with refunds on a case-by-case basis.

**Why We Make It Easy:**
We're confident in our value and results. We'd rather earn your loyalty through great picks and service than trap you with complicated cancellation processes.

Your satisfaction is our priority—betting should be fun and profitable, not stressful!`,
    button_label: "Manage Subscription",
    button_url: "https://whop.com/unit-talk/"
  },
  {
    title: "How often are tips provided?",
    icon: "📅",
    description: `**Daily Picks During Active Sports Seasons**

**What to Expect:**
• Multiple picks per day across different sports
• Early morning releases for day games
• Evening picks for night games and next-day action
• Special event and playoff coverage with increased volume
• Live betting opportunities during games

**Seasonal Coverage:**
• **NFL Season:** 15-25 picks per week
• **NBA Season:** 10-20 picks per day
• **MLB Season:** 20-30 picks per day
• **College Sports:** Extensive coverage during seasons
• **Year-Round:** Soccer, tennis, golf, UFC, and more

**Alert System:**
• Real-time Discord notifications for every new pick
• Mobile push notifications through Discord app
• Never miss a pick with our instant alert system
• Follow specific cappers for personalized notifications

**Quality Over Quantity:**
While we provide numerous picks daily, each one is carefully analyzed and selected. Our cappers focus on value bets with the highest probability of success.

Enable Discord notifications and never miss a winning opportunity!`,
    button_label: "Go to Capper Corner",
    button_url: "https://discord.com/channels/1284478946171293736/1387837517298139270"
  },
  {
    title: "What sports do you cover?",
    icon: "🏈",
    description: `**Comprehensive Coverage Across All Major Sports**

**Year-Round Sports:**
🏈 **NFL & College Football** - Regular season, playoffs, Super Bowl
🏀 **NBA & College Basketball** - Regular season, March Madness, NBA Finals
⚾ **MLB Baseball** - Regular season, playoffs, World Series
🏒 **NHL Hockey** - Regular season, Stanley Cup playoffs
⚽ **Soccer** - Premier League, Champions League, World Cup, MLS
🎾 **Tennis** - Grand Slams, ATP/WTA tours, major tournaments
⛳ **Golf** - PGA Tour, Major Championships, European Tour
🥊 **UFC/MMA** - All major fight cards and events
🥊 **Boxing** - Championship fights and major bouts

**Seasonal Specialties:**
🏀 **March Madness** - Complete tournament coverage
🏈 **NFL Playoffs** - Wild Card through Super Bowl
⚾ **World Series** - Postseason baseball coverage
🏒 **Stanley Cup** - NHL playoff action
🌍 **Olympics** - Summer and Winter Games
🏁 **NASCAR** - Major race coverage

**Expert Capper Specialization:**
Each sport is covered by dedicated experts who specialize in that area, ensuring you get the sharpest analysis and best value bets available.

**International Coverage:**
We also cover major international events and leagues, giving you betting opportunities around the clock.

No matter what sport you love, Unit Talk has expert coverage and winning picks!`,
    button_label: "See All Picks",
    button_url: "https://discord.com/channels/1284478946171293736/1387837517298139270"
  },
  {
    title: "What if I have questions or need support?",
    icon: "🛠️",
    description: `**Fast, Friendly Support When You Need It**

**Multiple Support Channels:**
🎫 **Support Tickets** - Open a ticket in our Support channel for fastest response
👥 **Tag @Staff** - For urgent issues or quick questions
💬 **Direct Message** - For private or sensitive matters
❓ **FAQ Section** - Check here first for common questions
🤝 **Community Help** - Get peer support from experienced members

**What We Help With:**
• Account and subscription issues
• Technical problems with Discord or alerts
• Questions about picks and strategies
• Billing and payment support
• General betting guidance and education

**Response Times:**
• Support tickets: Usually within 2-4 hours
• Staff tags: Often within 30-60 minutes during active hours
• Community support: Available 24/7 from fellow members

**Our Commitment:**
Our support team is active daily and genuinely committed to helping you succeed. We're not just here to take your money—we want you to win and be a long-term successful member of our community.

**Pro Tip:** Join our community discussions! Many questions are answered by experienced members who love sharing their knowledge and helping newcomers succeed.

Need help? We're here for you every step of the way!`,
    button_label: "Support Channel",
    button_url: "https://discord.com/channels/1284478946171293736/1387837517298139271"
  },
  {
    title: "How do I get notified for new picks?",
    icon: "🔔",
    description: `**Never Miss a Winning Pick with Our Alert System**

**Discord Notifications Setup:**
1. **Go to Capper Corner** in our Discord server
2. **Click the bell icon** on threads you want to follow
3. **Select "All Messages"** for instant alerts
4. **Customize per capper** - follow your favorites

**Mobile Alerts:**
📱 **Download Discord Mobile App**
• Available for iOS and Android
• Enable push notifications in app settings
• Get picks delivered straight to your phone
• Works even when Discord is closed

**Advanced Notification Tips:**
🎯 **Follow Specific Cappers** - Get alerts only from your preferred experts
🔥 **Hot Streak Alerts** - Follow cappers on winning streaks
🏈 **Sport-Specific** - Follow threads for your favorite sports only
⚡ **Live Bet Alerts** - Get notified for in-game opportunities

**Notification Settings:**
• **All Messages** - Every pick and update
• **@mentions only** - Only when directly mentioned
• **Nothing** - No notifications (not recommended!)

**Pro Tips:**
• Turn on notifications for at least 3-5 top cappers
• Enable mobile notifications for time-sensitive picks
• Check notification settings if you're missing picks
• Use Discord's "Do Not Disturb" for quiet hours

**Troubleshooting:**
If you're not getting notifications:
1. Check your Discord notification settings
2. Ensure you're following the right threads
3. Verify mobile app permissions
4. Contact support if issues persist

Set up your alerts now and never miss another winning opportunity!`,
    button_label: "Go to Capper Corner",
    button_url: "https://discord.com/channels/1284478946171293736/1387837517298139270"
  },
  {
    title: "Is my data secure?",
    icon: "🛡️",
    description: `**Your Privacy and Security Are Our Top Priorities**

**Data Protection Measures:**
🔒 **Payment Security** - We never store your payment information
💳 **Secure Processing** - All payments handled by Whop with bank-level encryption
🔐 **Discord Privacy** - Your chats are private and encrypted by Discord
🚫 **No Data Sharing** - We never share personal betting data with third parties
✅ **GDPR Compliant** - Full compliance with international data protection regulations

**What We Collect:**
• Basic Discord profile information (username, ID)
• Subscription status and payment history (through Whop)
• Server activity for analytics (anonymized)
• Support ticket information for assistance

**What We DON'T Collect:**
❌ Your actual betting history or tickets
❌ Personal financial information
❌ Private messages or conversations
❌ Location data or browsing history
❌ Any sensitive personal information

**Security Features:**
🛡️ **Two-Factor Authentication** - Recommended for your Discord account
🔄 **Regular Security Updates** - Our systems are continuously updated
👥 **Staff Training** - Our team is trained in privacy best practices
🔍 **Regular Audits** - We regularly review our security measures

**Your Rights:**
• Request data deletion at any time
• Access your stored information
• Opt out of analytics tracking
• Report security concerns immediately

**Third-Party Services:**
We use trusted partners like Discord and Whop, both of which maintain industry-leading security standards and privacy policies.

Questions about privacy? Contact our support team anytime!`,
    button_label: "Privacy Policy",
    button_url: "https://whop.com/unit-talk/privacy"
  },
  {
    title: "How do you promote responsible gambling?",
    icon: "🧠",
    description: `**Committed to Safe and Responsible Betting Practices**

**Our Core Guidelines:**
💰 **Bet Within Your Means** - Only wager money you can afford to lose
📊 **Set Limits** - Establish daily, weekly, and monthly betting limits
🚫 **Never Chase Losses** - Don't increase bet sizes to recover losses
⏰ **Take Regular Breaks** - Step away when betting becomes stressful
🎯 **Focus on Fun** - Betting should enhance sports enjoyment, not create anxiety

**Educational Resources:**
📚 **Bankroll Management** - Learn proper betting unit sizing
📈 **Understanding Variance** - Why even good bettors have losing streaks
🧮 **ROI Tracking** - Monitor your long-term profitability
⚖️ **Risk Assessment** - Evaluate bets objectively

**Warning Signs to Watch:**
🚨 Betting more than you planned
🚨 Chasing losses with bigger bets
🚨 Neglecting responsibilities for betting
🚨 Borrowing money to bet
🚨 Feeling anxious or depressed about betting

**Support Resources:**
📞 **National Problem Gambling Helpline:** 1-800-522-4700
🌐 **Gamblers Anonymous:** www.gamblersanonymous.org
💬 **NCPG Resources:** National Council on Problem Gambling
🆘 **Crisis Text Line:** Text HOME to 741741

**Our Community Standards:**
• We promote education over quick riches
• Encourage realistic expectations about betting
• Provide transparent results including losses
• Support members who need help
• Maintain a positive, supportive environment

**If You Need Help:**
If you or someone you know is struggling with gambling, please reach out. Our community is here to support responsible betting practices, and we can connect you with professional resources.

Remember: The house always has an edge. Bet responsibly, have fun, and never risk more than you can afford to lose.`,
    button_label: "Responsible Gaming Resources",
    button_url: "https://www.ncpgambling.org/"
  }
];

async function fixAllFAQs() {
  console.log('🔧 Starting comprehensive FAQ fix...');
  
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    await new Promise(resolve => client.once('ready', resolve));
    console.log(`✅ Connected as ${client.user?.tag}`);

    const FAQ_FORUM_ID = '1387837517298139267';
    const forumChannel = await client.channels.fetch(FAQ_FORUM_ID);
    
    if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
      throw new Error('FAQ forum channel not found');
    }

    // Get all existing threads
    const threads = await forumChannel.threads.fetchActive();
    const archivedThreads = await forumChannel.threads.fetchArchived();
    const allThreads = [...threads.threads.values(), ...archivedThreads.threads.values()];
    
    console.log(`📋 Found ${allThreads.length} existing threads`);

    // Delete duplicate threads (ones without emojis)
    const threadsToDelete = [
      "How do you promote responsible gambling?",
      "Is my data secure?", 
      "How do I get notified for new picks?",
      "What if I have questions or need support?",
      "What sports do you cover?",
      "How often are tips provided?",
      "Can I cancel anytime?",
      "What's your track record?",
      "Do you offer a free trial?",
      "How much does it cost?",
      "What does my subscription include?",
      "❓ What is Unit Talk?" // Wrong emoji
    ];

    console.log('🗑️ Deleting duplicate threads...');
    for (const threadName of threadsToDelete) {
      const thread = allThreads.find(t => t.name === threadName);
      if (thread) {
        try {
          await thread.delete();
          console.log(`✅ Deleted: ${threadName}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
        } catch (error) {
          console.log(`❌ Failed to delete: ${threadName}`);
        }
      }
    }

    // Delete existing threads with double emojis and recreate them properly
    console.log('🔄 Recreating threads with proper formatting...');
    
    for (const faq of FIXED_FAQ_DATA) {
      // Find and delete existing thread with emoji in title
      const existingThread = allThreads.find(t => 
        t.name.includes(faq.title) || 
        t.name === `${faq.icon} ${faq.title}`
      );
      
      if (existingThread) {
        try {
          await existingThread.delete();
          console.log(`🗑️ Deleted old: ${existingThread.name}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.log(`❌ Failed to delete: ${existingThread.name}`);
        }
      }

      // Create new thread with proper formatting
      try {
        const thread = await forumChannel.threads.create({
          name: `${faq.icon} ${faq.title}`, // Emoji + title for thread name
          message: {
            content: faq.description,
            components: faq.button_url ? [{
              type: 1,
              components: [{
                type: 2,
                style: 5,
                label: faq.button_label,
                url: faq.button_url
              }]
            }] : []
          }
        });

        console.log(`✅ Created: ${faq.icon} ${faq.title}`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit
      } catch (error) {
        console.log(`❌ Failed to create: ${faq.title} - ${error.message}`);
      }
    }

    console.log('🎉 FAQ fix completed!');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await client.destroy();
    console.log('✅ Disconnected');
    process.exit(0);
  }
}

fixAllFAQs();