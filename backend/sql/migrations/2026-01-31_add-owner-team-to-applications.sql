/*
  Migration: Add owner_team_id to applications table
  Date: 2026-01-31

  Ensures:
    dbo.applications.owner_team_id INT NULL
    FK: applications.owner_team_id -> teams.team_id

  Notes:
    - Idempotent (safe to run multiple times)
    - Also adds description column if missing
*/

BEGIN TRY
  BEGIN TRAN;

  -- Add owner_team_id column to applications table if it doesn't exist
  IF OBJECT_ID('dbo.applications') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.applications', 'owner_team_id') IS NULL
    BEGIN
      ALTER TABLE dbo.applications ADD owner_team_id INT NULL;
      PRINT 'Added owner_team_id column to dbo.applications';
    END
    ELSE
    BEGIN
      PRINT 'owner_team_id column already exists in dbo.applications';
    END

    -- Add description column if it doesn't exist
    IF COL_LENGTH('dbo.applications', 'description') IS NULL
    BEGIN
      ALTER TABLE dbo.applications ADD description NVARCHAR(MAX) NULL;
      PRINT 'Added description column to dbo.applications';
    END
    ELSE
    BEGIN
      PRINT 'description column already exists in dbo.applications';
    END
  END

  -- Add foreign key constraint if it doesn't exist
  IF OBJECT_ID('dbo.applications') IS NOT NULL
     AND COL_LENGTH('dbo.applications', 'owner_team_id') IS NOT NULL
     AND OBJECT_ID('dbo.teams') IS NOT NULL
     AND COL_LENGTH('dbo.teams', 'team_id') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE name = 'FK_applications_teams_owner_team_id'
         AND parent_object_id = OBJECT_ID('dbo.applications')
     )
  BEGIN
    ALTER TABLE dbo.applications WITH CHECK
      ADD CONSTRAINT FK_applications_teams_owner_team_id
      FOREIGN KEY (owner_team_id)
      REFERENCES dbo.teams(team_id);

    ALTER TABLE dbo.applications CHECK CONSTRAINT FK_applications_teams_owner_team_id;
    PRINT 'Added FK constraint FK_applications_teams_owner_team_id';
  END
  ELSE
  BEGIN
    PRINT 'FK constraint FK_applications_teams_owner_team_id already exists';
  END

  COMMIT TRAN;
  PRINT 'Migration completed successfully';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  
  DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
  DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
  DECLARE @ErrorState INT = ERROR_STATE();
  
  PRINT 'Migration failed: ' + @ErrorMessage;
  RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH;
