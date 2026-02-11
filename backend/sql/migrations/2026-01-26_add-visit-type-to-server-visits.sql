/*
  Migration: Add visit_type to server_visits (backward-compatible)
  Date: 2026-01-26

  Adds (if missing):
    - dbo.server_visits.visit_type NVARCHAR(100) NULL

  If an older schema uses a different column name, attempts to backfill:
    - dbo.server_visits.[type] -> visit_type
    - dbo.server_visits.visitType -> visit_type

  Notes:
    - Column is nullable for backward compatibility.
*/

BEGIN TRY
  BEGIN TRAN;

  IF COL_LENGTH('dbo.server_visits', 'visit_type') IS NULL
  BEGIN
    ALTER TABLE dbo.server_visits ADD visit_type NVARCHAR(100) NULL;
  END

  -- Backfill from older column names if present
  -- NOTE: SQL Server validates column names at compile time for the whole batch.
  -- Because we add visit_type above, we must run these updates via dynamic SQL.

  IF COL_LENGTH('dbo.server_visits', 'visit_type') IS NOT NULL
     AND COL_LENGTH('dbo.server_visits', 'type') IS NOT NULL
  BEGIN
    EXEC sp_executesql N'
      UPDATE dbo.server_visits
      SET visit_type = COALESCE(visit_type, CAST([type] AS NVARCHAR(100)))
      WHERE visit_type IS NULL;
    ';
  END

  IF COL_LENGTH('dbo.server_visits', 'visit_type') IS NOT NULL
     AND COL_LENGTH('dbo.server_visits', 'visitType') IS NOT NULL
  BEGIN
    EXEC sp_executesql N'
      UPDATE dbo.server_visits
      SET visit_type = COALESCE(visit_type, CAST(visitType AS NVARCHAR(100)))
      WHERE visit_type IS NULL;
    ';
  END

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
