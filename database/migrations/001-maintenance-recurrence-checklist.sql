-- Optional: Add recurrence and checklist support to maintenance
-- Run against TELCO_ASSET_MGMT database when you want these features.
USE TELCO_ASSET_MGMT;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance') AND name = 'recurrence_type')
BEGIN
  ALTER TABLE maintenance ADD recurrence_type NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance') AND name = 'recurrence_interval')
BEGIN
  ALTER TABLE maintenance ADD recurrence_interval INT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance') AND name = 'next_scheduled_date')
BEGIN
  ALTER TABLE maintenance ADD next_scheduled_date DATETIME NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('maintenance') AND name = 'checklist_tasks')
BEGIN
  ALTER TABLE maintenance ADD checklist_tasks NVARCHAR(MAX) NULL; -- JSON array of { task: string, done: boolean }
END
GO
