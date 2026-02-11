-- =====================================================
-- HORMUUD TELECOM - ENTERPRISE RBAC SCHEMA (FIXED)
-- Date: 2026-02-07
-- Purpose: Complete RBAC + Team Scoping + Server Scoping
-- Fixed: Handles existing Users table without role_id
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'HORMUUD TELECOM - RBAC SCHEMA';
PRINT '========================================';
PRINT '';

-- =====================================================
-- 1. CREATE ROLES TABLE FIRST
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
    
    PRINT '  - roles table created';
END
ELSE
BEGIN
    PRINT '  - roles table already exists';
END

-- Insert roles immediately
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_name = 'Admin')
BEGIN
    INSERT INTO dbo.roles (role_name, description) VALUES 
    ('Admin', 'Full system access - can manage all servers, teams, users, and settings'),
    ('TeamLead', 'Team-scoped manager - can manage team engineers and schedule maintenance'),
    ('Engineer', 'Restricted operator - can only work on assigned servers');
    
    PRINT '  - Roles seeded: Admin, TeamLead, Engineer';
END

PRINT '';

-- =====================================================
-- 2. CREATE PERMISSIONS TABLE
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
    
    PRINT '  - permissions table created';
END
ELSE
BEGIN
    PRINT '  - permissions table already exists';
END

PRINT '';

-- =====================================================
-- 3. CREATE ROLE_PERMISSIONS TABLE
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
    
    PRINT '  - role_permissions table created';
END
ELSE
BEGIN
    PRINT '  - role_permissions table already exists';
END

PRINT '';

-- =====================================================
-- 4. UPDATE USERS TABLE (ADD role_id)
-- =====================================================
PRINT '4. Updating Users table...';

-- Check if Users table exists
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users')
BEGIN
    PRINT '  - Users table exists';
    
    -- Add role_id column if missing
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'role_id')
    BEGIN
        PRINT '  - Adding role_id column...';
        
        -- Add column as nullable first
        ALTER TABLE dbo.Users ADD role_id INT NULL;
        
        -- Get Admin role ID
        DECLARE @adminRoleId INT;
        SELECT @adminRoleId = role_id FROM dbo.roles WHERE role_name = 'Admin';
        
        -- Set all existing users to Admin role
        UPDATE dbo.Users SET role_id = @adminRoleId WHERE role_id IS NULL;
        PRINT '    - Set existing users to Admin role';
        
        -- Make role_id required
        ALTER TABLE dbo.Users ALTER COLUMN role_id INT NOT NULL;
        PRINT '    - Made role_id required';
        
        -- Add FK constraint
        ALTER TABLE dbo.Users ADD CONSTRAINT FK_Users_role 
            FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id);
        PRINT '    - Added FK constraint';
        
        -- Add index
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_role_id' AND object_id = OBJECT_ID('dbo.Users'))
        BEGIN
            CREATE INDEX IX_Users_role_id ON dbo.Users(role_id);
            PRINT '    - Added index on role_id';
        END
    END
    ELSE
    BEGIN
        PRINT '  - role_id column already exists';
    END
    
    -- Add full_name if missing
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'full_name')
    BEGIN
        PRINT '  - Adding full_name column...';
        ALTER TABLE dbo.Users ADD full_name NVARCHAR(200) NULL;
    END
    
    -- Add email if missing
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'email')
    BEGIN
        PRINT '  - Adding email column...';
        ALTER TABLE dbo.Users ADD email NVARCHAR(320) NULL;
    END
    
    -- Add last_login if missing
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'last_login')
    BEGIN
        PRINT '  - Adding last_login column...';
        ALTER TABLE dbo.Users ADD last_login DATETIME NULL;
    END
    
    -- Ensure team_id FK exists
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Users_team' AND parent_object_id = OBJECT_ID('dbo.Users'))
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'team_id')
        BEGIN
            PRINT '  - Adding FK_Users_team...';
            ALTER TABLE dbo.Users ADD CONSTRAINT FK_Users_team 
                FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id) ON DELETE SET NULL;
        END
    END
    
    -- Add indexes if missing
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_team_id' AND object_id = OBJECT_ID('dbo.Users'))
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'team_id')
        BEGIN
            CREATE INDEX IX_Users_team_id ON dbo.Users(team_id);
        END
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_is_active' AND object_id = OBJECT_ID('dbo.Users'))
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'is_active')
        BEGIN
            CREATE INDEX IX_Users_is_active ON dbo.Users(is_active);
        END
    END
END
ELSE
BEGIN
    PRINT '  - Users table does not exist, creating...';
    
    CREATE TABLE dbo.Users (
        user_id INT IDENTITY(1,1) NOT NULL,
        username NVARCHAR(100) NOT NULL,
        email NVARCHAR(320) NULL,
        password_hash NVARCHAR(255) NOT NULL,
        full_name NVARCHAR(200) NULL,
        role_id INT NOT NULL,
        team_id INT NULL,
        is_active BIT NOT NULL DEFAULT 1,
        last_login DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT PK_Users PRIMARY KEY (user_id),
        CONSTRAINT UQ_Users_username UNIQUE (username),
        CONSTRAINT FK_Users_role FOREIGN KEY (role_id) 
            REFERENCES dbo.roles(role_id),
        CONSTRAINT FK_Users_team FOREIGN KEY (team_id) 
            REFERENCES dbo.teams(team_id) ON DELETE SET NULL
    );
    
    CREATE INDEX IX_Users_role_id ON dbo.Users(role_id);
    CREATE INDEX IX_Users_team_id ON dbo.Users(team_id);
    CREATE INDEX IX_Users_is_active ON dbo.Users(is_active);
    
    PRINT '  - Users table created';
END

PRINT '  - Users table verified';
PRINT '';

-- =====================================================
-- 5. UPDATE ENGINEERS TABLE
-- =====================================================
PRINT '5. Verifying engineers table...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'engineers')
BEGIN
    -- Add user_id link if missing
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.engineers') AND name = 'user_id')
    BEGIN
        PRINT '  - Adding user_id column to engineers...';
        ALTER TABLE dbo.engineers ADD user_id INT NULL;
        
        ALTER TABLE dbo.engineers ADD CONSTRAINT FK_engineers_user 
            FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id) ON DELETE SET NULL;
        
        CREATE INDEX IX_engineers_user_id ON dbo.engineers(user_id);
    END
    
    PRINT '  - engineers table verified';
END
ELSE
BEGIN
    PRINT '  - engineers table does not exist (will be created by main schema)';
END

PRINT '';

-- =====================================================
-- 6. UPDATE SERVERS TABLE
-- =====================================================
PRINT '6. Verifying servers table...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'servers')
BEGIN
    -- Ensure engineer_id exists
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'engineer_id')
    BEGIN
        PRINT '  - Adding engineer_id column...';
        ALTER TABLE dbo.servers ADD engineer_id INT NULL;
        
        IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'engineers')
        BEGIN
            ALTER TABLE dbo.servers ADD CONSTRAINT FK_servers_engineer 
                FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;
        END
        
        CREATE INDEX IX_servers_engineer_id ON dbo.servers(engineer_id);
    END
    
    PRINT '  - servers table verified';
END

PRINT '';

-- =====================================================
-- 7. UPDATE MAINTENANCE TABLE
-- =====================================================
PRINT '7. Verifying server_maintenance table...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_maintenance')
BEGIN
    -- scheduled_by_user_id
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_maintenance') AND name = 'scheduled_by_user_id')
    BEGIN
        PRINT '  - Adding scheduled_by_user_id column...';
        ALTER TABLE dbo.server_maintenance ADD scheduled_by_user_id INT NULL;
        
        ALTER TABLE dbo.server_maintenance ADD CONSTRAINT FK_server_maintenance_scheduled_by 
            FOREIGN KEY (scheduled_by_user_id) REFERENCES dbo.Users(user_id) ON DELETE SET NULL;
    END
    
    -- assigned_engineer_id
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_maintenance') AND name = 'assigned_engineer_id')
    BEGIN
        PRINT '  - Adding assigned_engineer_id column...';
        ALTER TABLE dbo.server_maintenance ADD assigned_engineer_id INT NULL;
        
        IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'engineers')
        BEGIN
            ALTER TABLE dbo.server_maintenance ADD CONSTRAINT FK_server_maintenance_assigned_engineer 
                FOREIGN KEY (assigned_engineer_id) REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;
        END
    END
    
    -- schedule_type
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_maintenance') AND name = 'schedule_type')
    BEGIN
        PRINT '  - Adding schedule_type column...';
        ALTER TABLE dbo.server_maintenance ADD schedule_type NVARCHAR(20) NULL;
        
        IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_server_maintenance_schedule_type')
        BEGIN
            ALTER TABLE dbo.server_maintenance ADD CONSTRAINT CK_server_maintenance_schedule_type 
                CHECK (schedule_type IS NULL OR schedule_type IN ('Daily','Weekly','Monthly','OneTime'));
        END
    END
    
    PRINT '  - server_maintenance table verified';
END

PRINT '';

-- =====================================================
-- 8. UPDATE INCIDENTS TABLE
-- =====================================================
PRINT '8. Verifying server_incidents table...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_incidents')
BEGIN
    -- created_by_user_id
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_incidents') AND name = 'created_by_user_id')
    BEGIN
        PRINT '  - Adding created_by_user_id column...';
        ALTER TABLE dbo.server_incidents ADD created_by_user_id INT NULL;
        
        ALTER TABLE dbo.server_incidents ADD CONSTRAINT FK_server_incidents_created_by 
            FOREIGN KEY (created_by_user_id) REFERENCES dbo.Users(user_id) ON DELETE SET NULL;
    END
    
    -- opened_at (use reported_at if exists)
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_incidents') AND name = 'opened_at')
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_incidents') AND name = 'reported_at')
        BEGIN
            PRINT '  - Renaming reported_at to opened_at...';
            EXEC sp_rename 'dbo.server_incidents.reported_at', 'opened_at', 'COLUMN';
        END
        ELSE
        BEGIN
            PRINT '  - Adding opened_at column...';
            ALTER TABLE dbo.server_incidents ADD opened_at DATETIME NOT NULL DEFAULT GETDATE();
        END
    END
    
    -- summary (use description if exists)
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_incidents') AND name = 'summary')
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_incidents') AND name = 'description')
        BEGIN
            PRINT '  - Renaming description to summary...';
            EXEC sp_rename 'dbo.server_incidents.description', 'summary', 'COLUMN';
        END
        ELSE
        BEGIN
            PRINT '  - Adding summary column...';
            ALTER TABLE dbo.server_incidents ADD summary NVARCHAR(MAX) NULL;
        END
    END
    
    PRINT '  - server_incidents table verified';
END

PRINT '';

-- =====================================================
-- 9. UPDATE VISITS TABLE
-- =====================================================
PRINT '9. Verifying server_visits table...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_visits')
BEGIN
    -- visit_date (use scheduled_at if exists)
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_visits') AND name = 'visit_date')
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_visits') AND name = 'scheduled_at')
        BEGIN
            PRINT '  - Renaming scheduled_at to visit_date...';
            EXEC sp_rename 'dbo.server_visits.scheduled_at', 'visit_date', 'COLUMN';
        END
        ELSE
        BEGIN
            PRINT '  - Adding visit_date column...';
            ALTER TABLE dbo.server_visits ADD visit_date DATETIME NOT NULL DEFAULT GETDATE();
        END
    END
    
    PRINT '  - server_visits table verified';
END

PRINT '';

-- =====================================================
-- 10. CREATE SERVER_ACTIVITY TABLE
-- =====================================================
PRINT '10. Verifying server_activity table...';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_activity')
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
            REFERENCES dbo.servers(server_id) ON DELETE CASCADE,
        CONSTRAINT FK_server_activity_actor FOREIGN KEY (actor_user_id) 
            REFERENCES dbo.Users(user_id) ON DELETE SET NULL
    );
    
    CREATE INDEX IX_server_activity_server_id ON dbo.server_activity(server_id, created_at DESC);
    CREATE INDEX IX_server_activity_actor ON dbo.server_activity(actor_user_id, created_at DESC);
    CREATE INDEX IX_server_activity_entity ON dbo.server_activity(entity_type, entity_id);
    
    PRINT '  - server_activity table created';
END
ELSE
BEGIN
    -- Add is_sensitive flag if missing
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_activity') AND name = 'is_sensitive')
    BEGIN
        PRINT '  - Adding is_sensitive column...';
        ALTER TABLE dbo.server_activity ADD is_sensitive BIT NOT NULL DEFAULT 0;
    END
    
    PRINT '  - server_activity table verified';
END

PRINT '';

-- =====================================================
-- 11. CREATE/UPDATE SERVER_CREDENTIALS TABLE
-- =====================================================
PRINT '11. Verifying server_credentials table...';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_credentials')
BEGIN
    CREATE TABLE dbo.server_credentials (
        credential_id INT IDENTITY(1,1) NOT NULL,
        server_id INT NOT NULL,
        login_username NVARCHAR(200) NULL,
        password_enc NVARCHAR(500) NULL,
        credential_type NVARCHAR(50) NULL DEFAULT 'SSH',
        notes NVARCHAR(MAX) NULL,
        updated_by_user_id INT NULL,
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT PK_server_credentials PRIMARY KEY (credential_id),
        CONSTRAINT FK_server_credentials_server FOREIGN KEY (server_id) 
            REFERENCES dbo.servers(server_id) ON DELETE CASCADE,
        CONSTRAINT FK_server_credentials_updated_by FOREIGN KEY (updated_by_user_id) 
            REFERENCES dbo.Users(user_id) ON DELETE SET NULL
    );
    
    CREATE UNIQUE INDEX UQ_server_credentials_server_type ON dbo.server_credentials(server_id, credential_type);
    
    PRINT '  - server_credentials table created';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_credentials') AND name = 'updated_by_user_id')
    BEGIN
        PRINT '  - Adding updated_by_user_id column...';
        ALTER TABLE dbo.server_credentials ADD updated_by_user_id INT NULL;
        
        ALTER TABLE dbo.server_credentials ADD CONSTRAINT FK_server_credentials_updated_by 
            FOREIGN KEY (updated_by_user_id) REFERENCES dbo.Users(user_id) ON DELETE SET NULL;
    END
    
    PRINT '  - server_credentials table verified';
END

PRINT '';

-- =====================================================
-- 12. SEED PERMISSIONS
-- =====================================================
PRINT '12. Seeding permissions...';

IF NOT EXISTS (SELECT 1 FROM dbo.permissions WHERE permission_key = 'servers.read.all')
BEGIN
    INSERT INTO dbo.permissions (permission_key, permission_name, category, description) VALUES
    -- Servers
    ('servers.read.all', 'Read All Servers', 'servers', 'View all servers across all teams'),
    ('servers.read.team', 'Read Team Servers', 'servers', 'View servers within own team'),
    ('servers.read.own', 'Read Own Servers', 'servers', 'View only assigned servers'),
    ('servers.create', 'Create Servers', 'servers', 'Register new servers'),
    ('servers.update', 'Update Servers', 'servers', 'Modify server details'),
    ('servers.delete', 'Delete Servers', 'servers', 'Remove servers from system'),
    
    -- Maintenance
    ('maintenance.read.all', 'Read All Maintenance', 'maintenance', 'View all maintenance records'),
    ('maintenance.read.team', 'Read Team Maintenance', 'maintenance', 'View team maintenance records'),
    ('maintenance.read.own', 'Read Own Maintenance', 'maintenance', 'View assigned maintenance only'),
    ('maintenance.schedule.all', 'Schedule All Maintenance', 'maintenance', 'Schedule maintenance for any server'),
    ('maintenance.schedule.team', 'Schedule Team Maintenance', 'maintenance', 'Schedule maintenance for team servers'),
    ('maintenance.complete.assigned', 'Complete Assigned Maintenance', 'maintenance', 'Mark assigned maintenance as completed'),
    
    -- Incidents
    ('incidents.read.all', 'Read All Incidents', 'incidents', 'View all incidents'),
    ('incidents.read.team', 'Read Team Incidents', 'incidents', 'View team incidents'),
    ('incidents.read.own', 'Read Own Incidents', 'incidents', 'View incidents for assigned servers'),
    ('incidents.create', 'Create Incidents', 'incidents', 'Create new incidents'),
    ('incidents.update', 'Update Incidents', 'incidents', 'Modify and resolve incidents'),
    
    -- Visits
    ('visits.read.all', 'Read All Visits', 'visits', 'View all visits'),
    ('visits.read.team', 'Read Team Visits', 'visits', 'View team visits'),
    ('visits.read.own', 'Read Own Visits', 'visits', 'View own visits'),
    ('visits.create.own', 'Create Own Visits', 'visits', 'Create visits for assigned servers'),
    ('visits.complete.own', 'Complete Own Visits', 'visits', 'Mark own visits as completed'),
    
    -- Security/Credentials
    ('security.manage.all', 'Manage All Security', 'security', 'Manage security for all servers'),
    ('security.manage.team', 'Manage Team Security', 'security', 'Manage security for team servers'),
    ('security.manage.own', 'Manage Own Security', 'security', 'Manage security for assigned servers'),
    ('security.reveal.all', 'Reveal All Credentials', 'security', 'Reveal any server credentials'),
    ('security.reveal.team', 'Reveal Team Credentials', 'security', 'Reveal team server credentials'),
    ('security.reveal.own', 'Reveal Own Credentials', 'security', 'Reveal assigned server credentials'),
    
    -- Reports
    ('reports.view.all', 'View All Reports', 'reports', 'Generate global reports'),
    ('reports.view.team', 'View Team Reports', 'reports', 'Generate team reports'),
    ('reports.view.own', 'View Own Reports', 'reports', 'Generate personal reports'),
    
    -- Audit & Settings
    ('auditlogs.view', 'View Audit Logs', 'system', 'View system audit logs'),
    ('settings.manage', 'Manage Settings', 'system', 'Configure system settings'),
    
    -- User Management
    ('users.manage.all', 'Manage All Users', 'users', 'Manage all users and roles'),
    ('users.manage.team', 'Manage Team Users', 'users', 'Manage engineers in own team');
    
    PRINT '  - Permissions seeded (34 permissions)';
END
ELSE
BEGIN
    PRINT '  - Permissions already exist';
END

PRINT '';

-- =====================================================
-- 13. ASSIGN PERMISSIONS TO ROLES
-- =====================================================
PRINT '13. Assigning permissions to roles...';

IF NOT EXISTS (SELECT 1 FROM dbo.role_permissions)
BEGIN
    DECLARE @adminId INT, @teamLeadId INT, @engineerId INT;
    
    SELECT @adminId = role_id FROM dbo.roles WHERE role_name = 'Admin';
    SELECT @teamLeadId = role_id FROM dbo.roles WHERE role_name = 'TeamLead';
    SELECT @engineerId = role_id FROM dbo.roles WHERE role_name = 'Engineer';
    
    -- ADMIN: All permissions
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @adminId, permission_id FROM dbo.permissions;
    PRINT '  - Admin: All permissions assigned';
    
    -- TEAM_LEAD: Team-scoped permissions
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @teamLeadId, permission_id FROM dbo.permissions
    WHERE permission_key IN (
        'servers.read.team',
        'maintenance.read.team', 'maintenance.schedule.team',
        'incidents.read.team', 'incidents.create', 'incidents.update',
        'visits.read.team',
        'security.manage.team',
        'reports.view.team',
        'users.manage.team'
    );
    PRINT '  - TeamLead: Team-scoped permissions assigned';
    
    -- ENGINEER: Own-scoped permissions
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @engineerId, permission_id FROM dbo.permissions
    WHERE permission_key IN (
        'servers.read.own', 'servers.read.team',
        'maintenance.read.own', 'maintenance.complete.assigned',
        'incidents.read.own',
        'visits.read.own', 'visits.create.own', 'visits.complete.own',
        'security.manage.own', 'security.reveal.own',
        'reports.view.own'
    );
    PRINT '  - Engineer: Own-scoped permissions assigned';
END
ELSE
BEGIN
    PRINT '  - Role permissions already assigned';
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
PRINT 'Summary:';
PRINT '  - Roles: Admin, TeamLead, Engineer';
PRINT '  - Permissions: 34 granular permissions';
PRINT '  - Users table: Enhanced with role_id';
PRINT '  - Activity logging: server_activity table';
PRINT '  - Credentials: server_credentials with user tracking';
PRINT '  - All FK relationships established';
PRINT '';
PRINT 'Next steps:';
PRINT '  1. Start backend: cd backend && npm run dev';
PRINT '  2. Follow HORMUUD_RBAC_QUICK_START.md';
PRINT '';

GO
