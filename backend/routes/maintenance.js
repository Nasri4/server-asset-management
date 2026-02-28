const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireRole, scopeFilter } = require('../middleware/rbac');
const { auditMiddleware, logAudit } = require('../middleware/audit');
const { sendSMS } = require('../utils/sms');
const { runDueMaintenanceScheduler } = require('../services/maintenanceScheduler.service');

let maintenanceSchemaCache = null;

async function getMaintenanceSchema() {
  if (maintenanceSchemaCache) return maintenanceSchemaCache;

  const [tableRows, maintenanceColumnRows, runColumnRows] = await Promise.all([
    query(
      `SELECT name FROM sys.tables
       WHERE name IN ('maintenance_runs', 'maintenance_templates', 'maintenance')`
    ),
    query(
      `SELECT name FROM sys.columns
       WHERE object_id = OBJECT_ID('maintenance')
         AND name IN ('template_id', 'recurrence_type', 'recurrence_interval', 'next_scheduled_date', 'checklist_tasks')`
    ),
    query(
      `SELECT name FROM sys.columns
       WHERE object_id = OBJECT_ID('maintenance_runs')`
    ),
  ]);

  const tableSet = new Set((tableRows.recordset || []).map((row) => String(row.name).toLowerCase()));
  const maintenanceColumnSet = new Set((maintenanceColumnRows.recordset || []).map((row) => String(row.name).toLowerCase()));
  const runColumnSet = new Set((runColumnRows.recordset || []).map((row) => String(row.name).toLowerCase()));

  const runLinkColumn = runColumnSet.has('maintenance_id')
    ? 'maintenance_id'
    : runColumnSet.has('schedule_id')
      ? 'schedule_id'
      : runColumnSet.has('plan_id')
        ? 'plan_id'
        : null;

  const runResultColumn = runColumnSet.has('run_result') ? 'run_result' : null;
  const runNotesColumn = runColumnSet.has('completion_notes')
    ? 'completion_notes'
    : runColumnSet.has('summary_notes')
      ? 'summary_notes'
      : null;
  const runCompletedByColumn = runColumnSet.has('completed_by')
    ? 'completed_by'
    : runColumnSet.has('started_by')
      ? 'started_by'
      : null;
  const runOrderColumn = runColumnSet.has('created_at')
    ? 'created_at'
    : runColumnSet.has('completed_at')
      ? 'completed_at'
      : runColumnSet.has('started_at')
        ? 'started_at'
        : 'run_id';

  maintenanceSchemaCache = {
    hasMaintenanceRuns: tableSet.has('maintenance_runs'),
    hasMaintenanceTemplates: tableSet.has('maintenance_templates'),
    hasTemplateIdColumn: maintenanceColumnSet.has('template_id'),
    hasRecurrenceType: maintenanceColumnSet.has('recurrence_type'),
    hasRecurrenceInterval: maintenanceColumnSet.has('recurrence_interval'),
    hasNextScheduledDate: maintenanceColumnSet.has('next_scheduled_date'),
    hasChecklistTasks: maintenanceColumnSet.has('checklist_tasks'),
    runLinkColumn,
    runResultColumn,
    runNotesColumn,
    runCompletedByColumn,
    runOrderColumn,
    hasRunStatus: runColumnSet.has('run_status'),
    hasRunPlanId: runColumnSet.has('plan_id'),
    hasRunScheduleId: runColumnSet.has('schedule_id'),
    hasRunExecutionDate: runColumnSet.has('execution_date'),
    hasRunStartedAt: runColumnSet.has('started_at'),
    hasRunCompletedAt: runColumnSet.has('completed_at'),
    hasRunUpdatedAt: runColumnSet.has('updated_at'),
    hasNativeRunLink: runLinkColumn === 'maintenance_id',
  };

  return maintenanceSchemaCache;
}

function buildScopeClause(scope, serverAlias = 's', maintenanceAlias = 'm') {
  let where = '';
  const params = {};

  if (scope.department_id) {
    where += ` AND ${serverAlias}.department_id = @dept_id`;
    params.dept_id = scope.department_id;
  }
  if (scope.team_id) {
    where += ` AND ${serverAlias}.team_id = @team_id`;
    params.team_id = scope.team_id;
  }
  if (scope.engineer_id) {
    where += ` AND ${maintenanceAlias}.assigned_engineer_id = @scope_engineer_id`;
    params.scope_engineer_id = scope.engineer_id;
  }

  return { where, params };
}

function coerceDate(value) {
  if (!value || !String(value).trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getNextDate(baseDate, recurrenceType, recurrenceInterval) {
  const next = new Date(baseDate);
  const type = (recurrenceType || '').toLowerCase();
  let days = Number.isFinite(Number(recurrenceInterval)) ? Number(recurrenceInterval) : null;
  if (!days || days <= 0) {
    if (type === 'daily') days = 1;
    else if (type === 'weekly') days = 7;
    else if (type === 'monthly') days = 30;
    else if (type === 'quarterly') days = 90;
    else if (type === 'yearly') days = 365;
  }
  if (!days || days <= 0) return null;
  next.setDate(next.getDate() + days);
  return next;
}

async function assertServerInScope(serverId, scope) {
  const scoped = buildScopeClause(scope, 's', 'm');
  const check = await query(
    `SELECT TOP 1 s.server_id
     FROM servers s
     LEFT JOIN maintenance m ON m.server_id = s.server_id
     WHERE s.server_id = @server_id ${scoped.where}`,
    { ...scoped.params, server_id: serverId }
  );
  return !!check.recordset.length;
}

async function listSchedules(req, res) {
  const scope = scopeFilter(req);
  const scoped = buildScopeClause(scope);
  const { status, server_id, upcoming, overdue, q } = req.query;
  const schema = await getMaintenanceSchema();

  await query(
    `UPDATE maintenance SET status = 'Pending', updated_at = GETDATE()
     WHERE status = 'Scheduled' AND scheduled_date < GETDATE()`
  );

  const templateNameSelect = schema.hasMaintenanceTemplates && schema.hasTemplateIdColumn
    ? 't.template_name'
    : 'CAST(NULL AS NVARCHAR(120)) AS template_name';
  const latestRunStatusSelect = schema.hasMaintenanceRuns && schema.runLinkColumn && schema.hasRunStatus
    ? `(SELECT TOP 1 mr.run_status FROM maintenance_runs mr WHERE mr.${schema.runLinkColumn} = m.maintenance_id ORDER BY mr.${schema.runOrderColumn} DESC) AS latest_run_status`
    : 'CAST(NULL AS NVARCHAR(30)) AS latest_run_status';
  const templateJoin = schema.hasMaintenanceTemplates && schema.hasTemplateIdColumn
    ? 'LEFT JOIN maintenance_templates t ON t.template_id = m.template_id'
    : '';

  let sql = `SELECT m.*, s.server_code, s.hostname, e.full_name AS engineer_name,
                    ${templateNameSelect},
                    ${latestRunStatusSelect}
             FROM maintenance m
             JOIN servers s ON m.server_id = s.server_id
             LEFT JOIN engineers e ON m.assigned_engineer_id = e.engineer_id
             ${templateJoin}
             WHERE 1=1 ${scoped.where}`;
  const params = { ...scoped.params };

  if (status) { sql += ' AND m.status = @status'; params.status = status; }
  if (server_id) { sql += ' AND m.server_id = @server_id'; params.server_id = parseInt(server_id, 10); }
  if (upcoming === 'true') { sql += ' AND m.scheduled_date >= GETDATE() AND m.status IN (\'Scheduled\', \'Pending\')'; }
  if (overdue === 'true') { sql += ' AND m.scheduled_date < GETDATE() AND m.status IN (\'Scheduled\', \'Pending\', \'In Progress\')'; }
  if (q && String(q).trim()) {
    sql += ' AND (m.title LIKE @q OR s.server_code LIKE @q OR s.hostname LIKE @q)';
    params.q = `%${String(q).trim()}%`;
  }

  sql += ' ORDER BY m.scheduled_date DESC';
  const result = await query(sql, params);
  res.json(result.recordset || []);
}

router.get('/dashboard', authenticate, requirePermission('maintenance.read'), async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const scoped = buildScopeClause(scope);

    const counts = await query(
      `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN m.status IN ('Scheduled', 'Pending', 'In Progress') THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN m.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN m.scheduled_date < GETDATE() AND m.status IN ('Scheduled', 'Pending', 'In Progress') THEN 1 ELSE 0 END) AS overdue
       FROM maintenance m
       JOIN servers s ON s.server_id = m.server_id
       WHERE 1=1 ${scoped.where}`,
      scoped.params
    );

    const upcoming = await query(
      `SELECT TOP 8 m.maintenance_id, m.title, m.status, m.priority, m.scheduled_date,
              s.server_id, s.server_code, s.hostname,
              e.engineer_id, e.full_name AS engineer_name
       FROM maintenance m
       JOIN servers s ON s.server_id = m.server_id
       LEFT JOIN engineers e ON e.engineer_id = m.assigned_engineer_id
       WHERE m.status IN ('Scheduled', 'Pending', 'In Progress') ${scoped.where}
       ORDER BY m.scheduled_date ASC`,
      scoped.params
    );

    res.json({
      stats: counts.recordset[0] || { total: 0, active: 0, completed: 0, overdue: 0 },
      upcoming: upcoming.recordset || [],
    });
  } catch (err) {
    console.error('Maintenance dashboard error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to load maintenance dashboard.' });
  }
});

router.get('/schedules', authenticate, requirePermission('maintenance.read'), async (req, res) => {
  try {
    await listSchedules(req, res);
  } catch (err) {
    console.error('Maintenance schedules list error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch maintenance schedules.' });
  }
});

router.get('/calendar', authenticate, requirePermission('maintenance.read'), async (req, res) => {
  try {
    const scope = scopeFilter(req);
    const scoped = buildScopeClause(scope);
    const start = coerceDate(req.query.start);
    const end = coerceDate(req.query.end);
    const params = { ...scoped.params };

    let rangeSql = '';
    if (start) {
      rangeSql += ' AND m.scheduled_date >= @start';
      params.start = start;
    }
    if (end) {
      rangeSql += ' AND m.scheduled_date <= @end';
      params.end = end;
    }

    const result = await query(
      `SELECT m.maintenance_id, m.title, m.status, m.priority, m.scheduled_date,
              s.server_id, s.server_code
       FROM maintenance m
       JOIN servers s ON s.server_id = m.server_id
       WHERE 1=1 ${scoped.where} ${rangeSql}
       ORDER BY m.scheduled_date ASC`,
      params
    );

    res.json(result.recordset || []);
  } catch (err) {
    console.error('Maintenance calendar error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch maintenance calendar.' });
  }
});

router.get('/history', authenticate, requirePermission('maintenance.read'), async (req, res) => {
  try {
    const schema = await getMaintenanceSchema();
    if (!schema.hasMaintenanceRuns || !schema.runLinkColumn) {
      return res.json([]);
    }

    const scope = scopeFilter(req);
    const scoped = buildScopeClause(scope);
    const { result, limit } = req.query;
    const params = { ...scoped.params, limit: Math.min(parseInt(limit, 10) || 100, 300) };

    let resultSql = '';
    if (schema.runResultColumn && result && String(result).trim()) {
      resultSql = ` AND r.${schema.runResultColumn} = @run_result`;
      params.run_result = String(result).trim();
    }

    const runResultSelect = schema.runResultColumn
      ? `r.${schema.runResultColumn} AS run_result`
      : 'CAST(NULL AS NVARCHAR(30)) AS run_result';
    const runNotesSelect = schema.runNotesColumn
      ? `r.${schema.runNotesColumn} AS completion_notes`
      : 'CAST(NULL AS NVARCHAR(1000)) AS completion_notes';
    const completedByNameSelect = schema.runCompletedByColumn
      ? 'u.full_name AS completed_by_name'
      : 'CAST(NULL AS NVARCHAR(200)) AS completed_by_name';
    const completedByJoin = schema.runCompletedByColumn
      ? `LEFT JOIN users u ON u.user_id = r.${schema.runCompletedByColumn}`
      : '';

    const history = await query(
      `SELECT TOP (@limit)
          r.run_id,
          r.${schema.runLinkColumn} AS maintenance_id,
          r.run_status,
          ${runResultSelect},
          r.started_at,
          r.completed_at,
          ${runNotesSelect},
          m.title,
          m.maintenance_type,
          s.server_id,
          s.server_code,
          e.full_name AS engineer_name,
          ${completedByNameSelect}
       FROM maintenance_runs r
       JOIN maintenance m ON m.maintenance_id = r.${schema.runLinkColumn}
       JOIN servers s ON s.server_id = m.server_id
       LEFT JOIN engineers e ON e.engineer_id = m.assigned_engineer_id
       ${completedByJoin}
       WHERE 1=1 ${scoped.where} ${resultSql}
       ORDER BY COALESCE(r.completed_at, r.started_at, r.${schema.runOrderColumn}) DESC`,
      params
    );

    res.json(history.recordset || []);
  } catch (err) {
    console.error('Maintenance history error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch maintenance history.' });
  }
});

router.post('/scheduler/run-due', authenticate, requireRole('Admin'), requirePermission('maintenance.update'), async (req, res) => {
  try {
    const result = await runDueMaintenanceScheduler();
    res.json({ message: 'Scheduler run completed.', ...result });
  } catch (err) {
    console.error('Maintenance scheduler trigger error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to process due maintenance.' });
  }
});

router.post('/', authenticate, requirePermission('maintenance.create'),
  auditMiddleware('CREATE', 'maintenance'),
  async (req, res) => {
    try {
      const schema = await getMaintenanceSchema();
      const {
        server_id,
        maintenance_type,
        title,
        description,
        scheduled_date,
        scheduled_end,
        priority,
        assigned_engineer_id,
        notify_team,
        notify_engineer,
        recurrence_type,
        recurrence_interval,
        checklist_tasks,
        template_name,
      } = req.body;

      if (!server_id || !title || !scheduled_date) {
        return res.status(400).json({ error: 'Server, title, and scheduled date are required.' });
      }

      const serverId = parseInt(server_id, 10);
      const engineerId = assigned_engineer_id ? parseInt(assigned_engineer_id, 10) : null;
      const scheduledDate = coerceDate(scheduled_date);
      const scheduledEnd = coerceDate(scheduled_end);
      const recurrenceInterval = recurrence_interval ? parseInt(recurrence_interval, 10) : null;
      const checklistJson = Array.isArray(checklist_tasks) ? JSON.stringify(checklist_tasks) : null;

      if (!scheduledDate) {
        return res.status(400).json({ error: 'Invalid scheduled date.' });
      }
      if (scheduled_end && !scheduledEnd) {
        return res.status(400).json({ error: 'Invalid scheduled end date.' });
      }

      const scope = scopeFilter(req);
      const inScope = await assertServerInScope(serverId, scope);
      if (!inScope) {
        return res.status(403).json({ error: 'Access denied for this server scope.' });
      }

      let templateId = null;
      if (schema.hasMaintenanceTemplates && schema.hasTemplateIdColumn && template_name && String(template_name).trim()) {
        const templateResult = await query(
          `INSERT INTO maintenance_templates (template_name, maintenance_type, default_priority, default_description, checklist_tasks, created_by)
           OUTPUT INSERTED.template_id
           VALUES (@template_name, @maintenance_type, @default_priority, @default_description, @checklist_tasks, @created_by)`,
          {
            template_name: String(template_name).trim(),
            maintenance_type: maintenance_type || 'Preventive',
            default_priority: priority || 'Medium',
            default_description: description && String(description).trim() ? String(description).trim() : null,
            checklist_tasks: checklistJson,
            created_by: req.user?.user_id ?? null,
          }
        );
        templateId = templateResult.recordset[0]?.template_id || null;
      }

      const insertColumns = [
        'server_id', 'maintenance_type', 'title', 'description', 'scheduled_date', 'scheduled_end',
        'priority', 'assigned_engineer_id', 'notify_team', 'notify_engineer', 'created_by',
      ];
      const insertValues = [
        '@server_id', '@type', '@title', '@description', '@date', '@end_date',
        '@priority', '@engineer_id', '@notify_team', '@notify_engineer', '@created_by',
      ];
      const insertParams = {
        server_id: serverId,
        type: maintenance_type || 'Preventive',
        title: String(title).trim(),
        description: description && String(description).trim() ? String(description).trim() : null,
        date: scheduledDate,
        end_date: scheduledEnd,
        priority: priority || 'Medium',
        engineer_id: engineerId,
        notify_team: notify_team !== false ? 1 : 0,
        notify_engineer: notify_engineer !== false ? 1 : 0,
        created_by: req.user?.user_id ?? null,
      };

      if (schema.hasRecurrenceType) {
        insertColumns.push('recurrence_type');
        insertValues.push('@recurrence_type');
        insertParams.recurrence_type = recurrence_type || null;
      }
      if (schema.hasRecurrenceInterval) {
        insertColumns.push('recurrence_interval');
        insertValues.push('@recurrence_interval');
        insertParams.recurrence_interval = Number.isNaN(recurrenceInterval) ? null : recurrenceInterval;
      }
      if (schema.hasNextScheduledDate) {
        insertColumns.push('next_scheduled_date');
        insertValues.push('@next_scheduled_date');
        insertParams.next_scheduled_date = scheduledDate;
      }
      if (schema.hasChecklistTasks) {
        insertColumns.push('checklist_tasks');
        insertValues.push('@checklist_tasks');
        insertParams.checklist_tasks = checklistJson;
      }
      if (schema.hasTemplateIdColumn) {
        insertColumns.push('template_id');
        insertValues.push('@template_id');
        insertParams.template_id = templateId;
      }

      const result = await query(
        `INSERT INTO maintenance (${insertColumns.join(', ')})
         OUTPUT INSERTED.maintenance_id
         VALUES (${insertValues.join(', ')})`,
        insertParams
      );

      const maintenanceId = result.recordset[0].maintenance_id;

      const serverRow = await query('SELECT server_code, hostname FROM servers WHERE server_id = @id', { id: serverId });
      const serverName = serverRow.recordset[0]?.server_code || serverRow.recordset[0]?.hostname || 'Server';
      const priorityVal = priority || 'Medium';
      const descShort = (description || title || '').slice(0, 60);
      const smsBody = `[${serverName}] ${maintenance_type || 'Maintenance'} - ${new Date(scheduled_date).toLocaleString()} - Priority: ${priorityVal}. ${descShort}`;

      if (notify_engineer && engineerId) {
        try {
          const eng = await query('SELECT phone FROM engineers WHERE engineer_id = @id', { id: engineerId });
          if (eng.recordset[0]?.phone) {
            const smsResult = await sendSMS(eng.recordset[0].phone, smsBody, 'maintenance', 'maintenance', maintenanceId);
            if (smsResult.success) await query('UPDATE maintenance SET sms_sent = 1 WHERE maintenance_id = @id', { id: maintenanceId });
          }
        } catch (smsErr) {
          console.error('SMS to engineer failed:', smsErr.message);
        }
      }

      if (notify_team) {
        try {
          const team = await query(
            `SELECT t.oncall_phone FROM servers s JOIN teams t ON s.team_id = t.team_id WHERE s.server_id = @id`,
            { id: serverId }
          );
          if (team.recordset[0]?.oncall_phone) {
            await sendSMS(team.recordset[0].oncall_phone, smsBody, 'maintenance', 'maintenance', maintenanceId);
          }
        } catch (smsErr) {
          console.error('SMS to team failed:', smsErr.message);
        }
      }

      if (req.user) {
        try {
          await logAudit(
            req.user.user_id,
            req.user.username,
            'MAINTENANCE_SCHEDULED',
            'server',
            serverId,
            null,
            {
              maintenance_id: maintenanceId,
              title,
              maintenance_type: maintenance_type || 'Maintenance',
              scheduled_date,
              status: 'Scheduled',
            },
            req.user.ip,
            req.user.userAgent,
            false
          );
        } catch (auditErr) {
          console.error('Audit log failed:', auditErr.message);
        }
      }

      res.status(201).json({ id: maintenanceId, message: 'Maintenance scheduled.' });
    } catch (err) {
      console.error('Maintenance POST error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to schedule maintenance.' });
    }
  }
);

router.post('/:id/complete', authenticate, requirePermission('maintenance.update'), async (req, res) => {
  try {
    const schema = await getMaintenanceSchema();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid maintenance ID.' });

    const { completion_notes, run_result, actual_start, actual_end } = req.body || {};
    const completedAt = coerceDate(actual_end) || new Date();
    const startedAt = coerceDate(actual_start) || completedAt;

    const existing = await query(
      `SELECT TOP 1 m.maintenance_id, m.server_id,
              ${schema.hasRecurrenceType ? 'm.recurrence_type' : 'CAST(NULL AS NVARCHAR(50)) AS recurrence_type'},
              ${schema.hasRecurrenceInterval ? 'm.recurrence_interval' : 'CAST(NULL AS INT) AS recurrence_interval'},
              ${schema.hasMaintenanceRuns ? 'r.run_id' : 'CAST(NULL AS INT) AS run_id'}
       FROM maintenance m
            ${schema.hasMaintenanceRuns && schema.runLinkColumn ? `LEFT JOIN maintenance_runs r ON r.${schema.runLinkColumn} = m.maintenance_id AND r.run_status IN ('Pending', 'In Progress')` : ''}
       WHERE m.maintenance_id = @id
            ${schema.hasMaintenanceRuns ? `ORDER BY r.${schema.runOrderColumn} DESC` : ''}`,
      { id }
    );

    if (!existing.recordset.length) {
      return res.status(404).json({ error: 'Maintenance not found.' });
    }

    const current = existing.recordset[0];
    let runId = current.run_id;

    if (schema.hasMaintenanceRuns && schema.hasNativeRunLink && schema.runLinkColumn && !runId) {
      const runInsertCols = [schema.runLinkColumn];
      const runInsertVals = ['@maintenance_id'];
      const runInsertParams = { maintenance_id: id };

      if (schema.hasRunPlanId && schema.runLinkColumn !== 'plan_id') {
        runInsertCols.push('plan_id');
        runInsertVals.push('@maintenance_id');
      }
      if (schema.hasRunScheduleId && schema.runLinkColumn !== 'schedule_id') {
        runInsertCols.push('schedule_id');
        runInsertVals.push('@maintenance_id');
      }

      if (schema.hasRunStatus) {
        runInsertCols.push('run_status');
        runInsertVals.push("'In Progress'");
      }
      if (schema.hasRunExecutionDate) {
        runInsertCols.push('execution_date');
        runInsertVals.push('@execution_date');
        runInsertParams.execution_date = startedAt;
      }
      if (schema.hasRunStartedAt) {
        runInsertCols.push('started_at');
        runInsertVals.push('@started_at');
        runInsertParams.started_at = startedAt;
      }

      const createdRun = await query(
        `INSERT INTO maintenance_runs (${runInsertCols.join(', ')})
         OUTPUT INSERTED.run_id
         VALUES (${runInsertVals.join(', ')})`,
        runInsertParams
      );
      runId = createdRun.recordset[0]?.run_id;
    }

    if (schema.hasMaintenanceRuns && schema.hasNativeRunLink && runId) {
      const runUpdates = [];
      const runUpdateParams = { run_id: runId };
      if (schema.hasRunStatus) {
        runUpdates.push(`run_status = 'Completed'`);
      }
      if (schema.runResultColumn) {
        runUpdates.push(`${schema.runResultColumn} = @run_result`);
        runUpdateParams.run_result = run_result || 'Success';
      }
      if (schema.hasRunStartedAt) {
        runUpdates.push('started_at = COALESCE(started_at, @started_at)');
        runUpdateParams.started_at = startedAt;
      }
      if (schema.hasRunCompletedAt) {
        runUpdates.push('completed_at = @completed_at');
        runUpdateParams.completed_at = completedAt;
      }
      if (schema.runNotesColumn) {
        runUpdates.push(`${schema.runNotesColumn} = @notes`);
        runUpdateParams.notes = completion_notes && String(completion_notes).trim() ? String(completion_notes).trim() : null;
      }
      if (schema.runCompletedByColumn) {
        runUpdates.push(`${schema.runCompletedByColumn} = @completed_by`);
        runUpdateParams.completed_by = req.user?.user_id ?? null;
      }
      if (schema.hasRunUpdatedAt) {
        runUpdates.push('updated_at = GETDATE()');
      }

      if (runUpdates.length) {
      await query(
        `UPDATE maintenance_runs
         SET ${runUpdates.join(', ')}
         WHERE run_id = @run_id`,
        runUpdateParams
      );
      }
    }

    const nextDate = current.recurrence_type ? getNextDate(completedAt, current.recurrence_type, current.recurrence_interval) : null;

    if (nextDate && schema.hasNextScheduledDate) {
      await query(
        `UPDATE maintenance
         SET status = 'Scheduled',
             actual_start = @actual_start,
             actual_end = @actual_end,
             completion_notes = @notes,
             scheduled_date = @next_date,
             next_scheduled_date = @next_date,
             updated_at = GETDATE()
         WHERE maintenance_id = @id`,
        {
          id,
          actual_start: startedAt,
          actual_end: completedAt,
          notes: completion_notes && String(completion_notes).trim() ? String(completion_notes).trim() : null,
          next_date: nextDate,
        }
      );
    } else {
      await query(
        `UPDATE maintenance
         SET status = 'Completed',
             actual_start = @actual_start,
             actual_end = @actual_end,
             completion_notes = @notes,
             updated_at = GETDATE()
         WHERE maintenance_id = @id`,
        {
          id,
          actual_start: startedAt,
          actual_end: completedAt,
          notes: completion_notes && String(completion_notes).trim() ? String(completion_notes).trim() : null,
        }
      );
    }

    if (req.user) {
      try {
        await logAudit(
          req.user.user_id,
          req.user.username,
          'MAINTENANCE_COMPLETED',
          'maintenance',
          id,
          null,
          { completion_notes: completion_notes || null, run_result: run_result || 'Success' },
          req.user.ip,
          req.user.userAgent,
          false
        );
      } catch (auditErr) {
        console.error('Maintenance complete audit log failed:', auditErr.message);
      }
    }

    res.json({ message: 'Maintenance completed.', run_id: runId, next_scheduled_date: nextDate || null });
  } catch (err) {
    console.error('Maintenance complete error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to complete maintenance.' });
  }
});

router.put('/:id', authenticate, requirePermission('maintenance.update'),
  auditMiddleware('UPDATE', 'maintenance'),
  async (req, res) => {
    try {
      const schema = await getMaintenanceSchema();
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid maintenance ID.' });
      const raw = req.body;
      const allowed = [
        'status', 'priority', 'assigned_engineer_id', 'actual_start', 'actual_end',
        'completion_notes', 'scheduled_date', 'scheduled_end', 'title', 'description',
      ];
      if (schema.hasRecurrenceType) allowed.push('recurrence_type');
      if (schema.hasRecurrenceInterval) allowed.push('recurrence_interval');
      if (schema.hasChecklistTasks) allowed.push('checklist_tasks');
      const updateFields = [];
      const params = { id };

      for (const field of allowed) {
        if (raw[field] === undefined) continue;
        let value = raw[field];
        if ((field === 'scheduled_date' || field === 'scheduled_end' || field === 'actual_start' || field === 'actual_end') && value != null && value !== '') {
          value = new Date(value);
          if (Number.isNaN(value.getTime())) continue;
        }
        if (field === 'assigned_engineer_id' && (value === '' || value === null)) value = null;
        if (field === 'checklist_tasks' && Array.isArray(value)) value = JSON.stringify(value);
        updateFields.push(`${field} = @${field}`);
        params[field] = value;
      }

      if (updateFields.length === 0) return res.status(400).json({ error: 'No fields to update.' });

      updateFields.push('updated_at = GETDATE()');
      const prev = await query('SELECT server_id, status FROM maintenance WHERE maintenance_id = @id', { id });
      await query(`UPDATE maintenance SET ${updateFields.join(', ')} WHERE maintenance_id = @id`, params);

      if (req.user && prev.recordset[0]) {
        const serverId = prev.recordset[0].server_id;
        const oldStatus = prev.recordset[0].status;
        if (raw.status !== undefined && raw.status !== oldStatus) {
          try {
            await logAudit(req.user.user_id, req.user.username, 'MAINTENANCE_STATUS_CHANGE', 'server', serverId, { status: oldStatus }, { status: raw.status }, req.user.ip, req.user.userAgent, false);
          } catch (error) {
            console.error('Audit log failed:', error.message);
          }
        } else {
          try {
            await logAudit(req.user.user_id, req.user.username, 'MAINTENANCE_UPDATED', 'server', serverId, null, raw, req.user.ip, req.user.userAgent, false);
          } catch (error) {
            console.error('Audit log failed:', error.message);
          }
        }
      }

      res.json({ message: 'Maintenance updated.' });
    } catch (err) {
      console.error('Maintenance PUT error:', err.message);
      res.status(500).json({ error: err.message || 'Failed to update maintenance.' });
    }
  }
);

router.get('/:id', authenticate, requirePermission('maintenance.read'), async (req, res) => {
  try {
    const schema = await getMaintenanceSchema();
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid maintenance ID.' });
    const scope = scopeFilter(req);
    const scoped = buildScopeClause(scope);

    const schedule = await query(
      `SELECT m.*, s.server_code, s.hostname, e.full_name AS engineer_name,
              u.full_name AS created_by_name,
              ${schema.hasMaintenanceTemplates && schema.hasTemplateIdColumn ? 't.template_name' : 'CAST(NULL AS NVARCHAR(120)) AS template_name'},
              ${schema.hasMaintenanceTemplates && schema.hasTemplateIdColumn ? 't.checklist_tasks AS template_checklist' : 'CAST(NULL AS NVARCHAR(MAX)) AS template_checklist'}
       FROM maintenance m
       JOIN servers s ON m.server_id = s.server_id
       LEFT JOIN engineers e ON m.assigned_engineer_id = e.engineer_id
       LEFT JOIN users u ON m.created_by = u.user_id
       ${schema.hasMaintenanceTemplates && schema.hasTemplateIdColumn ? 'LEFT JOIN maintenance_templates t ON t.template_id = m.template_id' : ''}
       WHERE m.maintenance_id = @id ${scoped.where}`,
      { id, ...scoped.params }
    );
    if (!schedule.recordset.length) return res.status(404).json({ error: 'Maintenance not found.' });

    const runs = schema.hasMaintenanceRuns && schema.runLinkColumn
      ? await query(
          `SELECT r.*,
                  ${schema.runCompletedByColumn ? 'u.full_name AS completed_by_name' : 'CAST(NULL AS NVARCHAR(200)) AS completed_by_name'}
           FROM maintenance_runs r
           ${schema.runCompletedByColumn ? `LEFT JOIN users u ON u.user_id = r.${schema.runCompletedByColumn}` : ''}
           WHERE r.${schema.runLinkColumn} = @id
           ORDER BY COALESCE(r.completed_at, r.started_at, r.${schema.runOrderColumn}) DESC`,
          { id }
        )
      : { recordset: [] };

    const payload = schedule.recordset[0];
    if (payload.checklist_tasks) {
      try { payload.checklist_tasks = JSON.parse(payload.checklist_tasks); } catch (_) {}
    }
    if (payload.template_checklist) {
      try { payload.template_checklist = JSON.parse(payload.template_checklist); } catch (_) {}
    }

    res.json({ ...payload, runs: runs.recordset || [] });
  } catch (err) {
    console.error('Maintenance GET by id error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch maintenance details.' });
  }
});

router.get('/', authenticate, requirePermission('maintenance.read'), async (req, res) => {
  try {
    await listSchedules(req, res);
  } catch (err) {
    console.error('Maintenance list error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch maintenance records.' });
  }
});

module.exports = router;
