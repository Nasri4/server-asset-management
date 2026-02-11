/*
  Migration: Ensure foreign keys for server_monitoring
  Date: 2026-01-27

  Ensures (if possible):
    - dbo.server_monitoring.server_id -> dbo.servers(server_id)
    - dbo.server_monitoring.engineer_id -> dbo.engineers(engineer_id)

  Notes:
    - Constraints are created only if the referenced columns exist.
    - This migration is idempotent (safe to run multiple times).
*/

BEGIN TRY
  BEGIN TRAN;

  -- FK: server_monitoring.server_id -> servers.server_id
  IF COL_LENGTH('dbo.server_monitoring', 'server_id') IS NOT NULL
     AND OBJECT_ID('dbo.servers') IS NOT NULL
     AND COL_LENGTH('dbo.servers', 'server_id') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_server_monitoring_servers_server_id'
         AND parent_object_id = OBJECT_ID('dbo.server_monitoring')
     )
  BEGIN
    ALTER TABLE dbo.server_monitoring WITH CHECK
      ADD CONSTRAINT FK_server_monitoring_servers_server_id
      FOREIGN KEY (server_id)
      REFERENCES dbo.servers(server_id);

    ALTER TABLE dbo.server_monitoring CHECK CONSTRAINT FK_server_monitoring_servers_server_id;
  END

  -- FK: server_monitoring.engineer_id -> engineers.engineer_id
  IF COL_LENGTH('dbo.server_monitoring', 'engineer_id') IS NOT NULL
     AND OBJECT_ID('dbo.engineers') IS NOT NULL
     AND COL_LENGTH('dbo.engineers', 'engineer_id') IS NOT NULL
     AND NOT EXISTS (
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
