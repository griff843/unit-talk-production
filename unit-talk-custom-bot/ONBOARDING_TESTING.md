# 🧪 Onboarding Testing Guide

## How to Test All Onboarding Sequences Instantly

### 🚀 Quick Test Command
Use the new `/test-onboarding` command to instantly test all onboarding sequences without waiting for delays!

### 📋 Available Options

#### Test Single Tier:
```
/test-onboarding tier:vip_plus
/test-onboarding tier:vip
/test-onboarding tier:capper
/test-onboarding tier:staff
/test-onboarding tier:free
```

#### Test All Tiers:
```
/test-onboarding tier:all
```

#### Send to Channel (for easier viewing):
```
/test-onboarding tier:all send-to-channel:true
```

### 🎯 What Gets Tested

#### VIP+ Sequence (3 Messages):
1. **💎 Welcome to VIP Plus!** (Immediate)
   - Access overview with wise owl avatar
   - No buttons

2. **🌟 Welcome to VIP+ Exclusive!** (30 min → Instant in test)
   - Detailed feature breakdown
   - 2 buttons: "🚀 Start VIP+ Tour" + "⚙️ Notification Settings"

3. **🌟 Welcome VIP+ Member!** (2 hours → Instant in test)
   - Comprehensive benefits
   - 3 buttons: "🚀 Start VIP+ Tour" + "🧠 AI Coach" + "📊 Analytics"

#### VIP Sequence (2 Messages):
1. **👑 Welcome to VIP!** (Immediate)
2. **🚀 Getting Started with VIP** (15 min → Instant in test)

#### Other Tiers:
- **Capper**: Welcome message with tools overview
- **Staff/Admin**: Team welcome with admin tools
- **Free**: Basic welcome message

### 🔘 Button Testing
All buttons in the onboarding messages are fully functional:
- **🚀 Start VIP+ Tour**: Shows feature overview
- **⚙️ Notification Settings**: Displays notification preferences
- **🧠 AI Coach**: Explains AI coaching features
- **📊 Analytics**: Shows analytics dashboard info

### ⏱️ Test Mode vs Production Mode

#### Test Mode (Instant):
- All messages sent with 2-second intervals
- Perfect for testing and verification
- Triggered by `/test-onboarding` command

#### Production Mode (Real Delays):
- Message 1: Immediate
- Message 2: 30 minutes later (VIP+) / 15 minutes (VIP)
- Message 3: 2 hours later (VIP+ only)
- Triggered by actual member join or tier upgrade

### 🛡️ Admin Only
The `/test-onboarding` command requires admin permissions for security.

### 📍 Delivery Options
- **DM Mode** (default): Messages sent to your DMs
- **Channel Mode**: Messages posted in the current channel for team review

### 🎉 Perfect Match
The test sequences perfectly replicate your VIP+ designs:
- ✅ Exact emojis (💎, 🌟)
- ✅ Correct titles and descriptions
- ✅ Proper color scheme (#FFD700 gold)
- ✅ Sequential timing simulation
- ✅ Progressive button complexity
- ✅ Personalized username integration

## Example Usage:
```
# Test VIP+ sequence in DMs
/test-onboarding tier:vip_plus

# Test all tiers in current channel
/test-onboarding tier:all send-to-channel:true

# Test specific tier in channel
/test-onboarding tier:vip send-to-channel:true
```

This system allows you to verify every aspect of the onboarding experience instantly! 🚀