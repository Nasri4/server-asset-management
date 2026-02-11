/*
  Migration: Advanced Maintenance Ops (recurrence engine + checklist progress)
  Date: 2026-01-28

  Adds:
    - dbo.maintenance_types
    - dbo.maintenance_type_checklist_items
    - dbo.maintenance_schedules
    - dbo.maintenance_schedule_engineers
    - dbo.maintenance_runs
    - dbo.maintenance_run_engineers
    - dbo.maintenance_run_checklist_progress

  Notes:
    - Idempotent (safe to run multiple times)
    - Designed for SQL Server
*/

BEGIN TRY
  BEGIN TRAN;

  /* =====================================================
     dbo.maintenance_types
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_types') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_types (
      maintenance_type_id INT IDENTITY(1,1) NOT NULL,
      name NVARCHAR(100) NOT NULL,
      description NVARCHAR(500) NULL,
      is_active BIT NOT NULL CONSTRAINT DF_maintenance_types_is_active DEFAULT(1),
      created_at DATETIME NOT NULL CONSTRAINT DF_maintenance_types_created_at DEFAULT(GETDATE()),
      updated_at DATETIME NOT NULL CONSTRAINT DF_maintenance_types_updated_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_types PRIMARY KEY (maintenance_type_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_types') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'UX_maintenance_types_name'
         AND object_id = OBJECT_ID('dbo.maintenance_types')
     )
  BEGIN
    CREATE UNIQUE INDEX UX_maintenance_types_name ON dbo.maintenance_types(name);
  END

  /* =====================================================
     dbo.maintenance_type_checklist_items
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_type_checklist_items') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_type_checklist_items (
      checklist_item_id INT IDENTITY(1,1) NOT NULL,
      maintenance_type_id INT NOT NULL,
      label NVARCHAR(200) NOT NULL,
      sort_order INT NOT NULL,
      is_active BIT NOT NULL CONSTRAINT DF_maintenance_type_checklist_items_is_active DEFAULT(1),
      created_at DATETIME NOT NULL CONSTRAINT DF_maintenance_type_checklist_items_created_at DEFAULT(GETDATE()),
      updated_at DATETIME NOT NULL CONSTRAINT DF_maintenance_type_checklist_items_updated_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_type_checklist_items PRIMARY KEY (checklist_item_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_type_checklist_items') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_type_checklist_items_maintenance_types'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_type_checklist_items')
     )
     AND OBJECT_ID('dbo.maintenance_types') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_type_checklist_items WITH CHECK
      ADD CONSTRAINT FK_maintenance_type_checklist_items_maintenance_types
      FOREIGN KEY (maintenance_type_id) REFERENCES dbo.maintenance_types(maintenance_type_id)
      ON DELETE CASCADE;

    ALTER TABLE dbo.maintenance_type_checklist_items
      CHECK CONSTRAINT FK_maintenance_type_checklist_items_maintenance_types;
  END

  IF OBJECT_ID('dbo.maintenance_type_checklist_items') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_maintenance_type_checklist_items_type'
         AND object_id = OBJECT_ID('dbo.maintenance_type_checklist_items')
     )
  BEGIN
    CREATE INDEX IX_maintenance_type_checklist_items_type
      ON dbo.maintenance_type_checklist_items(maintenance_type_id, sort_order);
  END

  /* =====================================================
     dbo.maintenance_schedules
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_schedules') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_schedules (
      schedule_id INT IDENTITY(1,1) NOT NULL,
      server_id INT NOT NULL,
      maintenance_type_id INT NOT NULL,
      frequency NVARCHAR(20) NOT NULL,
      next_due_date DATE NOT NULL,
      is_active BIT NOT NULL CONSTRAINT DF_maintenance_schedules_is_active DEFAULT(1),
      created_by NVARCHAR(255) NULL,
      created_at DATETIME NOT NULL CONSTRAINT DF_maintenance_schedules_created_at DEFAULT(GETDATE()),
      updated_at DATETIME NOT NULL CONSTRAINT DF_maintenance_schedules_updated_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_schedules PRIMARY KEY (schedule_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.check_constraints
       WHERE name = 'CK_maintenance_schedules_frequency'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_schedules')
     )
  BEGIN
    ALTER TABLE dbo.maintenance_schedules
      ADD CONSTRAINT CK_maintenance_schedules_frequency
      CHECK (frequency IN ('Daily','Weekly','Monthly'));
  END

  IF OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_schedules_servers'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_schedules')
     )
     AND OBJECT_ID('dbo.servers') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_schedules WITH CHECK
      ADD CONSTRAINT FK_maintenance_schedules_servers
      FOREIGN KEY (server_id) REFERENCES dbo.servers(server_id)
      ON DELETE CASCADE;

    ALTER TABLE dbo.maintenance_schedules
      CHECK CONSTRAINT FK_maintenance_schedules_servers;
  END

  IF OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_schedules_maintenance_types'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_schedules')
     )
     AND OBJECT_ID('dbo.maintenance_types') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_schedules WITH CHECK
      ADD CONSTRAINT FK_maintenance_schedules_maintenance_types
      FOREIGN KEY (maintenance_type_id) REFERENCES dbo.maintenance_types(maintenance_type_id);

    ALTER TABLE dbo.maintenance_schedules
      CHECK CONSTRAINT FK_maintenance_schedules_maintenance_types;
  END

  IF OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_maintenance_schedules_server'
         AND object_id = OBJECT_ID('dbo.maintenance_schedules')
     )
  BEGIN
    CREATE INDEX IX_maintenance_schedules_server
      ON dbo.maintenance_schedules(server_id, is_active, next_due_date);
  END

  /* =====================================================
     dbo.maintenance_schedule_engineers
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_schedule_engineers') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_schedule_engineers (
      schedule_id INT NOT NULL,
      engineer_id INT NOT NULL,
      created_at DATETIME NOT NULL CONSTRAINT DF_maintenance_schedule_engineers_created_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_schedule_engineers PRIMARY KEY (schedule_id, engineer_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_schedule_engineers') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_schedule_engineers_schedules'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_schedule_engineers')
     )
     AND OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_schedule_engineers WITH CHECK
      ADD CONSTRAINT FK_maintenance_schedule_engineers_schedules
      FOREIGN KEY (schedule_id) REFERENCES dbo.maintenance_schedules(schedule_id)
      ON DELETE CASCADE;

    ALTER TABLE dbo.maintenance_schedule_engineers
      CHECK CONSTRAINT FK_maintenance_schedule_engineers_schedules;
  END

  IF OBJECT_ID('dbo.maintenance_schedule_engineers') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_schedule_engineers_engineers'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_schedule_engineers')
     )
     AND OBJECT_ID('dbo.engineers') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_schedule_engineers WITH CHECK
      ADD CONSTRAINT FK_maintenance_schedule_engineers_engineers
      FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id);

    ALTER TABLE dbo.maintenance_schedule_engineers
      CHECK CONSTRAINT FK_maintenance_schedule_engineers_engineers;
  END

  /* =====================================================
     dbo.maintenance_runs
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_runs') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_runs (
      run_id INT IDENTITY(1,1) NOT NULL,
      schedule_id INT NOT NULL,
      due_date DATE NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_maintenance_runs_status DEFAULT('Active'),
      completed_at DATETIME NULL,
      note NVARCHAR(500) NULL,
      created_at DATETIME NOT NULL CONSTRAINT DF_maintenance_runs_created_at DEFAULT(GETDATE()),
      updated_at DATETIME NOT NULL CONSTRAINT DF_maintenance_runs_updated_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_runs PRIMARY KEY (run_id)
    );
  END

  /* Repair: if table existed from a prior/partial deployment and is missing due_date */
  IF OBJECT_ID('dbo.maintenance_runs') IS NOT NULL
     AND COL_LENGTH('dbo.maintenance_runs', 'due_date') IS NULL
  BEGIN
    ALTER TABLE dbo.maintenance_runs ADD due_date DATE NULL;
    UPDATE dbo.maintenance_runs
      SET due_date = CAST(created_at AS date)
      WHERE due_date IS NULL;
    ALTER TABLE dbo.maintenance_runs ALTER COLUMN due_date DATE NOT NULL;
  END

  IF OBJECT_ID('dbo.maintenance_runs') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.check_constraints
       WHERE name = 'CK_maintenance_runs_status'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_runs')
     )
  BEGIN
    ALTER TABLE dbo.maintenance_runs
      ADD CONSTRAINT CK_maintenance_runs_status
      CHECK (status IN ('Active','Incomplete','Overdue','Complete'));
  END

  IF OBJECT_ID('dbo.maintenance_runs') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_runs_schedules'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_runs')
     )
     AND OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_runs WITH CHECK
      ADD CONSTRAINT FK_maintenance_runs_schedules
      FOREIGN KEY (schedule_id) REFERENCES dbo.maintenance_schedules(schedule_id)
      ON DELETE CASCADE;

    ALTER TABLE dbo.maintenance_runs
      CHECK CONSTRAINT FK_maintenance_runs_schedules;
  END

  IF OBJECT_ID('dbo.maintenance_runs') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'UX_maintenance_runs_schedule_due'
         AND object_id = OBJECT_ID('dbo.maintenance_runs')
     )
  BEGIN
    CREATE UNIQUE INDEX UX_maintenance_runs_schedule_due
      ON dbo.maintenance_runs(schedule_id, due_date);
  END

  IF OBJECT_ID('dbo.maintenance_runs') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_maintenance_runs_status_due'
         AND object_id = OBJECT_ID('dbo.maintenance_runs')
     )
  BEGIN
    CREATE INDEX IX_maintenance_runs_status_due
      ON dbo.maintenance_runs(status, due_date);
  END

  /* =====================================================
     dbo.maintenance_run_engineers
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_run_engineers') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_run_engineers (
      run_id INT NOT NULL,
      engineer_id INT NOT NULL,
      created_at DATETIME NOT NULL CONSTRAINT DF_maintenance_run_engineers_created_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_run_engineers PRIMARY KEY (run_id, engineer_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_run_engineers') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_run_engineers_runs'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_run_engineers')
     )
     AND OBJECT_ID('dbo.maintenance_runs') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_run_engineers WITH CHECK
      ADD CONSTRAINT FK_maintenance_run_engineers_runs
      FOREIGN KEY (run_id) REFERENCES dbo.maintenance_runs(run_id)
      ON DELETE CASCADE;

    ALTER TABLE dbo.maintenance_run_engineers
      CHECK CONSTRAINT FK_maintenance_run_engineers_runs;
  END

  IF OBJECT_ID('dbo.maintenance_run_engineers') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_run_engineers_engineers'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_run_engineers')
     )
     AND OBJECT_ID('dbo.engineers') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_run_engineers WITH CHECK
      ADD CONSTRAINT FK_maintenance_run_engineers_engineers
      FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id);

    ALTER TABLE dbo.maintenance_run_engineers
      CHECK CONSTRAINT FK_maintenance_run_engineers_engineers;
  END

  /* =====================================================
     dbo.maintenance_run_checklist_progress
       - snapshot label per run for history stability
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_run_checklist_progress') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_run_checklist_progress (
      run_id INT NOT NULL,
      checklist_item_id INT NOT NULL,
      label NVARCHAR(200) NOT NULL,
      is_done BIT NOT NULL CONSTRAINT DF_maintenance_run_checklist_progress_is_done DEFAULT(0),
      done_at DATETIME NULL,
      updated_at DATETIME NOT NULL CONSTRAINT DF_maintenance_run_checklist_progress_updated_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_run_checklist_progress PRIMARY KEY (run_id, checklist_item_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_run_checklist_progress') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_run_checklist_progress_runs'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_run_checklist_progress')
     )
     AND OBJECT_ID('dbo.maintenance_runs') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_run_checklist_progress WITH CHECK
      ADD CONSTRAINT FK_maintenance_run_checklist_progress_runs
      FOREIGN KEY (run_id) REFERENCES dbo.maintenance_runs(run_id)
      ON DELETE CASCADE;

    ALTER TABLE dbo.maintenance_run_checklist_progress
      CHECK CONSTRAINT FK_maintenance_run_checklist_progress_runs;
  END

  IF OBJECT_ID('dbo.maintenance_run_checklist_progress') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_run_checklist_progress_checklist_items'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_run_checklist_progress')
     )
     AND OBJECT_ID('dbo.maintenance_type_checklist_items') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_run_checklist_progress WITH CHECK
      ADD CONSTRAINT FK_maintenance_run_checklist_progress_checklist_items
      FOREIGN KEY (checklist_item_id) REFERENCES dbo.maintenance_type_checklist_items(checklist_item_id);

    ALTER TABLE dbo.maintenance_run_checklist_progress
      CHECK CONSTRAINT FK_maintenance_run_checklist_progress_checklist_items;
  END

  IF OBJECT_ID('dbo.maintenance_run_checklist_progress') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_maintenance_run_checklist_progress_run'
         AND object_id = OBJECT_ID('dbo.maintenance_run_checklist_progress')
     )
  BEGIN
    CREATE INDEX IX_maintenance_run_checklist_progress_run
      ON dbo.maintenance_run_checklist_progress(run_id, is_done);
  END

  /* =====================================================
     dbo.maintenance_run_checklist_assignments
       - assign each checklist item to a specific engineer for this run
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_run_checklist_assignments') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_run_checklist_assignments (
      run_id INT NOT NULL,
      checklist_item_id INT NOT NULL,
      engineer_id INT NOT NULL,
      created_at DATETIME NOT NULL CONSTRAINT DF_maintenance_run_checklist_assignments_created_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_run_checklist_assignments PRIMARY KEY (run_id, checklist_item_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_run_checklist_assignments') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_run_checklist_assignments_runs'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_run_checklist_assignments')
     )
     AND OBJECT_ID('dbo.maintenance_runs') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_run_checklist_assignments WITH CHECK
      ADD CONSTRAINT FK_maintenance_run_checklist_assignments_runs
      FOREIGN KEY (run_id) REFERENCES dbo.maintenance_runs(run_id)
      ON DELETE CASCADE;

    ALTER TABLE dbo.maintenance_run_checklist_assignments
      CHECK CONSTRAINT FK_maintenance_run_checklist_assignments_runs;
  END

  IF OBJECT_ID('dbo.maintenance_run_checklist_assignments') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_run_checklist_assignments_checklist_items'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_run_checklist_assignments')
     )
     AND OBJECT_ID('dbo.maintenance_type_checklist_items') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_run_checklist_assignments WITH CHECK
      ADD CONSTRAINT FK_maintenance_run_checklist_assignments_checklist_items
      FOREIGN KEY (checklist_item_id) REFERENCES dbo.maintenance_type_checklist_items(checklist_item_id);

    ALTER TABLE dbo.maintenance_run_checklist_assignments
      CHECK CONSTRAINT FK_maintenance_run_checklist_assignments_checklist_items;
  END

  IF OBJECT_ID('dbo.maintenance_run_checklist_assignments') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_run_checklist_assignments_engineers'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_run_checklist_assignments')
     )
     AND OBJECT_ID('dbo.engineers') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_run_checklist_assignments WITH CHECK
      ADD CONSTRAINT FK_maintenance_run_checklist_assignments_engineers
      FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id);

    ALTER TABLE dbo.maintenance_run_checklist_assignments
      CHECK CONSTRAINT FK_maintenance_run_checklist_assignments_engineers;
  END

  IF OBJECT_ID('dbo.maintenance_run_checklist_assignments') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_maintenance_run_checklist_assignments_engineer'
         AND object_id = OBJECT_ID('dbo.maintenance_run_checklist_assignments')
     )
  BEGIN
    CREATE INDEX IX_maintenance_run_checklist_assignments_engineer
      ON dbo.maintenance_run_checklist_assignments(engineer_id, run_id);
  END

  /* =====================================================
     dbo.maintenance_run_notifications
       - tracks reminder sends to avoid duplicates
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_run_notifications') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_run_notifications (
      notification_id INT IDENTITY(1,1) NOT NULL,
      run_id INT NOT NULL,
      engineer_id INT NOT NULL,
      kind NVARCHAR(50) NOT NULL,
      sent_at DATETIME NULL,
      created_at DATETIME NOT NULL CONSTRAINT DF_maintenance_run_notifications_created_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_run_notifications PRIMARY KEY (notification_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_run_notifications') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_run_notifications_runs'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_run_notifications')
     )
     AND OBJECT_ID('dbo.maintenance_runs') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_run_notifications WITH CHECK
      ADD CONSTRAINT FK_maintenance_run_notifications_runs
      FOREIGN KEY (run_id) REFERENCES dbo.maintenance_runs(run_id)
      ON DELETE CASCADE;

    ALTER TABLE dbo.maintenance_run_notifications
      CHECK CONSTRAINT FK_maintenance_run_notifications_runs;
  END

  IF OBJECT_ID('dbo.maintenance_run_notifications') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_run_notifications_engineers'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_run_notifications')
     )
     AND OBJECT_ID('dbo.engineers') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_run_notifications WITH CHECK
      ADD CONSTRAINT FK_maintenance_run_notifications_engineers
      FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id);

    ALTER TABLE dbo.maintenance_run_notifications
      CHECK CONSTRAINT FK_maintenance_run_notifications_engineers;
  END

  IF OBJECT_ID('dbo.maintenance_run_notifications') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'UX_maintenance_run_notifications_unique'
         AND object_id = OBJECT_ID('dbo.maintenance_run_notifications')
     )
  BEGIN
    CREATE UNIQUE INDEX UX_maintenance_run_notifications_unique
      ON dbo.maintenance_run_notifications(run_id, engineer_id, kind);
  END

  /* =====================================================
     Seed sample maintenance types + checklist templates
       - only if table is empty
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_types') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM dbo.maintenance_types)
  BEGIN
    INSERT INTO dbo.maintenance_types(name, description)
    VALUES
      ('Security Patch', 'Routine security patching and hardening checks'),
      ('OS Update', 'Operating system upgrade/update cycle'),
      ('Hardware Check', 'Physical and sensor inspection of server hardware');

    DECLARE @securityId INT = (SELECT TOP 1 maintenance_type_id FROM dbo.maintenance_types WHERE name = 'Security Patch');
    DECLARE @osId INT = (SELECT TOP 1 maintenance_type_id FROM dbo.maintenance_types WHERE name = 'OS Update');
    DECLARE @hwId INT = (SELECT TOP 1 maintenance_type_id FROM dbo.maintenance_types WHERE name = 'Hardware Check');

    INSERT INTO dbo.maintenance_type_checklist_items(maintenance_type_id, label, sort_order)
    VALUES
      (@securityId, 'Confirm approved maintenance window', 1),
      (@securityId, 'Take backup/snapshot', 2),
      (@securityId, 'Apply security patches', 3),
      (@securityId, 'Reboot if required', 4),
      (@securityId, 'Validate services and auth logs', 5),
      (@securityId, 'Update ticket/record', 6),

      (@osId, 'Confirm maintenance window', 1),
      (@osId, 'Take backup/snapshot', 2),
      (@osId, 'Apply OS updates', 3),
      (@osId, 'Reboot and validate boot', 4),
      (@osId, 'Validate key services', 5),
      (@osId, 'Update ticket/record', 6),

      (@hwId, 'Check fans and airflow', 1),
      (@hwId, 'Check PSU redundancy', 2),
      (@hwId, 'Check disks (SMART/RAID)', 3),
      (@hwId, 'Check temperatures', 4),
      (@hwId, 'Cable inspection', 5),
      (@hwId, 'Update ticket/record', 6);
  END

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
