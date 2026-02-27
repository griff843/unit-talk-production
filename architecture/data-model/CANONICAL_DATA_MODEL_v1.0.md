# CANONICAL DATA MODEL

Version: 1.0  
Status: Draft

Defines authoritative ownership and database privilege enforcement.

---

## picks

Writer: Lifecycle Service ONLY  
DB Privilege: INSERT/UPDATE restricted to lifecycle service role

---

## pick_events

Writer: Lifecycle Service ONLY  
Append-only.

---

## settlements

Writer: Settlement Service ONLY  
Immutable after finalized_at.  
DB-level trigger enforces immutability.

---

## outbox

Writer: Canonical Services ONLY  
Processed by Outbox Worker (no canonical write privileges).
