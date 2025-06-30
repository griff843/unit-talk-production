# Database Service

A strictly typed database service for the Unit Talk platform using Supabase with comprehensive TypeScript support.

## Features

- **Strict TypeScript typing** using generated Supabase types
- **Comprehensive CRUD operations** for all database tables
- **Built-in error handling** with structured logging
- **Type-safe query builders** with filtering and pagination
- **Consistent API patterns** across all operations
- **Automatic timestamp management**
- **Connection health monitoring**

## Quick Start

```typescript
import { databaseService } from '../services/database';

// Get user profile with full type safety
const profile = await databaseService.getUserProfile(discordId);
if (profile) {
  console.log(profile.tier); // Type: 'member' | 'vip' | 'vip_plus' | 'staff' | 'admin' | 'owner'
}

// Create a user pick with validation
const pick = await databaseService.createUserPick({
  user_id: discordId,
  discord_id: discordId,
  pick_type: 'player_prop',
  stake: 100,
  result: 'pending'
});
```

## Available Operations

### User Profiles
- `getUserProfile(discordId)` - Get user profile by Discord ID
- `createUserProfile(profile)` - Create new user profile
- `updateUserProfile(discordId, updates)` - Update user profile
- `upsertUserProfile(profile)` - Create or update user profile
- `getUserTier(discordId)` - Get user's tier
- `updateUserTier(discordId, tier)` - Update user's tier

### User Picks
- `getUserPicks(discordId, options)` - Get user picks with filtering/pagination
- `createUserPick(pick)` - Create new user pick
- `updateUserPick(pickId, updates)` - Update user pick
- `getUserPickStats(discordId)` - Get comprehensive pick statistics

### Final Picks (Graded Picks)
- `getFinalPicks(options)` - Get final picks with filtering
- `createFinalPick(pick)` - Create new final pick
- `updateFinalPick(pickId, updates)` - Update final pick

### Game Threads
- `getGameThreads(options)` - Get game threads with filtering
- `createGameThread(thread)` - Create new game thread
- `updateGameThread(threadId, updates)` - Update game thread

### User Cooldowns
- `getUserCooldown(userId, commandType)` - Get user cooldown
- `upsertUserCooldown(cooldown)` - Set user cooldown
- `isUserOnCooldown(userId, commandType)` - Check if user is on cooldown

### Analytics & Activity
- `trackAnalyticsEvent(event)` - Track analytics event
- `trackUserActivity(discordId, activityType, metadata)` - Track user activity

### Thread Statistics
- `getThreadStats(threadId)` - Get thread statistics
- `updateThreadStats(threadId, updates)` - Update thread statistics

### Utilities
- `healthCheck()` - Check database connection health
- `getConnectionInfo()` - Get connection information

## Type Safety

All operations use strict TypeScript types generated from the Supabase schema:

```typescript
import { 
  UserProfileRow,
  UserProfileInsert,
  UserProfileUpdate,
  UserTier,
  UserPicksRow,
  FinalPicksRow
} from '../services/database';

// Strongly typed user tier
const tier: UserTier = 'vip'; // Only valid tiers allowed

// Type-safe profile creation
const profile: UserProfileInsert = {
  discord_id: '123456789',
  username: 'user123',
  tier: 'member',
  subscription_tier: 'FREE', // Required field
  metadata: {} // Properly typed as Json
};
```

## Error Handling

The service provides consistent error handling patterns:

```typescript
// Methods return null/false on error instead of throwing
const profile = await databaseService.getUserProfile(discordId);
if (!profile) {
  // Handle user not found
  console.log('User not found');
  return;
}

// Boolean return for success/failure operations
const success = await databaseService.updateUserTier(discordId, 'vip');
if (!success) {
  console.log('Failed to update tier');
}
```

All errors are automatically logged with structured context for debugging.

## Pagination and Filtering

Many operations support advanced filtering and pagination:

```typescript
// Get user picks with filtering
const picks = await databaseService.getUserPicks(discordId, {
  limit: 20,
  offset: 0,
  result: 'win', // Only winning picks
  orderBy: 'created_at',
  ascending: false
});

// Get game threads by sport
const nbaThreads = await databaseService.getGameThreads({
  sport: 'NBA',
  isActive: true,
  limit: 10
});
```

## Statistics and Analytics

Get comprehensive statistics with type safety:

```typescript
const stats = await databaseService.getUserPickStats(discordId);

console.log(`Total picks: ${stats.totalPicks}`);
console.log(`Win rate: ${Math.round(stats.winRate * 100)}%`);
console.log(`Total profit: ${stats.totalProfit}`);
console.log(`Average stake: ${stats.averageStake}`);
```

## Cooldown Management

Built-in cooldown system for rate limiting:

```typescript
// Check if user can perform action
const canAct = await databaseService.isUserOnCooldown(userId, 'create_pick');

// Set cooldown
await databaseService.upsertUserCooldown({
  user_id: userId,
  discord_id: userId,
  command_type: 'create_pick',
  expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
});
```

## Activity Tracking

Comprehensive activity and analytics tracking:

```typescript
// Track user activity (updates both analytics and user profile)
await databaseService.trackUserActivity(discordId, 'pick_created', {
  pick_type: 'player_prop',
  stake: 100
});

// Track specific analytics events
await databaseService.trackAnalyticsEvent({
  user_id: discordId,
  guild_id: guildId,
  event_type: 'command_used',
  event_data: { command: 'pick', success: true }
});
```

## Health Monitoring

Monitor database connection health:

```typescript
const isHealthy = await databaseService.healthCheck();
const connectionInfo = databaseService.getConnectionInfo();

console.log(`Database healthy: ${isHealthy}`);
console.log(`Connection URL: ${connectionInfo.url}`);
```

## Migration from Legacy Service

If you're migrating from the legacy `SupabaseService`, see [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) for a comprehensive migration guide.

## Examples

See [src/examples/database-usage.ts](./src/examples/database-usage.ts) for comprehensive examples including:

- User profile management
- Pick creation and management
- Cooldown handling
- Statistics calculation
- Real-world Discord command handlers

## Configuration

The service uses the same configuration as the legacy Supabase service:

```typescript
// config/base.json
{
  "supabase": {
    "url": "your-supabase-url",
    "serviceRoleKey": "your-service-role-key"
  }
}
```

## Best Practices

1. **Always handle null returns**: Methods return `null` when records aren't found
2. **Use type imports**: Import specific types for better IDE support
3. **Leverage filtering**: Use built-in filtering instead of client-side filtering
4. **Check return values**: Boolean methods indicate success/failure
5. **Use structured logging**: Errors are automatically logged with context

## Performance Considerations

- Use pagination for large result sets
- Leverage database-side filtering instead of client-side filtering
- Use `select` with specific fields when you don't need all columns
- Consider caching for frequently accessed data
- Use batch operations when possible

## Contributing

When adding new operations:

1. Follow the existing patterns for error handling
2. Use proper TypeScript types from the schema
3. Add comprehensive JSDoc comments
4. Include structured logging for errors
5. Add examples to the usage file
6. Update this README with new operations