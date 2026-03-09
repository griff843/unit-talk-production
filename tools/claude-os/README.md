# Claude OS — Runtime Execution Layer

> Phase B: Governed sprint planning and verification resolution tooling.

## Purpose

Reads governance design artifacts from `governance/claude-os/` and provides a
**fail-closed, dry-run capable** foundation for governed sprint execution. This
is a contract-driven planning layer — it does NOT perform autonomous file edits.

## What It Does

| Module                     | Responsibility                                                       |
| -------------------------- | -------------------------------------------------------------------- |
| `governance-loader.ts`     | Loads all governance artifacts (laws, contracts, recipes, ownership) |
| `context-loader.ts`        | Resolves context packs from the context manifest                     |
| `contract-parser.ts`       | Parses markdown contracts and extracts structure                     |
| `verification-resolver.ts` | Maps sprint types to verification tiers and requirements             |
| `artifact-planner.ts`      | Generates artifact path plans for proof bundles                      |
| `drift-sentinel.ts`        | Evaluates drift risk from deprecated paths, cross-boundary changes   |
| `sprint-planner.ts`        | Assembles full sprint execution plans                                |
| `cli.ts`                   | CLI entrypoint for dry-run planning and validation                   |
| `fs-utils.ts`              | Safe file I/O with fail-closed error handling                        |
| `types.ts`                 | All shared type definitions                                          |

## CLI Usage

### Plan a sprint (dry-run)

```bash
# Via pnpm script
pnpm --filter claude-os plan -- --sprint SPRINT-FEED-FIX-045 --type runtime \
  --summary "Fix FeedAgent promotion logic" --touched apps/api/src/agents/FeedAgent/

# Via tsx directly
npx tsx src/cli.ts plan --sprint SPRINT-DOCS-050 --type docs \
  --summary "Update architecture documentation"
```

### Validate governance artifacts

```bash
pnpm --filter claude-os validate
```

### Output formats

```bash
# Human-readable (default)
pnpm --filter claude-os plan -- --sprint SPRINT-X-001 --type runtime --summary "..."

# JSON output
pnpm --filter claude-os plan -- --sprint SPRINT-X-001 --type runtime --summary "..." --json

# Write to file
pnpm --filter claude-os plan -- --sprint SPRINT-X-001 --type runtime --summary "..." --json --out plan.json
```

## Verification Tiers

| Tier | Sprint Types    | Requirements                            |
| ---- | --------------- | --------------------------------------- |
| T1   | docs            | Typecheck                               |
| T2   | build_fix, ui   | Typecheck + build + lint                |
| T3   | runtime, schema | T2 + unit tests + runtime proof         |
| T4   | e2e_lifecycle   | T3 + integration + e2e + lifecycle gate |

## Fail-Closed Behavior

- Missing required governance files: plan status = `blocked`
- Unrecognized sprint type: plan status = `blocked`
- Invalid sprint ID format: plan status = `blocked`
- Missing required context sources: `failClosedReasons` populated

The system never silently falls back or produces optimistic output when
governance inputs are missing or invalid.

## Development

```bash
# Type check
pnpm --filter claude-os type-check

# Run tests
pnpm --filter claude-os test

# All tests should pass
# 46 tests across 5 test suites
```

## Architecture

```
tools/claude-os/
├── src/
│   ├── types.ts                  # All type definitions
│   ├── fs-utils.ts               # Safe file I/O
│   ├── governance-loader.ts      # Load governance artifacts
│   ├── context-loader.ts         # Resolve context packs
│   ├── contract-parser.ts        # Parse markdown contracts
│   ├── verification-resolver.ts  # Map types to verification requirements
│   ├── artifact-planner.ts       # Plan proof artifact paths
│   ├── drift-sentinel.ts         # Evaluate drift risk
│   ├── sprint-planner.ts         # Assemble execution plans
│   ├── cli.ts                    # CLI entrypoint
│   └── __tests__/                # Vitest test suites
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Phase C (Future)

Phase C will add:

- Sprint execution orchestration (with human ratification gates)
- Proof capture automation
- Closeout report generation
- Integration with Linear workflow tracking
