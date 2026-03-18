# Codex Trigger Layer — Claude OS Integration

**Updated**: 2026-03-18

---

## How to Invoke

```bash
# By workflow moment (recommended)
bash scripts/codex/run-trigger.sh diagnosis-start
bash scripts/codex/run-trigger.sh visibility-check
bash scripts/codex/run-trigger.sh implementation-start

# List all registered triggers
bash scripts/codex/run-trigger.sh --list
```

---

## Where Claude OS Should Call Triggers

| Sprint Phase       | Workflow Moment              | When to Use                                      |
| ------------------ | ---------------------------- | ------------------------------------------------ |
| Phase 0: Context   | `diagnosis-start`            | Error picture unclear; need structured repo scan |
| Phase 2: Implement | `implementation-start`       | Mechanical fix with exact spec; not architecture |
| Phase 3: Verify    | `visibility-check`           | Confirm Discord publish chain is wired correctly |
| Phase 3: Verify    | `post-implementation-verify` | Post-change confidence check                     |
| Phase 4: Closeout  | `sprint-closeout-support`    | Final scan before proof bundle                   |

---

## What Remains Manual

- **Sprint planning**: Claude only. Codex never decides what to build next.
- **Architecture decisions**: Claude only. Codex never shapes system design.
- **Status doc updates**: Claude only. Codex never writes to `docs/status/`.
- **Git operations**: Human only. Codex never commits, merges, or pushes.
- **Trigger registration**: Human edits `trigger-registry.sh` to add new
  moments. No self-modifying trigger chains.

---

## How Not to Overuse Triggers

1. **Do not create triggers for every possible step.** Only trigger when the
   task is clearly bounded and the Codex agent genuinely saves time.
2. **Do not chain triggers.** A trigger should complete and return. No trigger
   should invoke another trigger.
3. **Do not replace Claude with Codex for ambiguous work.** If the task requires
   reading context and making a judgment call, it belongs to Claude.
4. **Do not auto-trigger write agents.** The trigger-registry safety check
   blocks this even if you try to register it.

---

## Adding a New Trigger

1. Create a task file in `sprint_tasks/codex/` using `_TEMPLATE.md`
2. Add a `register` call in `scripts/codex/trigger-registry.sh`
3. Test: `bash scripts/codex/run-trigger.sh <new-moment>`
4. If write-capable: type must be `manual-confirm`; safety check enforces this
