-- Adds engineer assignment to servers.
-- After running this, the API can store engineer_id on dbo.servers.

-- 1) Add the column if it doesn't exist
IF COL_LENGTH('dbo.servers', 'engineer_id') IS NULL
BEGIN
  ALTER TABLE dbo.servers
  ADD engineer_id INT NULL;
END
GO

-- 2) Add foreign key if it doesn't exist
IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_servers_engineers_engineer_id'
)
BEGIN
  ALTER TABLE dbo.servers
  WITH CHECK ADD CONSTRAINT FK_servers_engineers_engineer_id
  FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id);
END
GO

-- 3) Index for faster filtering
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_servers_engineer_id' AND object_id = OBJECT_ID('dbo.servers')
)
BEGIN
  CREATE INDEX IX_servers_engineer_id ON dbo.servers(engineer_id);
END
GO
