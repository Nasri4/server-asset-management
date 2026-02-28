const { query } = require('../config/db');

let runsSchemaCache = null;

async function getRunsSchema() {
  if (runsSchemaCache) return runsSchemaCache;

  const columns = await query(
    `SELECT name
     FROM sys.columns
     WHERE object_id = OBJECT_ID('maintenance_runs')`
  );

  const colSet = new Set((columns.recordset || []).map((row) => String(row.name).toLowerCase()));
  const runLinkColumn = colSet.has('maintenance_id')
    ? 'maintenance_id'
    : colSet.has('schedule_id')
      ? 'schedule_id'
      : colSet.has('plan_id')
        ? 'plan_id'
        : null;

  runsSchemaCache = {
    runLinkColumn,
    hasPlanId: colSet.has('plan_id'),
    hasScheduleId: colSet.has('schedule_id'),
    hasExecutionDate: colSet.has('execution_date'),
    hasRunStatus: colSet.has('run_status'),
    hasStartedAt: colSet.has('started_at'),
    orderColumn: colSet.has('created_at') ? 'created_at' : 'run_id',
  };

  return runsSchemaCache;
}

async function runDueMaintenanceScheduler() {
  const runsTable = await query(
    `SELECT TOP 1 name
     FROM sys.tables
     WHERE name = 'maintenance_runs'`
  );

  if (!runsTable.recordset.length) {
    return { processed: 0, createdRuns: 0 };
  }

  const schema = await getRunsSchema();
  if (!schema.runLinkColumn || schema.runLinkColumn !== 'maintenance_id') {
    return { processed: 0, createdRuns: 0 };
  }

  const due = await query(
    `SELECT m.maintenance_id
     FROM maintenance m
     WHERE m.status IN ('Scheduled', 'Pending')
       AND m.scheduled_date <= GETDATE()`
  );

  let createdRuns = 0;

  for (const row of due.recordset || []) {
    const maintenanceId = row.maintenance_id;
    const statusFilter = schema.hasRunStatus
      ? "AND run_status IN ('Pending', 'In Progress')"
      : '';
    const existingOpen = await query(
      `SELECT TOP 1 run_id
       FROM maintenance_runs
       WHERE ${schema.runLinkColumn} = @id
         ${statusFilter}
       ORDER BY ${schema.orderColumn} DESC`,
      { id: maintenanceId }
    );

    if (existingOpen.recordset.length) {
      continue;
    }

    const insertColumns = [schema.runLinkColumn];
    const insertValues = ['@id'];
    if (schema.hasPlanId && schema.runLinkColumn !== 'plan_id') {
      insertColumns.push('plan_id');
      insertValues.push('@id');
    }
    if (schema.hasScheduleId && schema.runLinkColumn !== 'schedule_id') {
      insertColumns.push('schedule_id');
      insertValues.push('@id');
    }
    if (schema.hasRunStatus) {
      insertColumns.push('run_status');
      insertValues.push("'Pending'");
    }
    if (schema.hasExecutionDate) {
      insertColumns.push('execution_date');
      insertValues.push('GETDATE()');
    }
    if (schema.hasStartedAt) {
      insertColumns.push('started_at');
      insertValues.push('GETDATE()');
    }

    await query(
      `INSERT INTO maintenance_runs (${insertColumns.join(', ')})
       VALUES (${insertValues.join(', ')})`,
      { id: maintenanceId }
    );

    await query(
      `UPDATE maintenance
       SET status = 'Pending', updated_at = GETDATE()
       WHERE maintenance_id = @id`,
      { id: maintenanceId }
    );

    createdRuns += 1;
  }

  return { processed: (due.recordset || []).length, createdRuns };
}

module.exports = { runDueMaintenanceScheduler };
