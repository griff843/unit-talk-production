# Unit Talk Onboarding Test Setup Guide

Last Updated: July 20, 2025

## Test Environment Setup

### 1. Create Test Discord Server

1. Create a new Discord server for testing
2. Name it "Unit Talk Test Server"
3. Create the following channels:
   - #general
   - #picks
   - #vip
   - #vip-plus
   - #admin
   - #logs
   - #announcements
   - #free-picks
   - #vip-picks
   - #vip-general
   - #vip-plus-picks
   - #vip-plus-general
   - #threads

### 2. Create Test Roles

1. Create the following roles:
   - Member (default)
   - VIP
   - VIP+
   - Staff
   - Admin
   - Owner
   - Moderator

2. Set up role permissions:
   - Member: Basic access
   - VIP: Access to VIP channels
   - VIP+: Access to VIP+ channels
   - Staff: Moderation tools
   - Admin: Full access
   - Owner: Full access
   - Moderator: Moderation tools

### 3. Create Test Users

1. Create test accounts for each tier:
   - test_free_user
   - test_vip_user
   - test_vip_plus_user
   - test_capper_user
   - test_staff_user
   - test_admin_user

2. Join the test server with each account

### 4. Configure Test Bot

1. Create a test bot application in Discord Developer Portal
2. Add bot to test server with required permissions:
   - Send Messages
   - Manage Messages
   - Read Message History
   - Create Public Threads
   - Send Messages in Threads
   - Manage Threads
   - Add Reactions
   - Embed Links
   - Attach Files
   - Mention Everyone
   - Use External Emojis
   - Use External Stickers
   - Manage Roles
   - Manage Channels

### 5. Environment Configuration

Create `.env.test` with the following: \`\`\`env

# Discord Bot Configuration

DISCORD_BOT_TOKEN=your_test_bot_token DISCORD_CLIENT_ID=your_test_client_id
DISCORD_GUILD_ID=your_test_guild_id

# Test Server Channels

GENERAL_CHANNEL_ID=your_test_general_channel
PICKS_CHANNEL_ID=your_test_picks_channel

# ... (add all channel IDs)

# Test Server Roles

MEMBER_ROLE_ID=your_test_member_role VIP_ROLE_ID=your_test_vip_role

# ... (add all role IDs)

# Test Database

SUPABASE_URL=your_test_supabase_url SUPABASE_KEY=your_test_supabase_key
SUPABASE_ANON_KEY=your_test_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key

# Test Mode

ENABLE_TEST_MODE=true MOCK_EXTERNAL_SERVICES=true \`\`\`

### 6. Test Database Setup

1. Create test database in Supabase
2. Run migrations:
   ```bash
   npm run migrate:test
   ```
3. Seed test data:
   ```bash
   npm run seed:test
   ```

## Manual Testing Process

### 1. Start Test Environment

```bash
npm run start:test
```

### 2. Test User Onboarding

For each tier:

1. Join server with test user
2. Verify welcome message
3. Test all buttons in welcome message
4. Test all slash commands
5. Document results in ONBOARDING_AUDIT.md

### 3. Test Flow

1. Free Tier:
   - Join with test_free_user
   - Test upgrade buttons
   - Test free commands
   - Document results

2. VIP Tier:
   - Join with test_vip_user
   - Test VIP features
   - Test VIP commands
   - Document results

3. VIP+ Tier:
   - Join with test_vip_plus_user
   - Test VIP+ features
   - Test VIP+ commands
   - Document results

4. Capper Tier:
   - Join with test_capper_user
   - Test capper features
   - Test capper commands
   - Document results

5. Staff Tier:
   - Join with test_staff_user
   - Test staff features
   - Test staff commands
   - Document results

6. Admin Tier:
   - Join with test_admin_user
   - Test admin features
   - Test admin commands
   - Document results

### 4. Error Cases

Test the following scenarios:

1. Rate limiting
2. Permission errors
3. Invalid commands
4. Network issues
5. Database errors

### 5. Performance Testing

1. Test response times
2. Test concurrent users
3. Test message queuing
4. Test thread creation

## Test Reporting

### 1. Update Documentation

After testing, update:

- ONBOARDING_AUDIT.md
- TEST_RESULTS.md
- KNOWN_ISSUES.md

### 2. Generate Reports

Run report generators:

```bash
npm run generate:test-report
npm run generate:coverage-report
```

### 3. Review Metrics

Check:

- Response times
- Success rates
- Error rates
- Resource usage

## Cleanup

### 1. Data Cleanup

```bash
npm run cleanup:test
```

### 2. Environment Cleanup

1. Archive test logs
2. Reset test database
3. Clear test channels

## Notes

- Document all issues found
- Take screenshots of errors
- Record response times
- Note any UI/UX concerns
- Track any performance issues
