/*
  Migration: Fix maintenance_frequency on server_maintenance
  Date: 2026-01-28

  Adds:
    - dbo.server_maintenance.maintenance_frequency (Daily/Weekly/Monthly)
    - check constraint CK_server_maintenance_maintenance_frequency

  Notes:
    - Idempotent (safe to run multiple times)
    - Designed for SQL Server
*/

BEGIN TRY
  BEGIN TRAN;

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

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
