/*
  Migration: Add engineer references & notes to ops tables
  Date: 2026-01-26

  Adds (if missing):
    - dbo.server_visits.engineer_id INT NULL + FK to dbo.engineers
    - dbo.server_visits.visit_notes NVARCHAR(MAX) NULL

    - dbo.server_maintenance.engineer_id INT NULL + FK to dbo.engineers
    - dbo.server_maintenance.notes NVARCHAR(MAX) NULL

    - dbo.server_incidents.engineer_id INT NULL + FK to dbo.engineers
    - dbo.server_monitoring.engineer_id INT NULL + FK to dbo.engineers

  Notes:
    - Columns are nullable for backward compatibility.
*/

BEGIN TRY
  BEGIN TRAN;

  -- server_visits
  IF COL_LENGTH('dbo.server_visits', 'engineer_id') IS NULL
  BEGIN
    ALTER TABLE dbo.server_visits ADD engineer_id INT NULL;
  END

  IF COL_LENGTH('dbo.server_visits', 'visit_notes') IS NULL
  BEGIN
    ALTER TABLE dbo.server_visits ADD visit_notes NVARCHAR(MAX) NULL;
  END

  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_server_visits_engineers_engineer_id'
      AND parent_object_id = OBJECT_ID('dbo.server_visits')
  )
  BEGIN
    ALTER TABLE dbo.server_visits WITH CHECK
      ADD CONSTRAINT FK_server_visits_engineers_engineer_id
      FOREIGN KEY (engineer_id)
      REFERENCES dbo.engineers(engineer_id);

    ALTER TABLE dbo.server_visits CHECK CONSTRAINT FK_server_visits_engineers_engineer_id;
  END

  -- server_maintenance
  IF COL_LENGTH('dbo.server_maintenance', 'engineer_id') IS NULL
  BEGIN
    ALTER TABLE dbo.server_maintenance ADD engineer_id INT NULL;
  END

  IF COL_LENGTH('dbo.server_maintenance', 'notes') IS NULL
  BEGIN
    ALTER TABLE dbo.server_maintenance ADD notes NVARCHAR(MAX) NULL;
  END

  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_server_maintenance_engineers_engineer_id'
      AND parent_object_id = OBJECT_ID('dbo.server_maintenance')
  )
  BEGIN
    ALTER TABLE dbo.server_maintenance WITH CHECK
      ADD CONSTRAINT FK_server_maintenance_engineers_engineer_id
      FOREIGN KEY (engineer_id)
      REFERENCES dbo.engineers(engineer_id);

    ALTER TABLE dbo.server_maintenance CHECK CONSTRAINT FK_server_maintenance_engineers_engineer_id;
  END

  -- server_incidents
  IF COL_LENGTH('dbo.server_incidents', 'engineer_id') IS NULL
  BEGIN
    ALTER TABLE dbo.server_incidents ADD engineer_id INT NULL;
  END

  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_server_incidents_engineers_engineer_id'
      AND parent_object_id = OBJECT_ID('dbo.server_incidents')
  )
  BEGIN
    ALTER TABLE dbo.server_incidents WITH CHECK
      ADD CONSTRAINT FK_server_incidents_engineers_engineer_id
      FOREIGN KEY (engineer_id)
      REFERENCES dbo.engineers(engineer_id);

    ALTER TABLE dbo.server_incidents CHECK CONSTRAINT FK_server_incidents_engineers_engineer_id;
  END

  -- server_monitoring
  IF COL_LENGTH('dbo.server_monitoring', 'engineer_id') IS NULL
  BEGIN
    ALTER TABLE dbo.server_monitoring ADD engineer_id INT NULL;
  END

  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_server_monitoring_engineers_engineer_id'
      AND parent_object_id = OBJECT_ID('dbo.server_monitoring')
  )
  BEGIN
    ALTER TABLE dbo.server_monitoring WITH CHECK
      ADD CONSTRAINT FK_server_monitoring_engineers_engineer_id
      FOREIGN KEY (engineer_id)
      REFERENCES dbo.engineers(engineer_id);

    ALTER TABLE dbo.server_monitoring CHECK CONSTRAINT FK_server_monitoring_engineers_engineer_id;
  END

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
