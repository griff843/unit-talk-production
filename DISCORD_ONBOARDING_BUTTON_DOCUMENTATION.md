# Discord Bot Onboarding System - Button Functionality Documentation

## Overview

This document provides a comprehensive breakdown of the Discord bot's onboarding system, including all button interactions, flows, and troubleshooting information.

## System Architecture

### Core Components

1. **DiscordOnboardingAgent.ts** - Handles new member and role change onboarding
2. **OnboardingService.ts** - Generates welcome messages with buttons based on user tier
3. **onboardingButtonHandler.ts** - Handles button interactions from onboarding messages
4. **interactionHandler.ts** - Main interaction router that routes button clicks to appropriate handlers
5. **capperButtonHandler.ts** - Handles capper-specific button interactions

### Button Flow Architecture

```
User clicks button → Discord sends interactionCreate event → interactionHandler.ts
                                                                      ↓
                                                            Checks button type
                                                                      ↓
                                                    Routes to appropriate handler:
                                                    - OnboardingButtonHandler
                                                    - CapperButtonHandler
                                                    - Legacy handlers
```

## User Tiers and Access Control

### Tier Hierarchy (from lowest to highest)
1. **member/basic** - Default tier for new users
2. **trial** - Trial access users
3. **vip** - VIP members
4. **vip_plus** - VIP+ Elite members
5. **capper** - Content creators/cappers
6. **staff** - Staff members
7. **admin** - Administrators
8. **owner** - Server owner

### Role Names (Discord roles)
- **💎 VIP Member** → `vip` tier
- **🔱 VIP+ Member** → `vip_plus` tier
- **Trial** → `trial` tier
- **🎯 UT Capper** → `capper` tier
- **👮 Staff** → `staff` tier
- **🎖️Admin** → `admin` tier
- **👑 Owner** → `owner` tier
- **🪄 Member** → `member` tier (default)

## Onboarding Flows by Tier

### 1. VIP Member Flow

**Welcome Message:**
- Title: "🎉 Welcome to Unit Talk VIP!"
- Description: Access to premium picks, exclusive channels, and priority support

**Available Buttons:**
- `view_vip_guide` - "VIP Guide" (Primary, 📖)
- `setup_notifications` - "Setup Notifications" (Secondary, 🔔)

**Button Functionality:**
- **VIP Guide**: Shows comprehensive VIP features, benefits, and navigation guide
- **Setup Notifications**: Provides notification setup options for capper picks and updates

### 2. VIP+ Elite Member Flow

**Welcome Message:**
- Title: "✨ Welcome to Unit Talk VIP+ Elite!"
- Description: Premium tier with exclusive elite features and priority access

**Available Buttons:**
- `view_vip_plus_guide` - "VIP+ Guide" (Primary, 💎)
- `access_elite_features` - "Elite Features" (Success, ⭐)
- `vip_plus_tour` - "Take Tour" (Secondary, 🎯)
- `setup_vip_plus_notifications` - "Setup Notifications" (Secondary, 🔔)

**Button Functionality:**
- **VIP+ Guide**: Detailed guide for VIP+ exclusive features
- **Elite Features**: Access to premium analytics, early picks, and exclusive content
- **Take Tour**: Interactive tour of VIP+ features
- **Setup Notifications**: Advanced notification settings for VIP+ members

### 3. Trial Member Flow

**Welcome Message:**
- Title: "🚀 Welcome to Unit Talk!"
- Description: Start your journey with expert picks and analysis

**Available Buttons:**
- `view_trial_features` - "Getting Started Guide" (Primary, 🎯)
- `upgrade_to_vip` - "Upgrade to VIP" (Success, ⭐)
- `upgrade_to_vip_plus` - "Upgrade to VIP+" (Success, 💎)

**Button Functionality:**
- **Getting Started Guide**: Introduction to platform features and how to get started
- **Upgrade to VIP**: Information about VIP benefits and upgrade process
- **Upgrade to VIP+**: Information about VIP+ Elite benefits and upgrade process

### 4. Basic Member Flow

**Welcome Message:**
- Title: "👋 Welcome to Unit Talk!"
- Description: Welcome to the Unit Talk community

**Available Buttons:**
- `view_faq` - "View FAQ" (Secondary, ❓)
- `start_vip_trial` - "Start VIP Trial" (Success, 🚀)

**Button Functionality:**
- **View FAQ**: Access to frequently asked questions and basic information
- **Start VIP Trial**: Information about starting a VIP trial

### 5. Capper Flow

**Welcome Message:**
- Title: "🎯 Welcome Unit Talk Capper!"
- Description: Ready to share your expertise with the community

**Available Buttons:**
- `capper_guide` - "Capper Guide" (Primary, 📋)
- `create_capper_thread` - "Create Threads" (Success, 🧵)
- `capper_practice_pick` - "Practice Pick" (Secondary, 🎯)
- `view_leaderboard` - "View Leaderboard" (Secondary, 🏆)
- `capper_support` - "Get Support" (Secondary, 💬)

**Button Functionality:**
- **Capper Guide**: Comprehensive guide for cappers including rules, best practices, and tools
- **Create Threads**: Creates dedicated threads for the capper (Official Picks + Q&A Discussion)
- **Practice Pick**: Tutorial on how to submit picks using the `/submit-pick` command
- **View Leaderboard**: Access to capper performance leaderboard
- **Get Support**: Direct access to capper support and assistance

### 6. Staff Flow

**Welcome Message:**
- Title: "👮 Welcome Staff Member!"
- Description: Access to staff tools and moderation features

**Available Buttons:**
- `staff_guide` - "Staff Guide" (Primary, 📋)

**Button Functionality:**
- **Staff Guide**: Staff-specific documentation, tools, and procedures

## Button Implementation Details

### Access Control System

The `validateButtonAccess` method ensures users can only access buttons appropriate for their tier:

```typescript
// Permissive access control - users can access buttons for their tier and below
switch (userTier) {
  case 'owner':
  case 'admin': 
  case 'staff':
    return true; // Full access
  
  case 'vip_plus':
    // Can access VIP+, VIP, trial, basic, and secondary buttons
    
  case 'vip':
    // Can access VIP, trial, basic, and secondary buttons
    
  case 'trial':
    // Can access trial, basic, and secondary buttons
    
  case 'capper':
    // Can access capper, basic, and secondary buttons
    
  case 'member':
  case 'basic':
  default:
    // Can access basic and secondary buttons only
}
```

### Button Categories

1. **Primary Buttons** - Main action buttons (Blue)
2. **Secondary Buttons** - Supporting action buttons (Gray)
3. **Success Buttons** - Positive actions like upgrades (Green)
4. **Danger Buttons** - Destructive actions (Red) - Not currently used

### Secondary Buttons (Available to all tiers)
- `setup_notifications_now` - Quick notification setup
- `notification_help` - Help with notification settings

## Capper-Specific Features

### Thread Creation Process

When a capper clicks "Create Threads":

1. **Official Picks Thread** - Read-only for public, capper can post picks
2. **Q&A Discussion Thread** - Interactive thread for community engagement
3. **Bio Template** - Automatically posted template for capper profile
4. **Notification** - Alerts admin (griff843) about new capper threads

### Thread Structure
```
📁 Capper Corner
  ├── 🔥 [Username] - Official Picks (Read-only for public)
  └── 💬 [Username] - Q&A & Discussion (Interactive)
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Buttons Not Responding
**Symptoms:** Clicking buttons shows no response or error
**Causes:**
- Bot not receiving interaction events
- Button routing issues
- Access control blocking interaction

**Solutions:**
- Check bot permissions (Manage Messages, Send Messages, Use Slash Commands)
- Verify button customId matches handler expectations
- Check user tier and access control logic
- Review bot logs for error messages

#### 2. Access Denied Errors
**Symptoms:** "You don't have access to this feature" message
**Causes:**
- User tier not properly detected
- Restrictive access control logic
- Role name mismatch

**Solutions:**
- Verify Discord role names match ROLE_NAMES configuration
- Check getUserTier function logic
- Review validateButtonAccess method
- Ensure user has correct Discord roles

#### 3. Analytics Errors
**Symptoms:** "Error flushing analytics events" in logs
**Causes:**
- Missing 'metadata' column in analytics_events table
- Supabase connection issues
- Database schema mismatch

**Solutions:**
- Add metadata column to analytics_events table
- Verify Supabase connection and credentials
- Update database schema to match expected structure

### Debug Logging

The system includes comprehensive debug logging:

```
🔘 Button interaction received: [customId] from user [username]
👤 User [username] has tier: [tier]
✅ Access granted for button [customId] - user tier: [tier]
📋 Routing to onboarding handler: [customId]
✅ Successfully handled button [customId] for user [username]
```

### Testing Button Functionality

Use the provided test script (`test-button-functionality.js`):

```bash
node test-button-functionality.js
```

Commands in Discord:
- `!test-buttons vip` - Test VIP buttons
- `!test-buttons trial` - Test trial buttons
- `!test-buttons capper` - Test capper buttons
- `!test-buttons all` - Test all buttons

## Configuration Files

### Key Configuration Files
- `src/config/onboarding.prompts.ts` - Button definitions and welcome messages
- `src/utils/roleUtils.ts` - User tier detection logic
- `src/handlers/onboardingButtonHandler.ts` - Button interaction handlers
- `src/handlers/interactionHandler.ts` - Main interaction router

### Environment Variables Required
- `DISCORD_TOKEN` - Bot token
- `DISCORD_GUILD_ID` - Server ID
- `SUPABASE_URL` - Database URL
- `SUPABASE_ANON_KEY` - Database key

## Maintenance and Updates

### Adding New Buttons

1. **Define button in OnboardingService.ts**:
```typescript
{
  customId: "new_button_id",
  label: "Button Label", 
  style: ButtonStyle.Primary,
  emoji: "🎯"
}
```

2. **Add to button validation**:
```typescript
// In validateButtonAccess method
const newButtons = ['new_button_id'];
```

3. **Implement handler**:
```typescript
// In onboardingButtonHandler.ts
case 'new_button_id':
  await this.handleNewButton(interaction);
  break;
```

4. **Add to isOnboardingButton check**:
```typescript
// In static isOnboardingButton method
const onboardingButtons = [
  // ... existing buttons
  'new_button_id'
];
```

### Modifying Access Control

Update the `validateButtonAccess` method in `onboardingButtonHandler.ts` to modify which tiers can access which buttons.

### Performance Monitoring

Monitor these metrics:
- Button interaction response times
- Error rates by button type
- User tier distribution
- Most/least used buttons

## Security Considerations

1. **Access Control** - Buttons are protected by tier-based access control
2. **Input Validation** - All button interactions are validated
3. **Error Handling** - Comprehensive error handling prevents crashes
4. **Logging** - All interactions are logged for audit purposes
5. **Rate Limiting** - Discord's built-in rate limiting prevents abuse

## Future Enhancements

### Planned Features
1. **Dynamic Button Generation** - Generate buttons based on user preferences
2. **A/B Testing** - Test different button layouts and messaging
3. **Analytics Dashboard** - Track button usage and user engagement
4. **Personalized Onboarding** - Customize flows based on user behavior
5. **Multi-language Support** - Support for multiple languages

### Technical Improvements
1. **Button State Management** - Track button interaction history
2. **Caching** - Cache user tiers and permissions
3. **Batch Processing** - Handle multiple interactions efficiently
4. **Monitoring** - Real-time monitoring and alerting
5. **Testing** - Automated testing for all button interactions

---

**Last Updated:** $(date)
**Version:** 1.0.0
**Maintainer:** Unit Talk Development Team