# REPO BOUNDARIES

Defines ownership per service.

Lifecycle Service:

- Owns canonical lifecycle tables.

Settlement Service:

- Owns settlement writes.

Feed Agent:

- Writes proposals only.

Scoring Agent:

- Writes evaluation only.

Alert Agent:

- Reads canonical state only.
- Emits outbox only.

Outbox Worker:

- Dispatch only.
- No canonical mutation.

Temporal:

- Orchestration only.
- Never source of truth.
