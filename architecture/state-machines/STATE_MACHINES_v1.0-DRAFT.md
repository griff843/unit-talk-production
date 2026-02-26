# PICK LIFECYCLE STATE MACHINE

Draft → Submitted → Approved → Promoted → Posted → Settled → Archived

Rules:

- No stage may be skipped.
- Transitions idempotent.
- Transition logged.
- Replay must reproduce identical result.
