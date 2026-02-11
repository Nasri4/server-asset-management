/*
  Migration: Add engineer assignment for servers
  Date: 2026-01-26

  Adds:
    - dbo.servers.engineer_id (INT, nullable for backward compatibility)
    - FK: dbo.servers.engineer_id -> dbo.engineers.engineer_id

  Notes:
    - Column is nullable to avoid breaking existing rows.
    - After backfilling engineer_id for all rows, you may optionally make it NOT NULL.
*/

BEGIN TRY
  BEGIN TRAN;

  IF COL_LENGTH('dbo.servers', 'engineer_id') IS NULL
  BEGIN
    ALTER TABLE dbo.servers
      ADD engineer_id INT NULL;
  END

  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_servers_engineers_engineer_id'
      AND parent_object_id = OBJECT_ID('dbo.servers')
  )
  BEGIN
    ALTER TABLE dbo.servers WITH CHECK
      ADD CONSTRAINT FK_servers_engineers_engineer_id
      FOREIGN KEY (engineer_id)
      REFERENCES dbo.engineers(engineer_id);

    ALTER TABLE dbo.servers CHECK CONSTRAINT FK_servers_engineers_engineer_id;
  END

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;

-- Optional (run later after backfill):
-- ALTER TABLE dbo.servers ALTER COLUMN engineer_id INT NOT NULL;
