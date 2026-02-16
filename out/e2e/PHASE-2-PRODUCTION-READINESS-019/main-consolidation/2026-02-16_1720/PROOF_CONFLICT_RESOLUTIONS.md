# PROOF_CONFLICT_RESOLUTIONS.md
Generated: 2026-02-16

## Summary
Merged `origin/feat/posting-authority-implement-001` into `chore/main-consolidation-2026-02-16`

### Conflict 1: apps/api/Dockerfile
**Type**: Content conflict
**Resolution**: Combined both - kept main's descriptive comment + posting-authority's config note
**Before (HEAD)**:
```
# Copy source code and configs (config provided via env vars)
```
**Before (theirs)**:
```
# Config is mounted at runtime via docker-compose volumes or lives in build context
# Skip explicit COPY for config — handled by compose volume mounts
# Copy source code and configs
```
**After**:
```
# Config is mounted at runtime via docker-compose volumes or provided via env vars
# Copy source code and configs
```

### Conflict 2: apps/api/src/agents/DiscordPromotionAgent/index.ts
**Type**: Major divergence - extensive rewrite
**Resolution**: Accepted posting-authority version (theirs)
**Rationale**: 
- posting-authority has comprehensive POSTING-AUTHORITY-001 implementation
- PARLAY-DISCORD-GROUPING-001 for parlay handling
- PickPresentation standard for consistent embed formatting
- Claim-first idempotency pattern
- Message ID persistence for Discord receipts
- Main's version was simpler and less evolved

### Conflict 3: apps/command-center/Dockerfile (2 locations)
**Type**: Comment differences
**Resolution**: Kept main's descriptive comments
**Changes**: Updated "Copy source code" → "Copy source code (config provided via env vars)"

### Conflict 4: apps/smart-form/app/api/submit-ticket/route.ts
**Type**: Feature divergence
**Resolution**: Combined both features
**Kept from main**:
- SMARTFORM-ODDS-FIELD-INTEGRITY-007 enhanced odds validation
- `validateOddsForSchema()` function with contract-compliant error codes
- Zod refinement for leg_odds with detailed error messages
**Kept from posting-authority**:
- ACTIVATION-P1-FIXES-001 extended sports list (14 sports)
- Optional line field with default 0 for moneyline bets
- POSTING-AUTHORITY-001 origin tagging in meta

### Conflict 5: apps/smart-form/app/submit-ticket/components/Step4GameSelection.tsx
**Type**: Modify/delete
**Resolution**: Accepted deletion (posting-authority)
**Rationale**: Smart Form UX overhaul restructured the form components. Step4 was removed as part of the consolidated SmartTicketForm.tsx design.

## Post-Merge Verification
After merge completion:
- [ ] TypeScript check passes for api
- [ ] Docker build succeeds
- [ ] Runtime gauntlet passes
