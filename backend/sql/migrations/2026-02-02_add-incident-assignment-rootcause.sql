/*
  Adds incident fields used by the UI and API:
  - engineer_id (FK to dbo.engineers)
  - root_cause, resolution
  - reported_at default

  Safe to run multiple times.
*/

-- Columns
IF COL_LENGTH('dbo.server_incidents', 'engineer_id') IS NULL
BEGIN
  ALTER TABLE dbo.server_incidents ADD engineer_id INT NULL;
END

IF COL_LENGTH('dbo.server_incidents', 'root_cause') IS NULL
BEGIN
  ALTER TABLE dbo.server_incidents ADD root_cause NVARCHAR(MAX) NULL;
END

IF COL_LENGTH('dbo.server_incidents', 'resolution') IS NULL
BEGIN
  ALTER TABLE dbo.server_incidents ADD resolution NVARCHAR(MAX) NULL;
END

IF COL_LENGTH('dbo.server_incidents', 'reported_at') IS NOT NULL
BEGIN
  -- If the column exists but has no default, add a default constraint (name-checked).
  IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.default_object_id = dc.object_id
    JOIN sys.tables t ON t.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'dbo' AND t.name = 'server_incidents' AND c.name = 'reported_at'
  )
  BEGIN
    ALTER TABLE dbo.server_incidents
      ADD CONSTRAINT DF_server_incidents_reported_at DEFAULT (GETDATE()) FOR reported_at;

    -- Backfill any existing NULLs
    UPDATE dbo.server_incidents SET reported_at = COALESCE(reported_at, created_at, GETDATE());
  END
END

-- FK to engineers (optional)
IF COL_LENGTH('dbo.server_incidents', 'engineer_id') IS NOT NULL
  AND COL_LENGTH('dbo.engineers', 'engineer_id') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_server_incidents_engineer'
  )
  BEGIN
    ALTER TABLE dbo.server_incidents WITH CHECK
      ADD CONSTRAINT FK_server_incidents_engineer
      FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;

    ALTER TABLE dbo.server_incidents CHECK CONSTRAINT FK_server_incidents_engineer;
  END
END

-- Helpful index
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_server_incidents_engineer_id'
    AND object_id = OBJECT_ID('dbo.server_incidents')
)
BEGIN
  CREATE INDEX IX_server_incidents_engineer_id ON dbo.server_incidents(engineer_id);
END
