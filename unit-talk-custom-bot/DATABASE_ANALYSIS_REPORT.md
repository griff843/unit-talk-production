# Database Schema Analysis and Migration Plan

## Executive Summary

This analysis identified **21 missing database tables** that are referenced in the codebase but not defined in the current schema. The most critical missing table is `user_profiles`, which is heavily referenced across multiple services.

## Current State Analysis

### Existing Schema Coverage
- **9 tables** defined in `onboarding_schema.sql`
- **4 tables** defined in TypeScript types (`src/db/types/supabase.ts`)
- **21 tables** referenced in code but missing from schema

### Critical Missing Tables

#### 1. **user_profiles** (CRITICAL - Most Referenced)
- **Usage**: Referenced in 8+ service files
- **Impact**: Core user management functionality
- **Services affected**: supabase.ts, admin.ts, gradingService.ts, vipNotificationService.ts

#### 2. **game_threads** (HIGH PRIORITY)
- **Usage**: Core thread management system
- **Impact**: Game thread creation and management
- **Services affected**: threadService.ts

#### 3. **user_picks** (HIGH PRIORITY)
- **Usage**: Pick tracking and grading
- **Impact**: Core betting functionality
- **Services affected**: threadService.ts, gradingService.ts

## Detailed Table Analysis

### Tables with Complete Schema Definitions Needed

| Table Name | Priority | Services Using | Key Functionality |
|------------|----------|----------------|-------------------|
| `user_profiles` | CRITICAL | 8+ services | User management, tiers, authentication |
| `game_threads` | HIGH | threadService | Game thread management |
| `user_picks` | HIGH | threadService, gradingService | Pick tracking |
| `thread_stats` | MEDIUM | threadService | Thread analytics |
| `thread_followers` | MEDIUM | threadService | Thread subscriptions |
| `user_cooldowns` | MEDIUM | supabase | Rate limiting |
| `pick_gradings` | MEDIUM | gradingService | Pick quality assessment |
| `coaching_sessions` | MEDIUM | gradingService | User coaching |
| `message_feedback` | LOW | feedback | Message rating system |
| `feedback_messages` | LOW | feedback | User feedback collection |
| `activity_logs` | LOW | admin | Admin dashboard |
| `config_edit_sessions` | LOW | quickEditConfigService | Config management |
| `config_changes` | LOW | quickEditConfigService | Config change tracking |
| `agent_health_checks` | LOW | monitoring | System health monitoring |
| `keyword_triggers` | LOW | keywordEmojiDMService | Automated responses |
| `emoji_triggers` | LOW | keywordEmojiDMService | Emoji-based triggers |
| `auto_dm_templates` | LOW | keywordEmojiDMService | DM automation |
| `trigger_activation_logs` | LOW | keywordEmojiDMService | Trigger usage tracking |
| `vip_notification_sequences` | LOW | vipNotificationService | VIP messaging |
| `vip_welcome_flows` | LOW | vipNotificationService | VIP onboarding |
| `notification_logs` | LOW | vipNotificationService | Notification tracking |

## Migration Strategy

### Phase 1: Critical Tables (Immediate)
1. **user_profiles** - Core user management
2. **game_threads** - Thread management system
3. **user_picks** - Pick tracking functionality

### Phase 2: High Priority Tables (Week 1)
4. **thread_stats** - Thread analytics
5. **thread_followers** - Thread subscriptions
6. **user_cooldowns** - Rate limiting
7. **pick_gradings** - Pick assessment

### Phase 3: Medium Priority Tables (Week 2)
8. **coaching_sessions** - User coaching
9. **activity_logs** - Admin functionality
10. **config_edit_sessions** - Config management
11. **config_changes** - Config tracking

### Phase 4: Low Priority Tables (Week 3)
12. **agent_health_checks** - System monitoring
13. **message_feedback** - Feedback system
14. **feedback_messages** - User feedback
15. **keyword_triggers** - Automated responses
16. **emoji_triggers** - Emoji automation
17. **auto_dm_templates** - DM templates
18. **trigger_activation_logs** - Trigger tracking
19. **vip_notification_sequences** - VIP messaging
20. **vip_welcome_flows** - VIP onboarding
21. **notification_logs** - Notification tracking

## Implementation Files Created

### 1. Migration Script
**File**: `unit-talk-custom-bot/database/missing_tables_migration.sql`
- Complete SQL migration script for all 21 missing tables
- Includes proper indexes for performance
- Includes foreign key constraints where applicable
- Includes automatic timestamp update triggers

### 2. Complete TypeScript Types
**File**: `unit-talk-custom-bot/src/db/types/supabase-complete.ts`
- Complete TypeScript interface definitions
- Includes all existing tables from original schema
- Includes all 21 missing tables with proper typing
- Includes Row, Insert, and Update types for each table

## Recommended Actions

### Immediate (Today)
1. **Review and approve** the migration script
2. **Backup current database** before running migrations
3. **Run Phase 1 migrations** (user_profiles, game_threads, user_picks)
4. **Update imports** to use the complete types file

### This Week
1. **Run Phase 2 migrations** (thread_stats, thread_followers, user_cooldowns, pick_gradings)
2. **Test critical functionality** after each migration phase
3. **Monitor for any breaking changes** in existing code

### Next Week
1. **Complete remaining migrations** (Phases 3 and 4)
2. **Update all service files** to use proper typing
3. **Add proper error handling** for database operations
4. **Create database documentation** for future reference

## Risk Assessment

### High Risk
- **user_profiles table**: Critical for user management - test thoroughly
- **game_threads table**: Core functionality - ensure thread management works

### Medium Risk
- **user_picks table**: Important for pick tracking - verify grading system
- **Database constraints**: Foreign key relationships may need adjustment

### Low Risk
- **Notification and logging tables**: Non-critical functionality
- **Admin and monitoring tables**: Can be added incrementally

## Testing Strategy

### Pre-Migration Testing
1. **Export current data** from existing tables
2. **Test migration script** on development database
3. **Verify no data loss** during migration

### Post-Migration Testing
1. **Test user authentication** and profile management
2. **Test thread creation** and management
3. **Test pick submission** and grading
4. **Test admin dashboard** functionality
5. **Monitor application logs** for database errors

## Success Metrics

### Technical Metrics
- **Zero data loss** during migration
- **No breaking changes** to existing functionality
- **Improved type safety** with complete TypeScript definitions
- **Better performance** with proper indexing

### Functional Metrics
- **User management** works correctly
- **Thread system** operates normally
- **Pick tracking** functions properly
- **Admin features** remain accessible

## Conclusion

This analysis identified significant gaps between the database schema and codebase requirements. The provided migration script and TypeScript definitions will resolve these issues and provide a solid foundation for the application's database layer.

**Next Steps**: Review the migration script, test in development environment, and execute the phased migration plan.