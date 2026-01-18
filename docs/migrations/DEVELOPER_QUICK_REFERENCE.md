# Developer Quick Reference: New Picks Schema
**Date:** 2025-10-25  
**Migration:** Production Schema v2.0

---

## 🚀 Quick Start

### Environment Configuration
Add to your `.env` file (already added):
```bash
DEFAULT_TENANT_ID=12d8d677-4d2c-45a6-bbbf-cf6b0f98c79a
```

### Database Connection
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Set tenant context for multi-tenancy (when RLS is enabled)
await pool.query("SET app.tenant_id = $1", [process.env.DEFAULT_TENANT_ID]);
```

---

## 📊 New Schema Overview

### Core Tables
1. **`public.picks`** - Canonical picks table (replaces unified_picks)
2. **`public.pick_publish`** - Publishing outbox for Discord
3. **`public.audit_log`** - Enhanced with tenant_id
4. **`public.capper_threads`** - Capper-to-Discord-thread mapping

### Helper Views
- **`public.vw_recent_picks`** - Picks with joined user/game data

---

## 💻 Code Examples

### Insert a New Pick
```typescript
import { v4 as uuidv4 } from 'uuid';

async function createPick(pickData: {
  userId: string;
  league: string;
  playerId: string;
  gameId?: string;
  marketType: string;
  line: number;
  side: 'OVER' | 'UNDER';
  stakeText: string;
  userScore?: number;
}) {
  const query = `
    INSERT INTO public.picks (
      id,
      tenant_id,
      user_id,
      league,
      player_id,
      game_id,
      market_type,
      line,
      side,
      stake_text,
      user_score,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    RETURNING *
  `;

  const values = [
    uuidv4(),                           // id
    process.env.DEFAULT_TENANT_ID,      // tenant_id
    pickData.userId,                    // user_id
    pickData.league,                    // league
    pickData.playerId,                  // player_id
    pickData.gameId || null,            // game_id
    pickData.marketType,                // market_type
    pickData.line,                      // line
    pickData.side,                      // side
    pickData.stakeText,                 // stake_text
    pickData.userScore || null,         // user_score
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}
```

### Query Recent Picks (Using View)
```typescript
async function getRecentPicksByUser(userId: string, limit: number = 10) {
  const query = `
    SELECT 
      id,
      user_handle,
      league,
      market_type,
      line,
      side,
      stake_text,
      user_score,
      game_date,
      created_at
    FROM public.vw_recent_picks
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  const result = await pool.query(query, [userId, limit]);
  return result.rows;
}
```

### Query Picks by League
```typescript
async function getPicksByLeague(league: string, limit: number = 50) {
  const query = `
    SELECT 
      p.*,
      u.username AS user_handle
    FROM public.picks p
    JOIN public.users u ON u.id = p.user_id
    WHERE p.league = $1
    ORDER BY p.created_at DESC
    LIMIT $2
  `;

  const result = await pool.query(query, [league, limit]);
  return result.rows;
}
```

### Create Publishing Record (Outbox Pattern)
```typescript
async function queuePickForPublishing(pickId: string, channel: 'DISCORD' = 'DISCORD') {
  const query = `
    INSERT INTO public.pick_publish (
      id,
      pick_id,
      channel,
      status,
      attempts,
      created_at
    ) VALUES ($1, $2, $3, 'pending', 0, NOW())
    ON CONFLICT (pick_id, channel) DO NOTHING
    RETURNING *
  `;

  const values = [uuidv4(), pickId, channel];
  const result = await pool.query(query, values);
  return result.rows[0];
}
```

### Process Publishing Outbox
```typescript
async function processPendingPublishes(batchSize: number = 10) {
  const query = `
    SELECT 
      pp.*,
      p.user_id,
      p.league,
      p.market_type,
      p.line,
      p.side,
      u.username
    FROM public.pick_publish pp
    JOIN public.picks p ON p.id = pp.pick_id
    JOIN public.users u ON u.id = p.user_id
    WHERE pp.status = 'pending'
      AND pp.attempts < 3
    ORDER BY pp.created_at ASC
    LIMIT $1
    FOR UPDATE SKIP LOCKED
  `;

  const result = await pool.query(query, [batchSize]);
  return result.rows;
}
```

### Update Publishing Status
```typescript
async function updatePublishStatus(
  publishId: string,
  status: 'sent' | 'failed',
  externalMessageId?: string,
  error?: string
) {
  const query = `
    UPDATE public.pick_publish
    SET 
      status = $2,
      external_message_id = $3,
      last_error = $4,
      attempts = attempts + 1
    WHERE id = $1
    RETURNING *
  `;

  const values = [publishId, status, externalMessageId || null, error || null];
  const result = await pool.query(query, values);
  return result.rows[0];
}
```

### Audit Log Entry
```typescript
async function createAuditLog(auditData: {
  actor: string;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload?: any;
  previousState?: any;
  newState?: any;
  status: string;
  durationMs?: number;
}) {
  const query = `
    INSERT INTO public.audit_log (
      id,
      tenant_id,
      actor,
      actor_type,
      action,
      resource_type,
      resource_id,
      payload,
      previous_state,
      new_state,
      status,
      duration_ms,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    RETURNING *
  `;

  const values = [
    uuidv4(),
    process.env.DEFAULT_TENANT_ID,
    auditData.actor,
    auditData.actorType,
    auditData.action,
    auditData.resourceType,
    auditData.resourceId,
    auditData.payload ? JSON.stringify(auditData.payload) : null,
    auditData.previousState ? JSON.stringify(auditData.previousState) : null,
    auditData.newState ? JSON.stringify(auditData.newState) : null,
    auditData.status,
    auditData.durationMs || null,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}
```

---

## 🔍 Common Queries

### Get Pick Count by User
```sql
SELECT 
  u.username,
  u.tier,
  COUNT(p.id) AS pick_count
FROM public.users u
LEFT JOIN public.picks p ON p.user_id = u.id
GROUP BY u.username, u.tier
ORDER BY pick_count DESC;
```

### Get Pending Publishes
```sql
SELECT 
  pp.id,
  pp.pick_id,
  pp.channel,
  pp.attempts,
  pp.last_error,
  p.league,
  u.username
FROM public.pick_publish pp
JOIN public.picks p ON p.id = pp.pick_id
JOIN public.users u ON u.id = p.user_id
WHERE pp.status = 'pending'
ORDER BY pp.created_at ASC;
```

### Get Failed Publishes
```sql
SELECT 
  pp.*,
  p.league,
  u.username
FROM public.pick_publish pp
JOIN public.picks p ON p.id = pp.pick_id
JOIN public.users u ON u.id = p.user_id
WHERE pp.status = 'failed'
ORDER BY pp.created_at DESC;
```

---

## ⚠️ Important Notes

### Foreign Key Constraints
- **`picks.user_id`** must exist in `users` table
- **`picks.game_id`** must exist in `games` table (if not NULL)
- **`pick_publish.pick_id`** must exist in `picks` table

### Data Types
- All IDs are **UUID** (not text)
- `side` must be **'OVER'** or **'UNDER'** (uppercase)
- `line` is **numeric(6,2)** (e.g., 27.50)
- `stake_text` is **text** (e.g., "1.0", "2.5 units")

### Multi-Tenancy
- RLS policies are created but **NOT ENABLED** yet
- All picks use `DEFAULT_TENANT_ID` for now
- When RLS is enabled, set `app.tenant_id` per session

### Legacy Compatibility
- `unified_picks` table still exists with all original data
- Use `picks` table for all new operations
- Migrate reads from `unified_picks` to `picks` gradually

---

## 🧪 Testing

### Verify Migration
```bash
docker-compose exec postgres psql -U postgres -d unit_talk_dev -f /tmp/verify.sql
```

### Check Row Counts
```sql
SELECT 
  'picks' AS table_name, COUNT(*) AS row_count FROM public.picks
UNION ALL
SELECT 'unified_picks', COUNT(*) FROM public.unified_picks
UNION ALL
SELECT 'pick_publish', COUNT(*) FROM public.pick_publish;
```

### Validate Foreign Keys
```sql
-- Should return 0 violations
SELECT COUNT(*) AS violations
FROM public.picks p
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p.user_id);
```

---

## 📚 Additional Resources

- **Full Migration Report:** `/docs/migrations/2025-10-25_PRODUCTION_SCHEMA_MIGRATION_REPORT.md`
- **Migration Scripts:** `/scripts/migrations/2025-10-25_*.sql`
- **API Documentation:** `/docs/api/`
- **Architecture Docs:** `/docs/architecture/`

---

## 🆘 Troubleshooting

### Issue: Can't insert pick - foreign key violation
**Solution:** Ensure `user_id` exists in `users` table before inserting

### Issue: Can't find recent picks
**Solution:** Use `public.vw_recent_picks` view or join with `users` table

### Issue: Publishing not working
**Solution:** Check `pick_publish` table for pending/failed records

### Issue: RLS blocking queries
**Solution:** RLS is not enabled yet; if enabled, ensure `app.tenant_id` is set

---

**Last Updated:** 2025-10-25  
**Schema Version:** 2.0  
**Status:** ✅ Production Ready

