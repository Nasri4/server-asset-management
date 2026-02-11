/*
  Migration: Multi maintenance types per schedule + schedule-scoped custom checklist items
  Date: 2026-02-02

  Adds:
    - dbo.maintenance_schedule_types (schedule_id <-> maintenance_type_id)
  Alters:
    - dbo.maintenance_type_checklist_items: add schedule_id (nullable) and is_custom

  Notes:
    - Idempotent and safe to re-run.
    - Keeps dbo.maintenance_schedules.maintenance_type_id as a primary/display type for backward compatibility.
*/

BEGIN TRY
  BEGIN TRAN;

  /* =====================================================
     dbo.maintenance_schedule_types
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_schedule_types') IS NULL
  BEGIN
    CREATE TABLE dbo.maintenance_schedule_types (
      schedule_id INT NOT NULL,
      maintenance_type_id INT NOT NULL,
      created_at DATETIME NOT NULL CONSTRAINT DF_maintenance_schedule_types_created_at DEFAULT(GETDATE()),
      CONSTRAINT PK_maintenance_schedule_types PRIMARY KEY (schedule_id, maintenance_type_id)
    );
  END

  IF OBJECT_ID('dbo.maintenance_schedule_types') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_schedule_types_schedules'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_schedule_types')
     )
     AND OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_schedule_types WITH CHECK
      ADD CONSTRAINT FK_maintenance_schedule_types_schedules
      FOREIGN KEY (schedule_id) REFERENCES dbo.maintenance_schedules(schedule_id)
      ON DELETE CASCADE;

    ALTER TABLE dbo.maintenance_schedule_types
      CHECK CONSTRAINT FK_maintenance_schedule_types_schedules;
  END

  IF OBJECT_ID('dbo.maintenance_schedule_types') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_schedule_types_types'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_schedule_types')
     )
     AND OBJECT_ID('dbo.maintenance_types') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_schedule_types WITH CHECK
      ADD CONSTRAINT FK_maintenance_schedule_types_types
      FOREIGN KEY (maintenance_type_id) REFERENCES dbo.maintenance_types(maintenance_type_id);

    ALTER TABLE dbo.maintenance_schedule_types
      CHECK CONSTRAINT FK_maintenance_schedule_types_types;
  END

  IF OBJECT_ID('dbo.maintenance_schedule_types') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_maintenance_schedule_types_schedule'
         AND object_id = OBJECT_ID('dbo.maintenance_schedule_types')
     )
  BEGIN
    CREATE INDEX IX_maintenance_schedule_types_schedule
      ON dbo.maintenance_schedule_types(schedule_id, maintenance_type_id);
  END

  /* Backfill from existing schedules (single-type) */
  IF OBJECT_ID('dbo.maintenance_schedule_types') IS NOT NULL
     AND OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
  BEGIN
    INSERT INTO dbo.maintenance_schedule_types(schedule_id, maintenance_type_id)
    SELECT s.schedule_id, s.maintenance_type_id
    FROM dbo.maintenance_schedules s
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.maintenance_schedule_types st
      WHERE st.schedule_id = s.schedule_id
        AND st.maintenance_type_id = s.maintenance_type_id
    );
  END

  /* =====================================================
     dbo.maintenance_type_checklist_items: schedule_id + is_custom
  ====================================================== */

  IF OBJECT_ID('dbo.maintenance_type_checklist_items') IS NOT NULL
     AND COL_LENGTH('dbo.maintenance_type_checklist_items', 'schedule_id') IS NULL
  BEGIN
    ALTER TABLE dbo.maintenance_type_checklist_items ADD schedule_id INT NULL;
  END

  IF OBJECT_ID('dbo.maintenance_type_checklist_items') IS NOT NULL
     AND COL_LENGTH('dbo.maintenance_type_checklist_items', 'is_custom') IS NULL
  BEGIN
    ALTER TABLE dbo.maintenance_type_checklist_items
      ADD is_custom BIT NOT NULL CONSTRAINT DF_maintenance_type_checklist_items_is_custom DEFAULT(0);
  END

  IF OBJECT_ID('dbo.maintenance_type_checklist_items') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_maintenance_type_checklist_items_schedules'
         AND parent_object_id = OBJECT_ID('dbo.maintenance_type_checklist_items')
     )
     AND OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
     AND COL_LENGTH('dbo.maintenance_type_checklist_items', 'schedule_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_type_checklist_items WITH CHECK
      ADD CONSTRAINT FK_maintenance_type_checklist_items_schedules
      FOREIGN KEY (schedule_id) REFERENCES dbo.maintenance_schedules(schedule_id)
      ON DELETE CASCADE;

    ALTER TABLE dbo.maintenance_type_checklist_items
      CHECK CONSTRAINT FK_maintenance_type_checklist_items_schedules;
  END

  IF OBJECT_ID('dbo.maintenance_type_checklist_items') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_maintenance_type_checklist_items_schedule'
         AND object_id = OBJECT_ID('dbo.maintenance_type_checklist_items')
     )
     AND COL_LENGTH('dbo.maintenance_type_checklist_items', 'schedule_id') IS NOT NULL
  BEGIN
    CREATE INDEX IX_maintenance_type_checklist_items_schedule
      ON dbo.maintenance_type_checklist_items(schedule_id, maintenance_type_id, sort_order);
  END

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
