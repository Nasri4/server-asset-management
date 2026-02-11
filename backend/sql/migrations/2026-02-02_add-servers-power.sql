/*
  Adds dbo.servers.power (used by the UI for "Power" dropdown).
  Safe to run multiple times.
*/

IF OBJECT_ID('dbo.servers', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.servers', 'power') IS NULL
  BEGIN
    ALTER TABLE dbo.servers
      ADD power NVARCHAR(20) NULL;
  END

  -- Optional enum constraint (NULL allowed)
  IF COL_LENGTH('dbo.servers', 'power') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = 'CK_servers_power'
        AND parent_object_id = OBJECT_ID('dbo.servers')
    )
  BEGIN
    -- Use dynamic SQL so the constraint is compiled after the column exists.
    EXEC(N'ALTER TABLE dbo.servers WITH CHECK
      ADD CONSTRAINT CK_servers_power
      CHECK (power IS NULL OR power IN (''Single'',''Double'',''Triple'',''Quad''));');
  END
END
