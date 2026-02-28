USE TELCO_ASSET_MGMT;
GO

IF OBJECT_ID('dbo.maintenance', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.maintenance') AND name = 'recurrence_type')
    ALTER TABLE dbo.maintenance ADD recurrence_type NVARCHAR(50) NULL;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.maintenance') AND name = 'recurrence_interval')
    ALTER TABLE dbo.maintenance ADD recurrence_interval INT NULL;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.maintenance') AND name = 'next_scheduled_date')
    ALTER TABLE dbo.maintenance ADD next_scheduled_date DATETIME NULL;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.maintenance') AND name = 'checklist_tasks')
    ALTER TABLE dbo.maintenance ADD checklist_tasks NVARCHAR(MAX) NULL;

  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.maintenance') AND name = 'template_id')
    ALTER TABLE dbo.maintenance ADD template_id INT NULL;
END
GO

IF OBJECT_ID('dbo.maintenance_templates', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.maintenance_templates (
    template_id INT IDENTITY(1,1) PRIMARY KEY,
    template_name NVARCHAR(120) NOT NULL,
    maintenance_type NVARCHAR(50) NOT NULL,
    default_priority NVARCHAR(20) NULL,
    default_description NVARCHAR(500) NULL,
    checklist_tasks NVARCHAR(MAX) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_maintenance_templates_created_by FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END
GO

IF OBJECT_ID('dbo.maintenance_runs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.maintenance_runs (
    run_id INT IDENTITY(1,1) PRIMARY KEY,
    maintenance_id INT NOT NULL,
    run_status NVARCHAR(30) NOT NULL DEFAULT 'Pending',
    run_result NVARCHAR(30) NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    completion_notes NVARCHAR(1000) NULL,
    completed_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_maintenance_runs_maintenance FOREIGN KEY (maintenance_id) REFERENCES dbo.maintenance(maintenance_id),
    CONSTRAINT FK_maintenance_runs_completed_by FOREIGN KEY (completed_by) REFERENCES dbo.users(user_id)
  );
END
GO

IF OBJECT_ID('dbo.maintenance', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.maintenance_templates', 'U') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
     FROM sys.foreign_keys
     WHERE name = 'FK_maintenance_template_id'
       AND parent_object_id = OBJECT_ID('dbo.maintenance')
   )
BEGIN
  ALTER TABLE dbo.maintenance
    ADD CONSTRAINT FK_maintenance_template_id
    FOREIGN KEY (template_id) REFERENCES dbo.maintenance_templates(template_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_maintenance_runs_maintenance_id' AND object_id = OBJECT_ID('dbo.maintenance_runs'))
  CREATE INDEX IX_maintenance_runs_maintenance_id ON dbo.maintenance_runs(maintenance_id, created_at DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_maintenance_runs_status' AND object_id = OBJECT_ID('dbo.maintenance_runs'))
  CREATE INDEX IX_maintenance_runs_status ON dbo.maintenance_runs(run_status, completed_at DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_maintenance_scheduled_status' AND object_id = OBJECT_ID('dbo.maintenance'))
  CREATE INDEX IX_maintenance_scheduled_status ON dbo.maintenance(status, scheduled_date DESC);
GO
