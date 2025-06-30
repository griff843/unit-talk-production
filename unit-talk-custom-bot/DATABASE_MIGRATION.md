# Database Service Migration Guide

This guide helps you migrate from the legacy `SupabaseService` to the new strictly typed `DatabaseService`.

## Overview

The new `DatabaseService` provides:
- **Strict TypeScript typing** using generated Supabase types
- **Better error handling** with structured logging
- **Comprehensive CRUD operations** for all database tables
- **Type-safe query builders** with proper filtering and pagination
- **Consistent API patterns** across all operations

## Quick Migration

### Before (Legacy SupabaseService)
```typescript
import { supabaseService } from '../services/supabase';

// Get user profile (loosely typed)
const profile = await supabaseService.getUserProfile(discordId);
if (profile) {
  console.log(profile.tier); // Type: any
}

// Create pick (no type safety)
const pick = await supabaseService.createPick({
  capper_id: discordId,
  player_id: 'some-id',
  // ... other fields
});
```

### After (New DatabaseService)
```typescript
import { databaseService } from '../services/database';

// Get user profile (strictly typed)
const profile = await databaseService.getUserProfile(discordId);
if (profile) {
  console.log(profile.tier); // Type: 'member' | 'vip' | 'vip_plus' | 'staff' | 'admin' | 'owner'
}

// Create pick (full type safety)
const pick = await databaseService.createUserPick({
  user_id: discordId,
  discord_id: discordId,
  pick_type: 'player_prop',
  stake: 100,
  result: 'pending',
  // TypeScript will enforce all required fields
});
```

## Migration Steps

### 1. Update Imports

**Old:**
```typescript
import { supabaseService } from '../services/supabase';
```

**New:**
```typescript
import { databaseService } from '../services/database';
// Or import specific types
import { databaseService, UserProfileRow, UserTier } from '../services/database';
```

### 2. User Profile Operations

#### Get User Profile
**Old:**
```typescript
const profile = await supabaseService.getUserProfile(discordId);
```

**New:**
```typescript
const profile = await databaseService.getUserProfile(discordId);
// profile is now UserProfileRow | null with full type safety
```

#### Create User Profile
**Old:**
```typescript
const profile = await supabaseService.createUserProfile({
  discord_id: discordId,
  username: username,
  tier: 'member'
});
```

**New:**
```typescript
const profile = await databaseService.createUserProfile({
  discord_id: discordId,
  username: username,
  tier: 'member', // Strongly typed
  subscription_tier: 'FREE', // Required field
  metadata: {} // Properly typed as Json
});
```

#### Update User Profile
**Old:**
```typescript
await supabaseService.updateUserProfile(discordId, {
  tier: 'vip',
  last_active: new Date()
});
```

**New:**
```typescript
await databaseService.updateUserProfile(discordId, {
  tier: 'vip', // Type-checked
  last_active: new Date().toISOString() // Must be string
});
```

### 3. Pick Operations

#### Get User Picks
**Old:**
```typescript
const picks = await supabaseService.getUserPicks(discordId, 10);
```

**New:**
```typescript
const picks = await databaseService.getUserPicks(discordId, {
  limit: 10,
  offset: 0,
  result: 'pending', // Optional filter
  orderBy: 'created_at',
  ascending: false
});
```

#### Create Pick
**Old:**
```typescript
const pick = await supabaseService.createPick({
  capper_id: discordId,
  // ... loosely typed fields
});
```

**New:**
```typescript
// For user picks
const pick = await databaseService.createUserPick({
  user_id: discordId,
  discord_id: discordId,
  pick_type: 'player_prop',
  stake: 100,
  result: 'pending',
  // All fields are type-checked
});

// For final picks (graded picks)
const finalPick = await databaseService.createFinalPick({
  capper_id: discordId,
  player_id: 'player-123',
  game_id: 'game-456',
  stat_type: 'points',
  line: 25.5,
  odds: -110,
  stake: 100,
  payout: 190.91,
  result: 'pending',
  actual_value: 0,
  tier: 'A',
  ticket_type: 'single',
  sport: 'NBA',
  league: 'NBA',
  confidence: 85
});
```

### 4. Cooldown Operations

#### Check Cooldown
**Old:**
```typescript
// No direct method - had to implement manually
```

**New:**
```typescript
const isOnCooldown = await databaseService.isUserOnCooldown(userId, 'create_pick');
const cooldown = await databaseService.getUserCooldown(userId, 'create_pick');
```

#### Set Cooldown
**Old:**
```typescript
await supabaseService.upsertUserCooldown(userId, 'action', expiresAt);
```

**New:**
```typescript
await databaseService.upsertUserCooldown({
  user_id: userId,
  discord_id: userId,
  command_type: 'create_pick', // Note: field name changed
  expires_at: expiresAt.toISOString()
});
```

### 5. Analytics and Activity Tracking

#### Track User Activity
**Old:**
```typescript
await supabaseService.trackUserActivity(discordId, 'pick_created', metadata);
```

**New:**
```typescript
await databaseService.trackUserActivity(discordId, 'pick_created', metadata);
// This method now properly handles both analytics_events and user profile updates
```

#### Track Analytics Event
**Old:**
```typescript
// No direct method
```

**New:**
```typescript
await databaseService.trackAnalyticsEvent({
  user_id: discordId,
  guild_id: guildId,
  event_type: 'command_used',
  event_data: { command: 'pick', success: true },
  timestamp: new Date().toISOString()
});
```

## Key Differences

### 1. Field Name Changes
- `action` → `command_type` (in user_cooldowns)
- `avatar_url` → `avatar` (in user_profiles)
- `type` → `event_type` (in analytics_events)
- `action` → `event_type` (in analytics_events)
- `metadata` → `event_data` (in analytics_events)

### 2. Required Fields
The new service enforces all required fields from the database schema:
- `subscription_tier` is required when creating user profiles
- `guild_id` is required for analytics events
- `discord_id` is required for user_cooldowns

### 3. Type Safety
All operations now have strict typing:
```typescript
// Old: any type
const tier = profile.tier;

// New: strongly typed
const tier: 'member' | 'vip' | 'vip_plus' | 'staff' | 'admin' | 'owner' = profile.tier;
```

### 4. Error Handling
The new service provides better error handling:
```typescript
// Old: Generic error handling
try {
  const result = await supabaseService.someMethod();
} catch (error) {
  console.error('Something went wrong:', error);
}

// New: Structured error logging with context
try {
  const result = await databaseService.someMethod();
} catch (error) {
  // Errors are automatically logged with context
  // Methods return null/false on error instead of throwing
}
```

## Advanced Features

### 1. User Pick Statistics
```typescript
const stats = await databaseService.getUserPickStats(discordId);
// Returns comprehensive statistics with type safety
console.log(`Win rate: ${Math.round(stats.winRate * 100)}%`);
console.log(`Total profit: ${stats.totalProfit}`);
```

### 2. Pagination and Filtering
```typescript
const picks = await databaseService.getUserPicks(discordId, {
  limit: 20,
  offset: 40, // Page 3
  result: 'win', // Only winning picks
  orderBy: 'created_at',
  ascending: false
});
```

### 3. Game Thread Management
```typescript
const threads = await databaseService.getGameThreads({
  isActive: true,
  sport: 'NBA',
  limit: 10
});

const newThread = await databaseService.createGameThread({
  game_id: 'game-123',
  channel_id: 'channel-456',
  thread_id: 'thread-789',
  sport: 'NBA',
  teams: ['Lakers', 'Warriors'],
  game_time: new Date().toISOString(),
  is_active: true,
  metadata: { created_by: 'bot' }
});
```

## Backward Compatibility

The legacy `SupabaseService` still works and now uses the new `DatabaseService` internally. However, it's marked as deprecated and should be migrated to the new service for:

- Better type safety
- Improved error handling
- Access to new features
- Future-proofing your code

## Best Practices

### 1. Use Type Imports
```typescript
import { 
  databaseService, 
  UserProfileRow, 
  UserTier,
  UserPicksInsert 
} from '../services/database';
```

### 2. Handle Null Returns
```typescript
const profile = await databaseService.getUserProfile(discordId);
if (!profile) {
  // Handle user not found
  return;
}
// profile is now guaranteed to be UserProfileRow
```

### 3. Use Proper Error Handling
```typescript
const success = await databaseService.updateUserTier(discordId, 'vip');
if (!success) {
  // Handle update failure
  logger.error('Failed to update user tier');
}
```

### 4. Leverage Type Safety
```typescript
// TypeScript will catch this error at compile time
const invalidTier: UserTier = 'invalid'; // Error!

// Correct usage
const validTier: UserTier = 'vip'; // ✓
```

## Migration Checklist

- [ ] Update all imports from `supabaseService` to `databaseService`
- [ ] Fix field name changes (`action` → `command_type`, etc.)
- [ ] Add required fields that were previously optional
- [ ] Update type annotations to use the new strict types
- [ ] Test all database operations with the new service
- [ ] Update error handling to use the new patterns
- [ ] Remove any workarounds that are no longer needed
- [ ] Update documentation and comments

## Need Help?

If you encounter issues during migration:

1. Check the TypeScript errors - they'll guide you to the correct types
2. Look at the examples in `src/examples/database-usage.ts`
3. Use the database service's built-in logging for debugging
4. The legacy service is still available as a fallback during transition