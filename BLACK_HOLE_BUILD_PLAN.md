# Black Hole Ingestion Engine - Build Plan

## Concept

Black Hole is Navigator's proprietary data ingestion technology. When a new client onboards, they don't start from scratch — they feed their entire support history into the Black Hole, and it absorbs everything: tickets, resolutions, knowledge, patterns, and context. Within minutes, Navigator knows their environment as if we've been working with them for years.

**Tagline**: "Zero data left behind. Full context from day one."

---

## How It Works

### The Three Phases

```
┌─────────────────────────────────────────────────────────┐
│                    BLACK HOLE ENGINE                      │
│                                                           │
│   PHASE 1: INGEST        PHASE 2: SORT         PHASE 3:  │
│   ──────────────        ──────────────        DISTRIBUTE  │
│                                               ──────────  │
│   ┌─────────┐         ┌──────────┐         ┌──────────┐ │
│   │  Upload  │         │ Claude   │         │ Tickets  │ │
│   │  Source  │────────▶│ Analyzes │────────▶│ Created  │ │
│   │  Data    │         │ & Sorts  │         │          │ │
│   └─────────┘         └──────────┘         └──────────┘ │
│                                                           │
│   Formats:             For each item:       Destinations: │
│   • Jira JSON/CSV      • SEA category       • Tickets    │
│   • Zendesk export     • Priority            • Notes     │
│   • ServiceNow         • CapEx/OpEx          • KB Articles│
│   • Freshdesk          • Platform tags       • Time Data │
│   • Salesforce         • Complexity est.     • RuVector  │
│   • Generic CSV        • KB candidate?       • Memories  │
│   • JSON               • ROI potential       • Analytics │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: INGEST — Getting the Data In

### Supported Source Platforms

| Platform | Import Method | Data Available |
|----------|--------------|---------------|
| **Jira** | JSON export, CSV export, REST API | Tickets, comments, time logs, attachments, sprints, labels |
| **Zendesk** | JSON export, CSV export | Tickets, comments, satisfaction ratings, tags, custom fields |
| **ServiceNow** | JSON export, CSV export | Incidents, requests, changes, problems, knowledge articles |
| **Freshdesk** | JSON export, CSV export | Tickets, conversations, satisfaction, time entries |
| **Salesforce Service Cloud** | CSV export | Cases, case comments, solutions, knowledge articles |
| **Generic CSV** | Upload with field mapping | Any tabular ticket data |
| **Generic JSON** | Upload with schema detection | Any structured ticket data |

### Upload Flow

1. **Admin selects source platform** in the Black Hole UI
2. **Platform-specific instructions** appear (how to export from Jira, Zendesk, etc.)
3. **Admin uploads file(s)** — drag-and-drop or file picker
4. **Parser validates format** — confirms it can read the data
5. **Preview shows first 5-10 items** — admin confirms the data looks right
6. **Field mapping** (for CSV/generic) — map source columns to Navigator fields

### Data Normalization

Every source format gets normalized to a universal `SourceItem`:

```python
@dataclass
class SourceItem:
    # Identity
    source_id: str              # Original ID (JIRA-123, #45678)
    source_platform: str        # Where it came from

    # Core fields
    title: str
    description: str
    status: str                 # Raw status from source
    priority: str               # Raw priority from source
    item_type: str              # Bug, Feature, Task, Incident, etc.

    # People
    reporter: SourcePerson      # Who created it
    assignee: SourcePerson | None  # Who handled it

    # Timeline
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None

    # Content
    comments: list[SourceComment]
    attachments: list[SourceAttachment]

    # Metadata
    labels: list[str]
    custom_fields: dict[str, Any]
    time_logged_hours: float
    satisfaction_rating: float | None

    # Raw data preserved
    raw_data: dict
```

---

## Phase 2: SORT — AI-Powered Classification

This is where the magic happens. Claude analyzes every item and classifies it for Navigator.

### Classification Pipeline

For each `SourceItem`, Claude determines:

```
┌──────────────────────────────────────────────────────┐
│               CLASSIFICATION ENGINE                   │
│                                                       │
│  Input: Raw ticket from Jira/Zendesk/etc.            │
│                                                       │
│  Claude Haiku analyzes and outputs:                  │
│                                                       │
│  1. SEA Category                                     │
│     ├── Support (bug fix, incident, break/fix)       │
│     ├── Enhance (new feature, improvement, config)   │
│     └── Advise  (review, consult, training, audit)   │
│                                                       │
│  2. Priority Mapping                                 │
│     ├── Source "Critical/P1" → Navigator "urgent"    │
│     ├── Source "High/P2"     → Navigator "high"      │
│     ├── Source "Medium/P3"   → Navigator "medium"    │
│     └── Source "Low/P4"      → Navigator "low"       │
│                                                       │
│  3. CapEx vs OpEx                                    │
│     ├── CapEx: New builds, enhancements, migrations  │
│     └── OpEx:  Bug fixes, maintenance, support       │
│                                                       │
│  4. Platform Tags                                    │
│     ├── AEM, Analytics, Target, AEP, RTCDP          │
│     ├── SFMC, Salesforce CRM, Marketo               │
│     └── Workfront, Commerce, GenStudio               │
│                                                       │
│  5. Complexity Estimate (hours)                      │
│     └── Based on description, comments, time logged  │
│                                                       │
│  6. Knowledge Base Candidate?                        │
│     ├── YES: Resolved ticket with clear resolution   │
│     └── NO:  Incomplete, duplicate, or trivial       │
│                                                       │
│  7. ROI Category                                     │
│     ├── Revenue impact                               │
│     ├── Agency cost avoidance                        │
│     ├── FTE cost avoidance                           │
│     ├── Speed to market                              │
│     ├── Downtime prevention                          │
│     └── Data quality                                 │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Batch Processing Strategy

- Process items in batches of 10 (Claude Haiku for speed)
- ~50 items/minute throughput
- Progress bar updates in real-time via WebSocket
- Each classification costs ~$0.001 (Haiku pricing)
- 1,000 tickets = ~$1.00 and ~20 minutes

### Duplicate Detection

Before importing, RuVector checks for:
- Exact title matches → skip
- Semantic similarity > 0.95 → flag as potential duplicate
- Same source_id already imported → skip
- Admin can review flagged duplicates before proceeding

### Smart Status Mapping

| Source Status | Navigator Status | Notes |
|--------------|-----------------|-------|
| Open, New, Created | `new` | Fresh tickets |
| In Progress, Active, Working | `in_progress` | Currently being worked |
| Pending, Waiting, On Hold | `review` | Waiting for input |
| Resolved, Closed, Done | `complete` | Historical record |
| Won't Fix, Cancelled | `complete` | Imported as closed |

---

## Phase 3: DISTRIBUTE — Getting Data to the Right Place

After classification, each item gets routed to its destination(s):

### Routing Rules

```
┌─────────────────────────────────────────────────────────┐
│                    DISTRIBUTION ENGINE                    │
│                                                           │
│  Classified Item                                         │
│       │                                                   │
│       ├──▶ TICKETS TABLE                                 │
│       │    Every item becomes a Navigator ticket          │
│       │    with proper SEA category, priority, status     │
│       │    Source ID preserved in metadata.source_ref     │
│       │                                                   │
│       ├──▶ TICKET NOTES                                  │
│       │    Source comments → external notes               │
│       │    Internal notes from agents → internal notes    │
│       │                                                   │
│       ├──▶ TIME ENTRIES (if time data exists)            │
│       │    Source time logs → time entries                │
│       │    Feeds into time_patterns namespace             │
│       │                                                   │
│       ├──▶ KNOWLEDGE BASE (if KB candidate)              │
│       │    Claude generates article from resolution       │
│       │    Title: problem summary                         │
│       │    Content: solution/resolution steps             │
│       │    Source: "ingestion"                            │
│       │    Indexed in RuVector knowledge namespace        │
│       │                                                   │
│       ├──▶ RUVECTOR (all items)                          │
│       │    tickets namespace: ticket embeddings           │
│       │    time_patterns: hours per ticket type           │
│       │    roi_patterns: value per category               │
│       │    assignment_patterns: skill requirements        │
│       │    knowledge: KB articles + resolutions           │
│       │                                                   │
│       └──▶ NAVI MEMORIES                                 │
│            Key facts about the client's environment       │
│            Platform architecture notes                    │
│            Known issues and workarounds                   │
│            Team preferences and processes                 │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Knowledge Base Generation

For resolved tickets with clear resolutions, Claude generates KB articles:

**Input**: Ticket title + description + resolution comments
**Output**:
```markdown
## [Problem Title]

### Problem
[What went wrong, symptoms, affected areas]

### Root Cause
[Why it happened]

### Solution
[Step-by-step resolution]

### Prevention
[How to avoid this in the future]

### Affected Platform
[AEM / Analytics / SFMC / etc.]
```

### RuVector Learning

After all items are imported, the Black Hole feeds patterns into RuVector:

| Namespace | What It Learns | Why It Matters |
|-----------|---------------|---------------|
| `tickets` | Embeddings of all imported tickets | Similar ticket detection, search |
| `time_patterns` | Hours logged per ticket type/complexity | More accurate time estimates for new tickets |
| `roi_patterns` | Value delivered per ticket category | Better ROI projections from day one |
| `assignment_patterns` | Which skills were needed per ticket type | Smarter navigator assignment suggestions |
| `knowledge` | All generated KB articles | Ask Navi can answer questions about historical issues |
| `memories` | Client environment facts, preferences, known issues | Navi has context about the client immediately |

### Post-Import Summary

After the Black Hole finishes, it generates a comprehensive summary:

```
┌─────────────────────────────────────────────┐
│     BLACK HOLE INGESTION COMPLETE            │
│     AAA Northeast — Jira Import              │
├─────────────────────────────────────────────┤
│                                              │
│  INGESTED                                    │
│  ├── 342 tickets imported                    │
│  │   ├── 156 Support (45.6%)                │
│  │   ├── 128 Enhance (37.4%)                │
│  │   └──  58 Advise  (17.0%)                │
│  │                                           │
│  ├── 1,247 comments → ticket notes           │
│  ├── 89 resolved tickets → KB articles       │
│  └── 423 hours of time data imported         │
│                                              │
│  LEARNED                                     │
│  ├── Avg ticket resolution: 4.2 hours        │
│  ├── Most common platform: AEM (67%)         │
│  ├── Peak ticket days: Monday, Wednesday     │
│  ├── Top issue: Publishing errors (23 tickets)│
│  └── Client prefers staging→prod deployment  │
│                                              │
│  ESTIMATED HISTORICAL ROI                    │
│  └── $284,500 (based on 342 tickets)        │
│                                              │
│  RECOMMENDATIONS                             │
│  ├── Assign AEM specialist (67% of work)     │
│  ├── Schedule proactive AEM audit            │
│  ├── Set up monitoring for pub errors        │
│  └── Consider 40hr plan (avg 38hr/month)     │
│                                              │
└─────────────────────────────────────────────┘
```

---

## User Experience

### Admin Flow

1. **Navigate to Admin → Black Hole**
2. **Select "New Ingestion"**
3. **Choose source platform** (Jira, Zendesk, etc.)
4. **See platform-specific export instructions** (e.g., "In Jira, go to Filters → Export → JSON")
5. **Upload the export file** (drag & drop)
6. **Preview imported data** — see first 10 items with proposed classifications
7. **Adjust if needed** — override any classifications
8. **Click "Activate Black Hole"** — starts processing
9. **Watch real-time progress**:
   ```
   ⬤ Parsing data...          ████████████████████ 100%
   ⬤ Classifying tickets...   ████████████░░░░░░░░  62%
   ⬤ Importing tickets...     ░░░░░░░░░░░░░░░░░░░░   0%
   ⬤ Generating knowledge...  ░░░░░░░░░░░░░░░░░░░░   0%
   ⬤ Teaching RuVector...     ░░░░░░░░░░░░░░░░░░░░   0%
   ```
10. **Review summary** — see what was imported, what was learned
11. **Customer immediately has full history** in their portal

### Customer Experience

After Black Hole runs, the customer logs into the portal and sees:
- All their historical tickets (properly categorized)
- A knowledge base pre-populated with solutions from past issues
- Ask Navi already knows about their environment
- ROI calculations include historical value
- Hour estimates are calibrated from real data

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/ingestion/jobs` | Create new ingestion job |
| `GET` | `/ingestion/jobs` | List jobs for an org |
| `GET` | `/ingestion/jobs/{id}` | Get job status + progress |
| `POST` | `/ingestion/jobs/{id}/upload` | Upload source data file |
| `POST` | `/ingestion/jobs/{id}/start` | Begin processing |
| `GET` | `/ingestion/jobs/{id}/preview` | Preview first items (dry run) |
| `GET` | `/ingestion/jobs/{id}/summary` | Post-import summary |
| `GET` | `/ingestion/jobs/{id}/mappings` | See individual item mappings |
| `DELETE` | `/ingestion/jobs/{id}` | Cancel/delete job |

---

## Platform-Specific Parsers

### Jira
```
Fields mapped:
  summary         → title
  description     → description
  issuetype.name  → item_type (Bug→support, Story→enhance, Task→advise)
  priority.name   → priority
  status.name     → status
  reporter        → reporter
  assignee        → assignee
  created         → created_at
  resolutiondate  → resolved_at
  comment.comments → comments
  worklog.worklogs → time_entries
  labels          → labels
  customfield_*   → custom_fields
```

### Zendesk
```
Fields mapped:
  subject         → title
  description     → description
  type            → item_type
  priority        → priority
  status          → status
  requester       → reporter
  assignee        → assignee
  created_at      → created_at
  solved_at       → resolved_at
  comments        → comments
  tags            → labels
  satisfaction    → satisfaction_rating
```

### ServiceNow
```
Fields mapped:
  short_description → title
  description       → description
  category          → item_type
  priority          → priority
  state             → status
  opened_by         → reporter
  assigned_to       → assignee
  opened_at         → created_at
  resolved_at       → resolved_at
  work_notes        → comments (internal)
  comments          → comments (external)
```

### CSV (Generic)
```
Admin maps columns via UI:
  Column A → title
  Column B → description
  Column C → status
  Column D → priority
  ...etc
```

---

## Cost Estimates

| Volume | Classification Cost | Processing Time | KB Articles Generated |
|--------|-------------------|-----------------|----------------------|
| 100 tickets | ~$0.10 | ~2 minutes | ~15-30 |
| 500 tickets | ~$0.50 | ~10 minutes | ~75-150 |
| 1,000 tickets | ~$1.00 | ~20 minutes | ~150-300 |
| 5,000 tickets | ~$5.00 | ~90 minutes | ~750-1,500 |

---

## Security Considerations

- Uploaded files are scanned for malware indicators
- File size limit: 100MB per upload
- Data is processed in the client's organization scope only
- Source data can be purged after import (option in UI)
- All imports are audit-logged
- PII detection via Claude (flags but doesn't block)
- Admin can review and delete individual imported items

---

## Future Enhancements

- **Live API connectors** — Connect directly to Jira/Zendesk APIs instead of file upload
- **Incremental sync** — Periodically pull new tickets from source (migration period)
- **Reverse export** — Export Navigator data back to standard formats
- **Multi-source merge** — Combine data from multiple platforms in one job
- **Deduplication across sources** — Smart matching when importing from multiple systems
