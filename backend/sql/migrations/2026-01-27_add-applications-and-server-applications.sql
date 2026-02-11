/*
  Migration: Align applications + server_applications schema
  Date: 2026-01-27

  Ensures (adds if missing):
    dbo.applications
      - app_name NVARCHAR(200)
      - app_type NVARCHAR(100)
      - version NVARCHAR(50)
      - criticality NVARCHAR(50)
      - sla_level NVARCHAR(50)

    dbo.server_applications
      - ports NVARCHAR(200)
      - database_type NVARCHAR(100)
      - owner_team_id INT

  Also ensures foreign keys (if possible):
    - server_applications.server_id -> servers.server_id
    - server_applications.application_id -> applications.application_id
    - server_applications.owner_team_id -> teams.team_id

  Notes:
    - Idempotent (safe to run multiple times).
    - Does not drop existing legacy columns.
*/

BEGIN TRY
  BEGIN TRAN;

  -- dbo.applications columns
  IF OBJECT_ID('dbo.applications') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.applications', 'app_name') IS NULL
    BEGIN
      ALTER TABLE dbo.applications ADD app_name NVARCHAR(200) NULL;
    END

    IF COL_LENGTH('dbo.applications', 'app_type') IS NULL
    BEGIN
      ALTER TABLE dbo.applications ADD app_type NVARCHAR(100) NULL;
    END

    IF COL_LENGTH('dbo.applications', 'version') IS NULL
    BEGIN
      ALTER TABLE dbo.applications ADD version NVARCHAR(50) NULL;
    END

    IF COL_LENGTH('dbo.applications', 'criticality') IS NULL
    BEGIN
      ALTER TABLE dbo.applications ADD criticality NVARCHAR(50) NULL;
    END

    IF COL_LENGTH('dbo.applications', 'sla_level') IS NULL
    BEGIN
      ALTER TABLE dbo.applications ADD sla_level NVARCHAR(50) NULL;
    END

    -- Backfill app_name from legacy name if present.
    IF COL_LENGTH('dbo.applications', 'name') IS NOT NULL
    BEGIN
      DECLARE @backfill_app_name_sql NVARCHAR(MAX) = N'
        UPDATE dbo.applications
        SET app_name = COALESCE(app_name, [name])
        WHERE app_name IS NULL;
      ';

      EXEC sys.sp_executesql @backfill_app_name_sql;
    END
  END

  -- dbo.server_applications columns
  IF OBJECT_ID('dbo.server_applications') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.server_applications', 'ports') IS NULL
    BEGIN
      ALTER TABLE dbo.server_applications ADD ports NVARCHAR(200) NULL;
    END

    IF COL_LENGTH('dbo.server_applications', 'database_type') IS NULL
    BEGIN
      ALTER TABLE dbo.server_applications ADD database_type NVARCHAR(100) NULL;
    END

    IF COL_LENGTH('dbo.server_applications', 'owner_team_id') IS NULL
    BEGIN
      ALTER TABLE dbo.server_applications ADD owner_team_id INT NULL;
    END
  END

  -- FK: server_applications.server_id -> servers.server_id
  IF OBJECT_ID('dbo.server_applications') IS NOT NULL
     AND COL_LENGTH('dbo.server_applications', 'server_id') IS NOT NULL
     AND OBJECT_ID('dbo.servers') IS NOT NULL
     AND COL_LENGTH('dbo.servers', 'server_id') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_server_applications_servers_server_id'
         AND parent_object_id = OBJECT_ID('dbo.server_applications')
     )
  BEGIN
    ALTER TABLE dbo.server_applications WITH CHECK
      ADD CONSTRAINT FK_server_applications_servers_server_id
      FOREIGN KEY (server_id)
      REFERENCES dbo.servers(server_id);

    ALTER TABLE dbo.server_applications CHECK CONSTRAINT FK_server_applications_servers_server_id;
  END

  -- FK: server_applications.application_id -> applications.application_id
  IF OBJECT_ID('dbo.server_applications') IS NOT NULL
     AND COL_LENGTH('dbo.server_applications', 'application_id') IS NOT NULL
     AND OBJECT_ID('dbo.applications') IS NOT NULL
     AND COL_LENGTH('dbo.applications', 'application_id') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_server_applications_applications_application_id'
         AND parent_object_id = OBJECT_ID('dbo.server_applications')
     )
  BEGIN
    ALTER TABLE dbo.server_applications WITH CHECK
      ADD CONSTRAINT FK_server_applications_applications_application_id
      FOREIGN KEY (application_id)
      REFERENCES dbo.applications(application_id);

    ALTER TABLE dbo.server_applications CHECK CONSTRAINT FK_server_applications_applications_application_id;
  END

  -- FK: server_applications.owner_team_id -> teams.team_id
  IF OBJECT_ID('dbo.server_applications') IS NOT NULL
     AND COL_LENGTH('dbo.server_applications', 'owner_team_id') IS NOT NULL
     AND OBJECT_ID('dbo.teams') IS NOT NULL
     AND COL_LENGTH('dbo.teams', 'team_id') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_server_applications_teams_owner_team_id'
         AND parent_object_id = OBJECT_ID('dbo.server_applications')
     )
  BEGIN
    ALTER TABLE dbo.server_applications WITH CHECK
      ADD CONSTRAINT FK_server_applications_teams_owner_team_id
      FOREIGN KEY (owner_team_id)
      REFERENCES dbo.teams(team_id);

    ALTER TABLE dbo.server_applications CHECK CONSTRAINT FK_server_applications_teams_owner_team_id;
  END

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
