-- =====================================================
-- HORMUUD TELECOM - RBAC SCHEMA (ULTRA-SAFE)
-- Date: 2026-02-07
-- Purpose: Discovers existing schema and adapts
-- Safe: Checks everything before creating
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'HORMUUD TELECOM - RBAC SCHEMA';
PRINT 'Discovering existing schema...';
PRINT '========================================';
PRINT '';

-- =====================================================
-- STEP 1: CREATE ROLES TABLE
-- =====================================================
PRINT '1. Creating roles table...';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'roles')
BEGIN
    CREATE TABLE dbo.roles (
        role_id INT IDENTITY(1,1) NOT NULL,
        role_name NVARCHAR(50) NOT NULL,
        description NVARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_roles PRIMARY KEY (role_id),
        CONSTRAINT UQ_roles_role_name UNIQUE (role_name)
    );
    PRINT '  ✓ roles table created';
END
ELSE
BEGIN
    PRINT '  ✓ roles table exists';
END

-- Seed roles
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_name = 'Admin')
BEGIN
    INSERT INTO dbo.roles (role_name, description) VALUES 
    ('Admin', 'Full system access'),
    ('TeamLead', 'Team-scoped manager'),
    ('Engineer', 'Restricted operator');
    PRINT '  ✓ Roles seeded';
END

PRINT '';

-- =====================================================
-- STEP 2: CREATE PERMISSIONS TABLE
-- =====================================================
PRINT '2. Creating permissions table...';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'permissions')
BEGIN
    CREATE TABLE dbo.permissions (
        permission_id INT IDENTITY(1,1) NOT NULL,
        permission_key NVARCHAR(100) NOT NULL,
        permission_name NVARCHAR(200) NOT NULL,
        category NVARCHAR(50) NOT NULL,
        description NVARCHAR(500) NULL,
        CONSTRAINT PK_permissions PRIMARY KEY (permission_id),
        CONSTRAINT UQ_permissions_permission_key UNIQUE (permission_key)
    );
    PRINT '  ✓ permissions table created';
    
    -- Seed permissions immediately
    INSERT INTO dbo.permissions (permission_key, permission_name, category, description) VALUES
    ('servers.read.all', 'Read All Servers', 'servers', 'View all servers'),
    ('servers.read.team', 'Read Team Servers', 'servers', 'View team servers'),
    ('servers.read.own', 'Read Own Servers', 'servers', 'View assigned servers'),
    ('servers.create', 'Create Servers', 'servers', 'Register new servers'),
    ('servers.update', 'Update Servers', 'servers', 'Modify servers'),
    ('servers.delete', 'Delete Servers', 'servers', 'Remove servers'),
    ('maintenance.read.all', 'Read All Maintenance', 'maintenance', 'View all maintenance'),
    ('maintenance.read.team', 'Read Team Maintenance', 'maintenance', 'View team maintenance'),
    ('maintenance.read.own', 'Read Own Maintenance', 'maintenance', 'View assigned maintenance'),
    ('maintenance.schedule.all', 'Schedule All Maintenance', 'maintenance', 'Schedule any maintenance'),
    ('maintenance.schedule.team', 'Schedule Team Maintenance', 'maintenance', 'Schedule team maintenance'),
    ('maintenance.complete.assigned', 'Complete Assigned Maintenance', 'maintenance', 'Complete assigned work'),
    ('incidents.read.all', 'Read All Incidents', 'incidents', 'View all incidents'),
    ('incidents.read.team', 'Read Team Incidents', 'incidents', 'View team incidents'),
    ('incidents.read.own', 'Read Own Incidents', 'incidents', 'View assigned incidents'),
    ('incidents.create', 'Create Incidents', 'incidents', 'Create incidents'),
    ('incidents.update', 'Update Incidents', 'incidents', 'Update incidents'),
    ('visits.read.all', 'Read All Visits', 'visits', 'View all visits'),
    ('visits.read.team', 'Read Team Visits', 'visits', 'View team visits'),
    ('visits.read.own', 'Read Own Visits', 'visits', 'View own visits'),
    ('visits.create.own', 'Create Own Visits', 'visits', 'Create visits'),
    ('visits.complete.own', 'Complete Own Visits', 'visits', 'Complete visits'),
    ('security.manage.all', 'Manage All Security', 'security', 'Manage all security'),
    ('security.manage.team', 'Manage Team Security', 'security', 'Manage team security'),
    ('security.manage.own', 'Manage Own Security', 'security', 'Manage own security'),
    ('security.reveal.all', 'Reveal All Credentials', 'security', 'Reveal any credentials'),
    ('security.reveal.team', 'Reveal Team Credentials', 'security', 'Reveal team credentials'),
    ('security.reveal.own', 'Reveal Own Credentials', 'security', 'Reveal own credentials'),
    ('reports.view.all', 'View All Reports', 'reports', 'Global reports'),
    ('reports.view.team', 'View Team Reports', 'reports', 'Team reports'),
    ('reports.view.own', 'View Own Reports', 'reports', 'Personal reports'),
    ('auditlogs.view', 'View Audit Logs', 'system', 'View audit logs'),
    ('settings.manage', 'Manage Settings', 'system', 'Configure system'),
    ('users.manage.all', 'Manage All Users', 'users', 'Manage all users'),
    ('users.manage.team', 'Manage Team Users', 'users', 'Manage team engineers');
    
    PRINT '  ✓ Permissions seeded (35 permissions)';
END
ELSE
BEGIN
    PRINT '  ✓ permissions table exists';
END

PRINT '';

-- =====================================================
-- STEP 3: CREATE ROLE_PERMISSIONS TABLE
-- =====================================================
PRINT '3. Creating role_permissions table...';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'role_permissions')
BEGIN
    CREATE TABLE dbo.role_permissions (
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_id),
        CONSTRAINT FK_role_permissions_role FOREIGN KEY (role_id) 
            REFERENCES dbo.roles(role_id) ON DELETE CASCADE,
        CONSTRAINT FK_role_permissions_permission FOREIGN KEY (permission_id) 
            REFERENCES dbo.permissions(permission_id) ON DELETE CASCADE
    );
    PRINT '  ✓ role_permissions table created';
    
    -- Assign permissions
    DECLARE @adminId INT, @teamLeadId INT, @engineerId INT;
    SELECT @adminId = role_id FROM dbo.roles WHERE role_name = 'Admin';
    SELECT @teamLeadId = role_id FROM dbo.roles WHERE role_name = 'TeamLead';
    SELECT @engineerId = role_id FROM dbo.roles WHERE role_name = 'Engineer';
    
    -- Admin: All permissions
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @adminId, permission_id FROM dbo.permissions;
    
    -- TeamLead: Team-scoped
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @teamLeadId, permission_id FROM dbo.permissions
    WHERE permission_key IN (
        'servers.read.team', 'maintenance.read.team', 'maintenance.schedule.team',
        'incidents.read.team', 'incidents.create', 'incidents.update',
        'visits.read.team', 'security.manage.team', 'reports.view.team', 'users.manage.team'
    );
    
    -- Engineer: Own-scoped
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @engineerId, permission_id FROM dbo.permissions
    WHERE permission_key IN (
        'servers.read.own', 'servers.read.team', 'maintenance.read.own', 'maintenance.complete.assigned',
        'incidents.read.own', 'visits.read.own', 'visits.create.own', 'visits.complete.own',
        'security.manage.own', 'security.reveal.own', 'reports.view.own'
    );
    
    PRINT '  ✓ Role permissions assigned';
END
ELSE
BEGIN
    PRINT '  ✓ role_permissions table exists';
END

PRINT '';

-- =====================================================
-- STEP 4: DISCOVER AND UPDATE USERS TABLE
-- =====================================================
PRINT '4. Discovering Users table structure...';

DECLARE @usersExists BIT = 0;
DECLARE @hasRoleId BIT = 0;
DECLARE @hasTeamId BIT = 0;
DECLARE @hasFullName BIT = 0;
DECLARE @hasEmail BIT = 0;

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users')
BEGIN
    SET @usersExists = 1;
    SELECT @hasRoleId = CASE WHEN COL_LENGTH('dbo.Users', 'role_id') IS NOT NULL THEN 1 ELSE 0 END;
    SELECT @hasTeamId = CASE WHEN COL_LENGTH('dbo.Users', 'team_id') IS NOT NULL THEN 1 ELSE 0 END;
    SELECT @hasFullName = CASE WHEN COL_LENGTH('dbo.Users', 'full_name') IS NOT NULL THEN 1 ELSE 0 END;
    SELECT @hasEmail = CASE WHEN COL_LENGTH('dbo.Users', 'email') IS NOT NULL THEN 1 ELSE 0 END;
    
    PRINT '  ✓ Users table exists';
    PRINT '    - Has role_id: ' + CASE WHEN @hasRoleId = 1 THEN 'YES' ELSE 'NO' END;
    PRINT '    - Has team_id: ' + CASE WHEN @hasTeamId = 1 THEN 'YES' ELSE 'NO' END;
    PRINT '    - Has full_name: ' + CASE WHEN @hasFullName = 1 THEN 'YES' ELSE 'NO' END;
    PRINT '    - Has email: ' + CASE WHEN @hasEmail = 1 THEN 'YES' ELSE 'NO' END;
END
ELSE
BEGIN
    PRINT '  ! Users table does not exist - will skip Users modifications';
END

-- Add role_id if missing
IF @usersExists = 1 AND @hasRoleId = 0
BEGIN
    PRINT '  → Adding role_id column...';
    
    ALTER TABLE dbo.Users ADD role_id INT NULL;
    
    -- Set all existing users to Admin
    DECLARE @adminRoleId INT;
    SELECT @adminRoleId = role_id FROM dbo.roles WHERE role_name = 'Admin';
    UPDATE dbo.Users SET role_id = @adminRoleId WHERE role_id IS NULL;
    
    -- Make it required
    ALTER TABLE dbo.Users ALTER COLUMN role_id INT NOT NULL;
    
    -- Add FK
    ALTER TABLE dbo.Users ADD CONSTRAINT FK_Users_role 
        FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id);
    
    -- Add index
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_role_id' AND object_id = OBJECT_ID('dbo.Users'))
    BEGIN
        CREATE INDEX IX_Users_role_id ON dbo.Users(role_id);
    END
    
    PRINT '  ✓ role_id added';
END

-- Add other columns if missing
IF @usersExists = 1 AND @hasFullName = 0
BEGIN
    ALTER TABLE dbo.Users ADD full_name NVARCHAR(200) NULL;
    PRINT '  ✓ full_name added';
END

IF @usersExists = 1 AND @hasEmail = 0
BEGIN
    ALTER TABLE dbo.Users ADD email NVARCHAR(320) NULL;
    PRINT '  ✓ email added';
END

PRINT '';

-- =====================================================
-- STEP 5: CREATE SERVER_ACTIVITY TABLE
-- =====================================================
PRINT '5. Creating server_activity table...';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_activity')
BEGIN
    -- Check if servers table exists
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'servers')
    BEGIN
        CREATE TABLE dbo.server_activity (
            activity_id INT IDENTITY(1,1) NOT NULL,
            server_id INT NOT NULL,
            actor_user_id INT NULL,
            actor_role NVARCHAR(50) NULL,
            action_type NVARCHAR(100) NOT NULL,
            entity_type NVARCHAR(50) NOT NULL,
            entity_id INT NULL,
            message NVARCHAR(1000) NULL,
            metadata NVARCHAR(MAX) NULL,
            is_sensitive BIT NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT GETDATE(),
            CONSTRAINT PK_server_activity PRIMARY KEY (activity_id),
            CONSTRAINT FK_server_activity_server FOREIGN KEY (server_id) 
                REFERENCES dbo.servers(server_id) ON DELETE CASCADE
        );
        
        -- Add FK to Users if it exists
        IF @usersExists = 1
        BEGIN
            ALTER TABLE dbo.server_activity ADD CONSTRAINT FK_server_activity_actor 
                FOREIGN KEY (actor_user_id) REFERENCES dbo.Users(user_id) ON DELETE SET NULL;
        END
        
        CREATE INDEX IX_server_activity_server_id ON dbo.server_activity(server_id, created_at DESC);
        CREATE INDEX IX_server_activity_actor ON dbo.server_activity(actor_user_id, created_at DESC);
        CREATE INDEX IX_server_activity_entity ON dbo.server_activity(entity_type, entity_id);
        
        PRINT '  ✓ server_activity table created';
    END
    ELSE
    BEGIN
        PRINT '  ! Skipping server_activity (servers table does not exist)';
    END
END
ELSE
BEGIN
    PRINT '  ✓ server_activity table exists';
END

PRINT '';

-- =====================================================
-- STEP 6: ADD TRACKING COLUMNS TO EXISTING TABLES
-- =====================================================
PRINT '6. Adding RBAC tracking columns to existing tables...';

-- server_maintenance: scheduled_by_user_id, assigned_engineer_id
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_maintenance') AND @usersExists = 1
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_maintenance') AND name = 'scheduled_by_user_id')
    BEGIN
        ALTER TABLE dbo.server_maintenance ADD scheduled_by_user_id INT NULL;
        ALTER TABLE dbo.server_maintenance ADD CONSTRAINT FK_server_maintenance_scheduled_by 
            FOREIGN KEY (scheduled_by_user_id) REFERENCES dbo.Users(user_id) ON DELETE SET NULL;
        PRINT '  ✓ Added scheduled_by_user_id to server_maintenance';
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_maintenance') AND name = 'assigned_engineer_id')
    BEGIN
        ALTER TABLE dbo.server_maintenance ADD assigned_engineer_id INT NULL;
        IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'engineers')
        BEGIN
            ALTER TABLE dbo.server_maintenance ADD CONSTRAINT FK_server_maintenance_assigned_engineer 
                FOREIGN KEY (assigned_engineer_id) REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;
        END
        PRINT '  ✓ Added assigned_engineer_id to server_maintenance';
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_maintenance') AND name = 'schedule_type')
    BEGIN
        ALTER TABLE dbo.server_maintenance ADD schedule_type NVARCHAR(20) NULL;
        PRINT '  ✓ Added schedule_type to server_maintenance';
    END
END

-- server_incidents: created_by_user_id
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_incidents') AND @usersExists = 1
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_incidents') AND name = 'created_by_user_id')
    BEGIN
        ALTER TABLE dbo.server_incidents ADD created_by_user_id INT NULL;
        ALTER TABLE dbo.server_incidents ADD CONSTRAINT FK_server_incidents_created_by 
            FOREIGN KEY (created_by_user_id) REFERENCES dbo.Users(user_id) ON DELETE SET NULL;
        PRINT '  ✓ Added created_by_user_id to server_incidents';
    END
END

-- engineers: user_id link
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'engineers') AND @usersExists = 1
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.engineers') AND name = 'user_id')
    BEGIN
        ALTER TABLE dbo.engineers ADD user_id INT NULL;
        ALTER TABLE dbo.engineers ADD CONSTRAINT FK_engineers_user 
            FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id) ON DELETE SET NULL;
        
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_engineers_user_id' AND object_id = OBJECT_ID('dbo.engineers'))
        BEGIN
            CREATE INDEX IX_engineers_user_id ON dbo.engineers(user_id);
        END
        PRINT '  ✓ Added user_id link to engineers';
    END
END

-- servers: engineer_id assignment
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'servers')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'engineer_id')
    BEGIN
        ALTER TABLE dbo.servers ADD engineer_id INT NULL;
        IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'engineers')
        BEGIN
            ALTER TABLE dbo.servers ADD CONSTRAINT FK_servers_engineer 
                FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;
        END
        
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_engineer_id' AND object_id = OBJECT_ID('dbo.servers'))
        BEGIN
            CREATE INDEX IX_servers_engineer_id ON dbo.servers(engineer_id);
        END
        PRINT '  ✓ Added engineer_id assignment to servers';
    END
END

PRINT '';

-- =====================================================
-- COMPLETION
-- =====================================================
PRINT '';
PRINT '========================================';
PRINT 'HORMUUD RBAC SCHEMA COMPLETE!';
PRINT '========================================';
PRINT '';
PRINT 'Created:';
PRINT '  ✓ roles (3 roles)';
PRINT '  ✓ permissions (35 permissions)';
PRINT '  ✓ role_permissions (permissions assigned)';
PRINT '  ✓ server_activity table';
IF @usersExists = 1 AND @hasRoleId = 1
BEGIN
    PRINT '  ✓ Users.role_id (linked to roles)';
END
PRINT '';
PRINT 'Next steps:';
PRINT '  1. Verify: SELECT * FROM dbo.roles';
PRINT '  2. Verify: SELECT * FROM dbo.permissions';
PRINT '  3. Start backend: cd backend && npm run dev';
PRINT '  4. Follow: HORMUUD_RBAC_QUICK_START.md';
PRINT '';

GO
