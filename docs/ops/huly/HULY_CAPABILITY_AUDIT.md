# Huly Capability Audit

**Instance:** http://localhost:8087 (self-hosted, Docker Compose) **Workspace:**
`unit-talk` (ID: `61b570c5-eee6-458c-9458-72108b5f2dff`) **Audit Date:**
2026-03-03 **Method:** Live API probe via `huly-audit-probe.ts` against
`/_transactor/api/v1/` and `/_accounts/`

---

## 1. Tracker (Issue Management)

### Projects (3 found)

| ID                               | Identifier | Name                  | Default Status           |
| -------------------------------- | ---------- | --------------------- | ------------------------ |
| `69a6e427972d134b5e8c152b`       | GAME       | Game Design (Example) | `tracker:status:Backlog` |
| `project-1772590741040-fmqcuy`   | UT         | Truth & Automation    | `tracker:status:Todo`    |
| `tracker:project:DefaultProject` | HULY       | Welcome to Huly!      | (not set)                |

### Issue Statuses (5 statuses in `tracker:class:IssueStatus`)

| Status ID                   | Name        | Category                        | Meaning     |
| --------------------------- | ----------- | ------------------------------- | ----------- |
| `tracker:status:Backlog`    | Backlog     | `task:statusCategory:UnStarted` | Not started |
| `tracker:status:Todo`       | Todo        | `task:statusCategory:ToDo`      | Queued      |
| `tracker:status:InProgress` | In Progress | `task:statusCategory:Active`    | Active work |
| `tracker:status:Done`       | Done        | `task:statusCategory:Won`       | Complete    |
| `tracker:status:Canceled`   | Canceled    | `task:statusCategory:Lost`      | Cancelled   |

### Status Categories (5 in `core:class:StatusCategory`)

| Category ID                     | Default Name | Order |
| ------------------------------- | ------------ | ----- |
| `task:statusCategory:UnStarted` | Backlog      | 0     |
| `task:statusCategory:ToDo`      | Todo         | 1     |
| `task:statusCategory:Active`    | New state    | 2     |
| `task:statusCategory:Won`       | Won          | 3     |
| `task:statusCategory:Lost`      | Lost         | 4     |

### Issue Fields (confirmed from live data)

| Field               | Type       | Notes                                                                                      |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `_id`               | string     | Unique object ID                                                                           |
| `identifier`        | string     | Human-readable (e.g., `UT-1`). **Note:** only present if project has `sequence` configured |
| `title`             | string     | Issue title                                                                                |
| `description`       | string     | Markdown body                                                                              |
| `status`            | string ref | Points to `tracker:class:IssueStatus._id`                                                  |
| `priority`          | number     | 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low                                           |
| `assignee`          | string ref | Points to person/member ID                                                                 |
| `space`             | string     | Project ID this issue belongs to                                                           |
| `modifiedBy`        | string     | SocialID of last modifier                                                                  |
| `modifiedOn`        | number     | Epoch ms of last modification                                                              |
| `createdBy`         | string     | SocialID of creator                                                                        |
| `createdOn`         | number     | Epoch ms of creation                                                                       |
| `docUpdateMessages` | number     | Count of activity updates                                                                  |
| `relations`         | array      | **Not confirmed** — passed in createIssue but not visible in returned data                 |

### Features NOT Present in This Instance

| Feature          | Class Probed                    | Count | Status                                                         |
| ---------------- | ------------------------------- | ----- | -------------------------------------------------------------- |
| Issue Templates  | `tracker:class:IssueTemplate`   | 0     | **Not configured**                                             |
| Issue Categories | `tracker:class:IssueCategory`   | 0     | **Not configured**                                             |
| Components       | `tracker:class:Component`       | 0     | **Not configured**                                             |
| Milestones       | `tracker:class:Milestone`       | 0     | **Not configured**                                             |
| Sprints (native) | `tracker:class:Sprint`          | 0     | **Not available** — Huly may not expose native sprints via API |
| Time Tracking    | `tracker:class:TimeSpentReport` | 0     | **Not configured**                                             |
| Issue Relations  | `tracker:class:IssueRelation`   | 0     | **Not configured**                                             |
| Related Issues   | `tracker:class:RelatedIssue`    | 0     | **Not configured**                                             |

---

## 2. Documents

### Document Spaces (confirmed)

| ID                                  | Name               | Type                            |
| ----------------------------------- | ------------------ | ------------------------------- |
| `69a6e42a972d134b5e8c15e6`          | Quick-Start Docs   | `document:class:Teamspace`      |
| `documents:space:QualityDocuments`  | Quality documents  | `documents:class:OrgSpace`      |
| `documents:space:UnsortedTemplates` | Unsorted templates | `documents:class:DocumentSpace` |

### Document Classes

| Class                      | Count | Notes                      |
| -------------------------- | ----- | -------------------------- |
| `document:class:Document`  | 3     | Found via find-all         |
| `documents:class:Document` | 1     | Alternative class path     |
| `document:class:Teamspace` | 1     | Quick-Start Docs teamspace |

### Document Fields

| Field                                                       | Type                  |
| ----------------------------------------------------------- | --------------------- |
| `title`                                                     | string                |
| `content`                                                   | string (markdown)     |
| `space`                                                     | string (teamspace ID) |
| `_id`, `modifiedBy`, `modifiedOn`, `createdBy`, `createdOn` | standard envelope     |

### Document Operations (via TX API)

- **Create:** `TxCreateDoc` with `objectClass: 'document:class:Document'`
- **Update:** `TxUpdateDoc` with `operations: { content: '...' }`
- **Search:** `/_transactor/api/v1/search-fulltext/{ws}?query=...&classes=[...]`

---

## 3. Chat / Comments (Chunter)

| Class                            | Count | Notes                                    |
| -------------------------------- | ----- | ---------------------------------------- |
| `chunter:class:Channel`          | 2     | `#general`, `#random`                    |
| `chunter:class:ChatMessage`      | 0     | No messages via find-all (may be scoped) |
| `chunter:class:ThreadMessage`    | 0     | Not found                                |
| `chunter:class:DirectMessage`    | 0     | Not found                                |
| `activity:class:ActivityMessage` | 98    | System activity log entries              |

### Comment Capability

Comments on issues use `chunter:class:ChatMessage` with `objectSpace` set to the
issue ID. Creation confirmed working via `huly-ops.ts` purge flow.

---

## 4. Tags / Labels

| Class                      | Count | Notes                                |
| -------------------------- | ----- | ------------------------------------ |
| `tags:class:TagElement`    | 2     | Two tag elements exist in the system |
| `tags:class:TagReference`  | 0     | No tag assignments                   |
| `tag:class:Tag`            | 0     | Not found                            |
| `label:class:ProjectLabel` | 0     | **Not configured**                   |

**Finding:** Tags exist as a concept (`tags:class:TagElement`) but are not
actively used. Project-level labels (`label:class:ProjectLabel`) are not
configured. Labeling issues via API would require creating `TagElement` objects
and `TagReference` assignments — **not confirmed working via TX API**.

---

## 5. RBAC / Permissions

### Roles (10 found in `core:class:Role`)

| Role ID                        | Name           | Scope               |
| ------------------------------ | -------------- | ------------------- |
| `core:role:Admin`              | Admin          | SpacesType (global) |
| `documents:role:QualifiedUser` | Qualified User | DocumentSpaceType   |
| `documents:role:Manager`       | Manager        | DocumentSpaceType   |
| `documents:role:QARA`          | QARA           | DocumentSpaceType   |
| `training:role:QARA`           | QARA           | Training            |

### Permissions (48 found in `core:class:Permission`)

Key permissions:

- `core:permission:CreateObject` — Create objects in space
- `core:permission:UpdateObject` — Update objects
- `core:permission:DeleteObject` — Delete objects
- `core:permission:ForbidDeleteObject` — Forbid deletion (deny override)
- `core:permission:UpdateSpace` — Modify space settings
- `documents:permission:ReviewDocument` — Review documents
- `documents:permission:ApproveDocument` — Approve documents
- `documents:permission:ArchiveDocument` — Archive documents
- `training:permission:CreateTraining` — Create training items

**Finding:** RBAC is model-level (defined at schema/system level). Space
membership controls access. No custom role creation confirmed via API.

---

## 6. HR / Training

| Class                            | Count | Notes                     |
| -------------------------------- | ----- | ------------------------- |
| `hr:class:Department`            | 1     | Default department exists |
| `hr:class:Employee`              | 0     | No employees configured   |
| `training:class:Training`        | 0     | No trainings configured   |
| `training:class:TrainingAttempt` | 0     | No attempts               |

**Finding:** HR and Training modules are installed but not configured. Could be
used for operational runbooks or onboarding if needed.

---

## 7. Board (Kanban)

| Class               | Count | Notes                |
| ------------------- | ----- | -------------------- |
| `board:class:Board` | 1     | Default board exists |
| `board:class:Card`  | 0     | No cards             |

**Finding:** Kanban board is available but unused.

---

## 8. Lead / CRM

| Class               | Count       |
| ------------------- | ----------- |
| `lead:class:Lead`   | 0           |
| `lead:class:Funnel` | 1 (default) |

**Finding:** CRM module installed but unused.

---

## 9. Automation / Webhooks / Integrations

| Class                                | Count | Notes                         |
| ------------------------------------ | ----- | ----------------------------- |
| `automation:class:Automation`        | 0     | **No automations configured** |
| `automation:class:AutomationTrigger` | 0     | **No triggers**               |
| `webhook:class:Webhook`              | 0     | **No webhooks configured**    |
| `integration:class:Integration`      | 0     | **No integrations**           |
| `process:class:Process`              | 0     | **No processes**              |
| `process:class:ProcessStep`          | 0     | **No process steps**          |

### Webhook Endpoint Probe Results

| Path                           | HTTP Status | Content-Type | Finding                                  |
| ------------------------------ | ----------- | ------------ | ---------------------------------------- |
| `/_api/webhooks`               | 200         | text/html    | Returns HTML (frontend app, not API)     |
| `/api/webhooks`                | 200         | text/html    | Same — frontend catch-all                |
| `/_transactor/api/v1/webhooks` | 404         | text/html    | **Not found** — no webhook REST endpoint |

**Conclusion:** Huly self-hosted v0.7 does NOT expose a webhook API endpoint. No
outbound webhooks, no inbound webhook receivers. All integration must be
pull-based or through the TX API.

### Account RPC Methods Probe

| Method           | Result          |
| ---------------- | --------------- |
| `getWorkspaces`  | `UnknownMethod` |
| `getUserInfo`    | `UnknownMethod` |
| `getMembers`     | `UnknownMethod` |
| `getPermissions` | `UnknownMethod` |
| `getRoles`       | `UnknownMethod` |

**Conclusion:** Account service has limited RPC methods. Only `login` and
`selectWorkspace` are confirmed working.

---

## 10. API Surface Summary

### Confirmed Working Endpoints

| Endpoint                                   | Method | Purpose                               |
| ------------------------------------------ | ------ | ------------------------------------- |
| `/_accounts/`                              | POST   | JSON-RPC: `login`, `selectWorkspace`  |
| `/_transactor/api/v1/find-all/{ws}`        | GET    | Query objects by class                |
| `/_transactor/api/v1/search-fulltext/{ws}` | GET    | Fulltext search                       |
| `/_transactor/api/v1/tx/{ws}`              | POST   | Create/Update objects via TX envelope |

### TX Envelope Format

```json
{
  "_id": "tx-{timestamp}-{random}",
  "space": "core:space:Tx",
  "modifiedBy": "{socialId}",
  "modifiedOn": 1772590741040,
  "_class": "core:class:TxCreateDoc | core:class:TxUpdateDoc",
  "objectId": "{target-object-id}",
  "objectClass": "{target-class}",
  "objectSpace": "{target-space}",
  "attributes": {}
}
```

### Confirmed TX Operations

| Operation                  | TX Class      | Object Class                | Confirmed          |
| -------------------------- | ------------- | --------------------------- | ------------------ |
| Create Issue               | `TxCreateDoc` | `tracker:class:Issue`       | Yes                |
| Update Issue (description) | `TxUpdateDoc` | `tracker:class:Issue`       | Yes                |
| Update Issue (status)      | `TxUpdateDoc` | `tracker:class:Issue`       | Yes (via huly-ops) |
| Create Comment             | `TxCreateDoc` | `chunter:class:ChatMessage` | Yes                |
| Create Document            | `TxCreateDoc` | `document:class:Document`   | Yes                |
| Update Document            | `TxUpdateDoc` | `document:class:Document`   | Yes                |
| Create Project             | `TxCreateDoc` | `tracker:class:Project`     | Yes (via huly-ops) |

### NOT Confirmed / Not Available

| Operation                   | Notes                                                             |
| --------------------------- | ----------------------------------------------------------------- |
| Delete Issue                | `TxRemoveDoc` exists in permission model but not tested           |
| Assign Labels/Tags          | `tags:class:TagElement` exists but assignment not tested          |
| Create Sprint (native)      | `tracker:class:Sprint` returned 0 items; may not be API-creatable |
| Create Milestone            | Returned 0 items                                                  |
| Create Relations            | Passed in attributes but not visible in returned data             |
| Webhooks (inbound/outbound) | Not available in this version                                     |
| Automations                 | Module exists but no API for creating them                        |
| Bulk Operations             | No batch TX endpoint; must send individual TXs                    |

---

## 11. Other Modules Present

| Module               | Status                       | Notes                                                    |
| -------------------- | ---------------------------- | -------------------------------------------------------- |
| Drive (file storage) | 2 drives exist               | Records, Screen Recordings                               |
| Calendar             | Space exists                 | No events                                                |
| Survey               | Space exists                 | No surveys                                               |
| Templates            | 1 category                   | Public templates                                         |
| Cards                | 1 space (Default)            | Types: File, Document, UserProfile, Thread, Direct, Poll |
| Notification         | Provider/settings returned 0 | May be system-managed                                    |

---

## 12. Limitations Summary

1. **No webhook support** — all integration is push (TX API) or pull
   (find-all/search)
2. **No native sprints via API** — must use issues with `[SPRINT]` prefix
   convention
3. **No native epics via API** — must use issues with `[EPIC]` prefix convention
4. **No bulk operations** — one TX per request
5. **No automation engine accessible via API** — automations exist in schema but
   can only be configured via UI
6. **Limited account RPC** — only `login` and `selectWorkspace` confirmed
7. **No custom fields API** — custom field creation/management not available
8. **Tag/label assignment not confirmed** — tag elements exist but assignment
   mechanism unclear
9. **No issue relation assignment confirmed** — relations field accepted in TX
   but not visible in queries
10. **Identifier (UT-1, UT-2) auto-numbering** — requires project `sequence`
    counter; our UT project created via API may not have proper sequence
    initialization
