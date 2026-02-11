# 🔍 Maintenance System Analysis

## Current State Discovery

### ✅ Backend Has TWO Systems:

#### 1. **Old System** (Basic CRUD)

- **Routes:** `/api/maintenance`
- **Features:**
  - Basic create/read/update/delete
  - Simple status tracking
  - Manual reminders
  - No auto-renew

#### 2. **New System** (Enterprise Automation) ✨

- **Routes:** `/api/maintenanceOps`
- **Features:**
  - ✅ **Auto-renew logic** (Daily/Weekly/Monthly)
  - ✅ **Automated reminders** (SMS placeholder)
  - ✅ **Overdue detection** (automatic status updates)
  - ✅ **Task states** (Active/Incomplete/Overdue/Complete)
  - ✅ **History tracking** (full timeline)
  - ✅ **Checklist progress** (per-engineer assignments)
  - ✅ **Auto-scheduler** (runs hourly)

### ⚠️ Frontend Currently Uses:

- **Old System** (`/api/maintenance`)
- Missing all the automation features!

---

## 🎯 What Needs to Happen

To get the **REAL maintenance automation system** the user requested, the frontend needs to:

### Phase 1: Migrate to New API

1. ✅ Replace `/api/maintenance` with `/api/maintenanceOps`
2. ✅ Use new data structures (runs, schedules, types)
3. ✅ Implement checklist UI
4. ✅ Show auto-renew indicators

### Phase 2: Enhanced UI

1. ✅ Display overdue status prominently
2. ✅ Show next scheduled run
3. ✅ Enhance History dialog with full timeline
4. ✅ Add reminder status indicators
5. ✅ Show engineer task assignments
6. ✅ Display checklist progress

### Phase 3: Professional UX

1. ✅ Auto-refresh after completion
2. ✅ Highlight overdue in red
3. ✅ Show only active tasks in main list
4. ✅ Completed tasks in history tab
5. ✅ Professional status badges

---

## 📊 New System Architecture

### Database Tables (Already Exist):

- `maintenance_types` - Maintenance type templates
- `maintenance_type_checklist_items` - Template checklists
- `maintenance_schedules` - Recurring schedules
- `maintenance_runs` - Individual task instances
- `maintenance_run_engineers` - Engineer assignments
- `maintenance_run_checklist_progress` - Task completion
- `maintenance_run_checklist_assignments` - Per-engineer tasks
- `maintenance_run_notifications` - Reminder tracking

### Key Concepts:

```
SCHEDULE (Recurring)
  ↓
  Creates →  RUN (Single Instance)
              ↓
              When Complete → Auto-creates NEXT RUN
```

**Example:**

- Schedule: Daily backup check for SRV-001
- Run #1: Due 2026-01-29 → Completed → Auto-creates Run #2
- Run #2: Due 2026-01-30 → Active
- History shows: Run #1, Run #2, Run #3...

---

## 🚀 Implementation Plan

### Step 1: Update Frontend API Layer

- Replace maintenance API calls with maintenanceOps
- Update types to match new system
- Handle schedules vs runs

### Step 2: Redesign Main Page

- **Active Tab:** Show open runs only
- **Completed Tab:** Show completed runs
- Remove old create dialog
- Add new schedule creation

### Step 3: Redesign Detail View

- Show run details (not maintenance record)
- Display checklist with engineer assignments
- Show completion progress
- Add history timeline

### Step 4: Add Auto-Renew Indicators

- Show "Next scheduled: DATE" after completion
- Display frequency badge
- Highlight automatic renewal

### Step 5: Enhance History

- Full timeline view
- Show all runs for a schedule
- Display completion notes
- Show engineer assignments per run

---

## 🔄 Auto-Renew Logic (Already Implemented)

### Backend Scheduler (`maintenanceOpsScheduler.ts`):

```typescript
// Runs hourly, automatically:
1. Mark overdue runs (due_date < today)
2. Auto-renew completed schedules:
   - If schedule.next_due_date has completed run
   - Advance next_due_date by frequency
   - Create new run
   - Copy engineers
   - Initialize checklist
   - Send SMS reminders
3. Send due-tomorrow reminders
```

### Complete Endpoint Logic:

```typescript
POST /maintenanceOps/runs/:runId/complete
  1. Mark all checklist items done
  2. Set status = 'Complete'
  3. Set completed_at = now
  4. Calculate next due date (based on frequency)
  5. Create next run automatically
  6. Return { renewed: true, next_run_id, next_due_date }
```

---

## 📱 Reminder System (Already Implemented)

### Reminder Rules:

- **Daily tasks:** Reminder same day
- **Weekly tasks:** Reminder 1 day before
- **Monthly tasks:** Reminder 2 days before

### SMS Placeholder:

- Uses `sendSmsPlaceholder()` function
- Configured via `SMS_API_URL` env var
- Falls back to console log if no URL

### Deduplication:

- Tracks sent reminders in `maintenance_run_notifications`
- Prevents duplicate reminders

---

## 🎨 UI/UX Requirements

### Main Page:

```
┌────────────────────────────────────────────┐
│ Maintenance Operations                     │
│ [Active] [Completed]                       │
├────────────────────────────────────────────┤
│ Server    Type      Due     Status  Actions│
│ SRV-001   Patching  Today   Active  [View] │
│ SRV-002   Hardware  +2 days Active  [View] │
│ SRV-003   Backup    -1 day  OVERDUE [View] │ ← Red
└────────────────────────────────────────────┘
```

### Detail View:

```
┌────────────────────────────────────────────┐
│ SRV-001 | Patching | Daily | Active        │
│ Due: 2026-01-29                            │
├────────────────────────────────────────────┤
│ Checklist Progress: 3/6 (50%)              │
│                                            │
│ ☑ Confirm maintenance window              │
│ ☑ Take backup/snapshot                    │
│ ☑ Apply patches                           │
│ ☐ Reboot if required                      │
│ ☐ Validate services                       │
│ ☐ Update ticket/record                    │
│                                            │
│ [Mark Complete]                            │
├────────────────────────────────────────────┤
│ Upon completion:                           │
│ → Next run scheduled: 2026-01-30           │
│ → Status will change to Complete           │
│ → Engineers will be notified               │
└────────────────────────────────────────────┘
```

### History View:

```
┌────────────────────────────────────────────┐
│ Maintenance History - SRV-001              │
├────────────────────────────────────────────┤
│ Run #5 | 2026-01-29 | Complete | 100%     │
│   Completed by: John Doe                   │
│   Note: All systems validated              │
│                                            │
│ Run #4 | 2026-01-28 | Complete | 100%     │
│   Completed by: Jane Smith                 │
│                                            │
│ Run #3 | 2026-01-27 | Complete | 100%     │
│   Completed by: John Doe                   │
└────────────────────────────────────────────┘
```

---

## ✅ Acceptance Criteria

### Auto-Renew:

- ✅ When task completed → next task created automatically
- ✅ Frequency respected (Daily/Weekly/Monthly)
- ✅ Next due date calculated correctly
- ✅ Engineers copied to new run

### Reminders:

- ✅ SMS sent based on frequency rules
- ✅ Deduplication prevents spam
- ✅ Placeholder mode for dev/testing

### Task States:

- ✅ Active: Not started, due date >= today
- ✅ Incomplete: Started but not done
- ✅ Overdue: Not complete, due date < today
- ✅ Complete: All done, moves to history

### History:

- ✅ Full timeline visible
- ✅ Shows all past runs
- ✅ Displays completion details
- ✅ Engineers and notes preserved

### UI/UX:

- ✅ Only active tasks in main list
- ✅ Auto-refresh after completion
- ✅ Overdue highlighted in red
- ✅ Professional status badges
- ✅ Clear next scheduled date

---

## 🚀 Next Steps

**Option 1: Full Migration (Recommended)**

- Migrate frontend to use new `/api/maintenanceOps` system
- Get all automation features working
- Professional maintenance automation platform

**Option 2: Dual System (Not Recommended)**

- Keep old system for legacy data
- Add new system for new maintenance
- Complex to maintain

**Recommendation:** **Full Migration** to unlock enterprise automation features!

---

_Analysis Complete_
_Ready for Implementation_
