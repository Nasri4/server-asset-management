/*
  Migration: Maintenance scheduling + reminders
  Date: 2026-01-27

  Goal:
    - Stop relying on server_maintenance.maintenance_window (do not drop; app will ignore it)
    - Add server_maintenance.maintenance_frequency (Daily/Weekly/Monthly)
    - Add supporting tables:
        dbo.maintenance_assignments
        dbo.maintenance_progress
        dbo.maintenance_reminders

  Notes:
    - Idempotent (safe to run multiple times)
    - Adds constraints/FKs only if possible
*/

BEGIN TRY
  BEGIN TRAN;

  /* =====================================================
     server_maintenance: maintenance_frequency
  ====================================================== */

  IF OBJECT_ID('dbo.server_maintenance') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.server_maintenance', 'maintenance_frequency') IS NULL
    BEGIN
      ALTER TABLE dbo.server_maintenance
        ADD maintenance_frequency NVARCHAR(20) NULL;
    END

    IF COL_LENGTH('dbo.server_maintenance', 'maintenance_frequency') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE parent_object_id = OBJECT_ID('dbo.server_maintenance')
          AND name IN ('CK_server_maintenance_maintenance_frequency','CK_server_maintenance_frequency')
      )
    BEGIN
      EXEC(N'ALTER TABLE dbo.server_maintenance
        ADD CONSTRAINT CK_server_maintenance_maintenance_frequency
        CHECK (maintenance_frequency IN (''Daily'',''Weekly'',''Monthly''));');
    END
  END

  /* =====================================================
     dbo.maintenance_assignments
       - supports multiple engineers per maintenance
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_assignments') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_assignments (
      maintenance_id INT NOT NULL,
      engineer_id INT NOT NULL,
      is_active BIT NOT NULL CONSTRAINT DF_maintenance_assignments_is_active DEFAULT(1),
      created_at DATETIME NOT NULL CONSTRAINT DF_maintenance_assignments_created_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_assignments PRIMARY KEY (maintenance_id, engineer_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_assignments') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_assignments_server_maintenance_maintenance_id'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_assignments')
     )
     AND OBJECT_ID('dbo.server_maintenance') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_assignments WITH CHECK
      ADD CONSTRAINT FK_maintenance_assignments_server_maintenance_maintenance_id
      FOREIGN KEY (maintenance_id) REFERENCES dbo.server_maintenance(maintenance_id);

    ALTER TABLE dbo.maintenance_assignments CHECK CONSTRAINT FK_maintenance_assignments_server_maintenance_maintenance_id;
  END

  IF OBJECT_ID('dbo.maintenance_assignments') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_assignments_engineers_engineer_id'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_assignments')
     )
     AND OBJECT_ID('dbo.engineers') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_assignments WITH CHECK
      ADD CONSTRAINT FK_maintenance_assignments_engineers_engineer_id
      FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id);

    ALTER TABLE dbo.maintenance_assignments CHECK CONSTRAINT FK_maintenance_assignments_engineers_engineer_id;
  END

  /* =====================================================
     dbo.maintenance_progress
       - one row per maintenance
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_progress') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_progress (
      maintenance_id INT NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_maintenance_progress_status DEFAULT('Incomplete'),
      note NVARCHAR(500) NULL,
      completed_at DATETIME NULL,
      updated_at DATETIME NOT NULL CONSTRAINT DF_maintenance_progress_updated_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_progress PRIMARY KEY (maintenance_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_progress') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.check_constraints
       WHERE name = 'CK_maintenance_progress_status'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_progress')
     )
  BEGIN
    ALTER TABLE dbo.maintenance_progress
      ADD CONSTRAINT CK_maintenance_progress_status
      CHECK (status IN ('Incomplete','Complete'));
  END

  IF OBJECT_ID('dbo.maintenance_progress') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_progress_server_maintenance_maintenance_id'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_progress')
     )
     AND OBJECT_ID('dbo.server_maintenance') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_progress WITH CHECK
      ADD CONSTRAINT FK_maintenance_progress_server_maintenance_maintenance_id
      FOREIGN KEY (maintenance_id) REFERENCES dbo.server_maintenance(maintenance_id);

    ALTER TABLE dbo.maintenance_progress CHECK CONSTRAINT FK_maintenance_progress_server_maintenance_maintenance_id;
  END

  /* =====================================================
     dbo.maintenance_reminders
       - reminder_date is 1 day before next_maintenance
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_reminders') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_reminders (
      reminder_id INT IDENTITY(1,1) NOT NULL,
      maintenance_id INT NOT NULL,
      reminder_date DATETIME NOT NULL,
      reminder_type NVARCHAR(20) NOT NULL CONSTRAINT DF_maintenance_reminders_type DEFAULT('Before1Day'),
      is_sent BIT NOT NULL CONSTRAINT DF_maintenance_reminders_is_sent DEFAULT(0),
      created_at DATETIME NOT NULL CONSTRAINT DF_maintenance_reminders_created_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_reminders PRIMARY KEY (reminder_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_reminders') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_reminders_server_maintenance_maintenance_id'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_reminders')
     )
     AND OBJECT_ID('dbo.server_maintenance') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_reminders WITH CHECK
      ADD CONSTRAINT FK_maintenance_reminders_server_maintenance_maintenance_id
      FOREIGN KEY (maintenance_id) REFERENCES dbo.server_maintenance(maintenance_id);

    ALTER TABLE dbo.maintenance_reminders CHECK CONSTRAINT FK_maintenance_reminders_server_maintenance_maintenance_id;
  END

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
