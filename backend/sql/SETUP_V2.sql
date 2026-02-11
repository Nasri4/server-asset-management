-- =====================================================
-- COMPLETE V2 SETUP SCRIPT
-- Run this script to set up all V2 features and create first admin user
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'SERVER ASSET MANAGEMENT V2 SETUP';
PRINT '========================================';
PRINT '';

-- =====================================================
-- STEP 1: Create Auth Tables (Users, Roles)
-- =====================================================
PRINT 'STEP 1: Creating Auth Tables...';
PRINT '';

SET XACT_ABORT ON;
BEGIN TRAN;

  /* USERS */
  IF OBJECT_ID('dbo.Users', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.Users (
      user_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
      username NVARCHAR(100) NOT NULL,
      password_hash NVARCHAR(200) NULL,
      full_name NVARCHAR(200) NULL,
      team_id INT NOT NULL,
      is_active BIT NOT NULL CONSTRAINT DF_Users_is_active DEFAULT (1),
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_Users_created_at DEFAULT (SYSUTCDATETIME())
    );
    PRINT '  ✓ Created Users table';
  END
  ELSE
  BEGIN
    PRINT '  ✓ Users table already exists';
  END

  -- Unique username
  IF COL_LENGTH('dbo.Users', 'username_uq') IS NULL
  BEGIN
    IF COL_LENGTH('dbo.Users', 'user_id') IS NOT NULL AND COL_LENGTH('dbo.Users', 'username') IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE dbo.Users ADD username_uq AS (CASE WHEN username IS NULL THEN ''##NULL##'' + RIGHT(''0000000000'' + CAST(user_id AS VARCHAR(10)), 10) ELSE username END) PERSISTED');
      PRINT '  ✓ Added username_uq computed column';
    END
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Users_username_uq' AND object_id = OBJECT_ID('dbo.Users'))
  BEGIN
    EXEC('CREATE UNIQUE INDEX UQ_Users_username_uq ON dbo.Users(username_uq)');
    PRINT '  ✓ Created unique index on username';
  END

  /* ROLES */
  IF OBJECT_ID('dbo.roles', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.roles (
      role_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_roles PRIMARY KEY,
      role_name NVARCHAR(50) NOT NULL
    );
    PRINT '  ✓ Created roles table';
  END
  ELSE
  BEGIN
    PRINT '  ✓ Roles table already exists';
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_roles_role_name' AND object_id = OBJECT_ID('dbo.roles'))
  BEGIN
    EXEC('CREATE UNIQUE INDEX UQ_roles_role_name ON dbo.roles(role_name)');
  END

  -- Seed default roles
  IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE LOWER(role_name) = 'admin')
  BEGIN
    INSERT INTO dbo.roles(role_name) VALUES ('Admin');
    PRINT '  ✓ Seeded Admin role';
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE LOWER(role_name) = 'engineer')
  BEGIN
    INSERT INTO dbo.roles(role_name) VALUES ('Engineer');
    PRINT '  ✓ Seeded Engineer role';
  END

  /* USER_ROLES */
  IF OBJECT_ID('dbo.user_roles', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.user_roles (
      user_id INT NOT NULL,
      role_id INT NOT NULL,
      CONSTRAINT PK_user_roles PRIMARY KEY (user_id, role_id)
    );
    PRINT '  ✓ Created user_roles table';
  END
  ELSE
  BEGIN
    PRINT '  ✓ User_roles table already exists';
  END

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_roles_users' AND parent_object_id = OBJECT_ID('dbo.user_roles'))
    ALTER TABLE dbo.user_roles WITH CHECK ADD CONSTRAINT FK_user_roles_users FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id);

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_roles_roles' AND parent_object_id = OBJECT_ID('dbo.user_roles'))
    ALTER TABLE dbo.user_roles WITH CHECK ADD CONSTRAINT FK_user_roles_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id);

  /* ROLE_PERMISSIONS */
  IF OBJECT_ID('dbo.role_permissions', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.role_permissions (
      role_id INT NOT NULL,
      permission_key NVARCHAR(100) NOT NULL,
      CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_key)
    );
    PRINT '  ✓ Created role_permissions table';
  END
  ELSE
  BEGIN
    PRINT '  ✓ Role_permissions table already exists';
  END

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_role_permissions_roles' AND parent_object_id = OBJECT_ID('dbo.role_permissions'))
    ALTER TABLE dbo.role_permissions WITH CHECK ADD CONSTRAINT FK_role_permissions_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id);

  -- Seed Admin permissions (full access)
  DECLARE @adminRoleId INT = (SELECT role_id FROM dbo.roles WHERE LOWER(role_name) = 'admin');
  
  IF @adminRoleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions WHERE role_id = @adminRoleId)
  BEGIN
    INSERT INTO dbo.role_permissions (role_id, permission_key) VALUES
      (@adminRoleId, 'servers.create'),
      (@adminRoleId, 'servers.read'),
      (@adminRoleId, 'servers.update'),
      (@adminRoleId, 'servers.delete'),
      (@adminRoleId, 'incidents.create'),
      (@adminRoleId, 'incidents.update'),
      (@adminRoleId, 'maintenance.create'),
      (@adminRoleId, 'maintenance.update'),
      (@adminRoleId, 'users.manage'),
      (@adminRoleId, 'audit.read');
    PRINT '  ✓ Seeded Admin permissions';
  END

  -- Seed Engineer permissions (limited access)
  DECLARE @engineerRoleId INT = (SELECT role_id FROM dbo.roles WHERE LOWER(role_name) = 'engineer');
  
  IF @engineerRoleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions WHERE role_id = @engineerRoleId)
  BEGIN
    INSERT INTO dbo.role_permissions (role_id, permission_key) VALUES
      (@engineerRoleId, 'servers.read'),
      (@engineerRoleId, 'incidents.create'),
      (@engineerRoleId, 'incidents.update'),
      (@engineerRoleId, 'maintenance.read');
    PRINT '  ✓ Seeded Engineer permissions';
  END

COMMIT TRAN;

PRINT '';
PRINT 'STEP 1 COMPLETE: Auth tables created';
PRINT '';

-- =====================================================
-- STEP 2: Create V2 Feature Tables
-- =====================================================
PRINT 'STEP 2: Creating V2 Feature Tables...';
PRINT '';

-- Activity Log
IF OBJECT_ID('dbo.activity_log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.activity_log (
        activity_id BIGINT IDENTITY(1,1) NOT NULL,
        event_type NVARCHAR(100) NOT NULL,
        resource_type NVARCHAR(50) NOT NULL,
        resource_id NVARCHAR(100) NOT NULL,
        actor_id INT NULL,
        actor_name NVARCHAR(200) NULL,
        actor_type NVARCHAR(50) NULL,
        description NVARCHAR(1000) NOT NULL,
        metadata NVARCHAR(MAX) NULL,
        ip_address NVARCHAR(50) NULL,
        user_agent NVARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_activity_log PRIMARY KEY (activity_id)
    );
    
    CREATE INDEX IX_activity_log_resource ON dbo.activity_log(resource_type, resource_id, created_at DESC);
    CREATE INDEX IX_activity_log_created_at ON dbo.activity_log(created_at DESC);
    PRINT '  ✓ Created activity_log table';
END
ELSE
BEGIN
    PRINT '  ✓ activity_log table already exists';
END
GO

-- Saved Views
IF OBJECT_ID('dbo.saved_views', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.saved_views (
        view_id INT IDENTITY(1,1) NOT NULL,
        user_id INT NULL,
        view_name NVARCHAR(200) NOT NULL,
        resource_type NVARCHAR(50) NOT NULL,
        filter_config NVARCHAR(MAX) NOT NULL,
        sort_config NVARCHAR(MAX) NULL,
        column_config NVARCHAR(MAX) NULL,
        is_default BIT NOT NULL DEFAULT 0,
        is_shared BIT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_saved_views PRIMARY KEY (view_id)
    );
    
    CREATE INDEX IX_saved_views_user_resource ON dbo.saved_views(user_id, resource_type);
    PRINT '  ✓ Created saved_views table';
    
    -- Seed system views
    INSERT INTO dbo.saved_views (user_id, view_name, resource_type, filter_config, sort_config, is_default, is_shared) VALUES
        (NULL, 'All Servers', 'servers', '{}', '{"field":"server_code","order":"asc"}', 1, 1),
        (NULL, 'Production Servers', 'servers', '{"environment":["Production"]}', '{"field":"server_code","order":"asc"}', 0, 1),
        (NULL, 'Critical Systems', 'servers', '{"criticality":["Critical","High"]}', '{"field":"criticality","order":"asc"}', 0, 1);
    PRINT '  ✓ Seeded system saved views';
END
ELSE
BEGIN
    PRINT '  ✓ saved_views table already exists';
END
GO

-- Attachments
IF OBJECT_ID('dbo.attachments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.attachments (
        attachment_id INT IDENTITY(1,1) NOT NULL,
        resource_type NVARCHAR(50) NOT NULL,
        resource_id INT NOT NULL,
        file_name NVARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        file_type NVARCHAR(100) NULL,
        storage_path NVARCHAR(1000) NOT NULL,
        uploaded_by INT NULL,
        uploaded_by_name NVARCHAR(200) NULL,
        uploaded_at DATETIME NOT NULL DEFAULT GETDATE(),
        description NVARCHAR(1000) NULL,
        deleted_at DATETIME NULL,
        CONSTRAINT PK_attachments PRIMARY KEY (attachment_id)
    );
    
    CREATE INDEX IX_attachments_resource ON dbo.attachments(resource_type, resource_id, deleted_at);
    PRINT '  ✓ Created attachments table';
END
ELSE
BEGIN
    PRINT '  ✓ attachments table already exists';
END
GO

-- Notifications
IF OBJECT_ID('dbo.notifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.notifications (
        notification_id INT IDENTITY(1,1) NOT NULL,
        user_id INT NULL,
        title NVARCHAR(500) NOT NULL,
        message NVARCHAR(MAX) NULL,
        notification_type NVARCHAR(100) NULL,
        resource_type NVARCHAR(50) NULL,
        resource_id INT NULL,
        resource_url NVARCHAR(1000) NULL,
        is_read BIT NOT NULL DEFAULT 0,
        read_at DATETIME NULL,
        priority NVARCHAR(50) NOT NULL DEFAULT 'Normal',
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        expires_at DATETIME NULL,
        CONSTRAINT PK_notifications PRIMARY KEY (notification_id)
    );
    
    CREATE INDEX IX_notifications_user_isread ON dbo.notifications(user_id, is_read, created_at DESC);
    PRINT '  ✓ Created notifications table';
END
ELSE
BEGIN
    PRINT '  ✓ notifications table already exists';
END
GO

-- =====================================================
-- STEP 3: Enhance Servers Table
-- =====================================================
PRINT '';
PRINT 'STEP 3: Enhancing Servers Table...';
PRINT '';

-- Add V2 columns to servers
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'last_seen_at')
BEGIN
    ALTER TABLE dbo.servers ADD last_seen_at DATETIME NULL;
    PRINT '  ✓ Added last_seen_at column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'health_status')
BEGIN
    ALTER TABLE dbo.servers ADD health_status NVARCHAR(50) NULL;
    PRINT '  ✓ Added health_status column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'criticality')
BEGIN
    ALTER TABLE dbo.servers ADD criticality NVARCHAR(50) NULL DEFAULT 'Medium';
    PRINT '  ✓ Added criticality column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'tags')
BEGIN
    ALTER TABLE dbo.servers ADD tags NVARCHAR(500) NULL;
    PRINT '  ✓ Added tags column';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'deleted_at')
BEGIN
    ALTER TABLE dbo.servers ADD deleted_at DATETIME NULL;
    PRINT '  ✓ Added deleted_at column';
END
GO

-- Create indexes on new columns
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_health_status' AND object_id = OBJECT_ID('dbo.servers'))
    CREATE INDEX IX_servers_health_status ON dbo.servers(health_status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_criticality' AND object_id = OBJECT_ID('dbo.servers'))
    CREATE INDEX IX_servers_criticality ON dbo.servers(criticality);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_last_seen_at' AND object_id = OBJECT_ID('dbo.servers'))
    CREATE INDEX IX_servers_last_seen_at ON dbo.servers(last_seen_at DESC);

PRINT '';
PRINT 'STEP 3 COMPLETE: Servers table enhanced';
PRINT '';

-- =====================================================
-- STEP 4: Create First Admin User
-- =====================================================
PRINT 'STEP 4: Creating First Admin User...';
PRINT '';

-- Get first team (or create a default one)
DECLARE @defaultTeamId INT = (SELECT TOP 1 team_id FROM dbo.teams ORDER BY team_id);

IF @defaultTeamId IS NULL
BEGIN
    INSERT INTO dbo.teams (team_name) VALUES ('IT Operations');
    SET @defaultTeamId = SCOPE_IDENTITY();
    PRINT '  ✓ Created default team: IT Operations';
END

-- Create admin user (password will need to be set via API)
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE LOWER(username) = 'admin')
BEGIN
    INSERT INTO dbo.Users (username, full_name, team_id, is_active, password_hash)
    VALUES ('admin', 'System Administrator', @defaultTeamId, 1, NULL);
    
    DECLARE @adminUserId INT = SCOPE_IDENTITY();
    DECLARE @adminRoleId INT = (SELECT role_id FROM dbo.roles WHERE LOWER(role_name) = 'admin');
    
    -- Assign Admin role
    INSERT INTO dbo.user_roles (user_id, role_id)
    VALUES (@adminUserId, @adminRoleId);
    
    PRINT '  ✓ Created admin user (ID: ' + CAST(@adminUserId AS VARCHAR) + ')';
    PRINT '  ⚠ PASSWORD NOT SET - Use bootstrap API to set password';
    PRINT '';
    PRINT '  To set password, run this command:';
    PRINT '    curl -X POST http://localhost:3000/auth/bootstrap-admin \';
    PRINT '      -H "Content-Type: application/json" \';
    PRINT '      -d ''{"username":"admin","password":"Admin@123","fullName":"System Administrator","teamId":' + CAST(@defaultTeamId AS VARCHAR) + '}''';
END
ELSE
BEGIN
    PRINT '  ✓ Admin user already exists';
END
GO

PRINT '';
PRINT '========================================';
PRINT 'V2 SETUP COMPLETE!';
PRINT '========================================';
PRINT '';
PRINT 'NEXT STEPS:';
PRINT '1. Set admin password using bootstrap API (see above)';
PRINT '2. Login with username: admin';
PRINT '3. Test Global Search: Press Cmd+K or Ctrl+K';
PRINT '';
PRINT 'V2 FEATURES READY:';
PRINT '  ✓ Activity Log';
PRINT '  ✓ Saved Views';
PRINT '  ✓ Global Search';
PRINT '  ✓ Attachments (API coming soon)';
PRINT '  ✓ Notifications (API coming soon)';
PRINT '';
PRINT '========================================';
GO
