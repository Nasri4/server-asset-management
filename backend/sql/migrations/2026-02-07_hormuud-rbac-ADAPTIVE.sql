-- =====================================================
-- HORMUUD TELECOM - RBAC (ADAPTIVE)
-- Discovers your actual schema and adapts
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'HORMUUD RBAC - ADAPTIVE INSTALLATION';
PRINT '========================================';
PRINT '';

-- =====================================================
-- DISCOVER USERS TABLE SCHEMA
-- =====================================================
PRINT 'Discovering Users table schema...';

DECLARE @usersPKColumn NVARCHAR(128) = NULL;
DECLARE @usersTableExists BIT = 0;

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users')
BEGIN
    SET @usersTableExists = 1;
    
    -- Find primary key column name
    SELECT TOP 1 @usersPKColumn = c.name
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('dbo.Users')
      AND i.is_primary_key = 1;
    
    PRINT '  Users table exists';
    PRINT '  Primary key column: ' + ISNULL(@usersPKColumn, 'NOT FOUND');
END
ELSE
BEGIN
    PRINT '  Users table does NOT exist';
END

PRINT '';

-- =====================================================
-- STEP 1: CREATE ROLES
-- =====================================================
PRINT '1. Creating roles...';

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
    
    INSERT INTO dbo.roles (role_name, description) VALUES 
    ('Admin', 'Full system access'),
    ('TeamLead', 'Team-scoped manager'),
    ('Engineer', 'Restricted operator');
    
    PRINT '  [OK] Roles created and seeded';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_name = 'Admin')
    BEGIN
        INSERT INTO dbo.roles (role_name, description) VALUES 
        ('Admin', 'Full system access'),
        ('TeamLead', 'Team-scoped manager'),
        ('Engineer', 'Restricted operator');
        PRINT '  [OK] Roles seeded';
    END
    ELSE
    BEGIN
        PRINT '  [SKIP] Roles exist';
    END
END

PRINT '';

-- =====================================================
-- STEP 2: CREATE PERMISSIONS (FRESH)
-- =====================================================
PRINT '2. Creating permissions...';

-- Drop old permissions if wrong schema
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'permissions')
AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.permissions') AND name = 'permission_name')
BEGIN
    PRINT '  [WARN] Old permissions table detected, dropping...';
    
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'role_permissions')
    BEGIN
        DROP TABLE dbo.role_permissions;
    END
    
    DROP TABLE dbo.permissions;
    PRINT '  [OK] Old tables dropped';
END

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
    
    PRINT '  [OK] Permissions created (35)';
END
ELSE
BEGIN
    PRINT '  [SKIP] Permissions exist';
END

PRINT '';

-- =====================================================
-- STEP 3: CREATE ROLE_PERMISSIONS
-- =====================================================
PRINT '3. Creating role_permissions...';

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
    
    DECLARE @adminId INT, @teamLeadId INT, @engineerId INT;
    SELECT @adminId = role_id FROM dbo.roles WHERE role_name = 'Admin';
    SELECT @teamLeadId = role_id FROM dbo.roles WHERE role_name = 'TeamLead';
    SELECT @engineerId = role_id FROM dbo.roles WHERE role_name = 'Engineer';
    
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @adminId, permission_id FROM dbo.permissions;
    
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @teamLeadId, permission_id FROM dbo.permissions
    WHERE permission_key IN (
        'servers.read.team', 'maintenance.read.team', 'maintenance.schedule.team',
        'incidents.read.team', 'incidents.create', 'incidents.update',
        'visits.read.team', 'security.manage.team', 'reports.view.team', 'users.manage.team'
    );
    
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @engineerId, permission_id FROM dbo.permissions
    WHERE permission_key IN (
        'servers.read.own', 'servers.read.team', 'maintenance.read.own', 'maintenance.complete.assigned',
        'incidents.read.own', 'visits.read.own', 'visits.create.own', 'visits.complete.own',
        'security.manage.own', 'security.reveal.own', 'reports.view.own'
    );
    
    PRINT '  [OK] Role permissions assigned';
END
ELSE
BEGIN
    PRINT '  [SKIP] Role permissions exist';
END

PRINT '';

-- =====================================================
-- STEP 4: UPDATE USERS TABLE (CONDITIONAL)
-- =====================================================
PRINT '4. Updating Users table...';

IF @usersTableExists = 1 AND @usersPKColumn IS NOT NULL
BEGIN
    -- Add role_id
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'role_id')
    BEGIN
        EXEC('ALTER TABLE dbo.Users ADD role_id INT NULL');
        
        DECLARE @adminRoleIdSet INT;
        SELECT @adminRoleIdSet = role_id FROM dbo.roles WHERE role_name = 'Admin';
        EXEC('UPDATE dbo.Users SET role_id = ' + CAST(@adminRoleIdSet AS VARCHAR(10)) + ' WHERE role_id IS NULL');
        
        EXEC('ALTER TABLE dbo.Users ALTER COLUMN role_id INT NOT NULL');
        EXEC('ALTER TABLE dbo.Users ADD CONSTRAINT FK_Users_role FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id)');
        
        PRINT '  [OK] role_id added';
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_role_id' AND object_id = OBJECT_ID('dbo.Users'))
    BEGIN
        CREATE INDEX IX_Users_role_id ON dbo.Users(role_id);
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'full_name')
    BEGIN
        ALTER TABLE dbo.Users ADD full_name NVARCHAR(200) NULL;
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'email')
    BEGIN
        ALTER TABLE dbo.Users ADD email NVARCHAR(320) NULL;
    END
    
    PRINT '  [OK] Users updated';
END
ELSE
BEGIN
    PRINT '  [SKIP] Users table not ready';
END

PRINT '';

-- =====================================================
-- STEP 5: CREATE SERVER_ACTIVITY (CONDITIONAL)
-- =====================================================
PRINT '5. Creating server_activity...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'servers')
AND NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_activity')
AND @usersTableExists = 1 AND @usersPKColumn IS NOT NULL
BEGIN
    DECLARE @createActivitySQL NVARCHAR(MAX);
    SET @createActivitySQL = '
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
        CONSTRAINT FK_server_activity_server FOREIGN KEY (server_id) REFERENCES dbo.servers(server_id) ON DELETE CASCADE,
        CONSTRAINT FK_server_activity_actor FOREIGN KEY (actor_user_id) REFERENCES dbo.Users(' + @usersPKColumn + ') ON DELETE SET NULL
    );
    CREATE INDEX IX_server_activity_server_id ON dbo.server_activity(server_id, created_at DESC);
    CREATE INDEX IX_server_activity_actor ON dbo.server_activity(actor_user_id, created_at DESC);
    CREATE INDEX IX_server_activity_entity ON dbo.server_activity(entity_type, entity_id);
    ';
    
    EXEC(@createActivitySQL);
    PRINT '  [OK] server_activity created';
END
ELSE
BEGIN
    PRINT '  [SKIP] server_activity (dependencies not met)';
END

PRINT '';

-- =====================================================
-- STEP 6: ADD TRACKING COLUMNS (CONDITIONAL)
-- =====================================================
PRINT '6. Adding tracking columns...';

IF @usersTableExists = 1 AND @usersPKColumn IS NOT NULL
BEGIN
    -- server_maintenance
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_maintenance')
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_maintenance') AND name = 'scheduled_by_user_id')
        BEGIN
            DECLARE @addSchedSQL NVARCHAR(500);
            SET @addSchedSQL = 'ALTER TABLE dbo.server_maintenance ADD scheduled_by_user_id INT NULL;
            ALTER TABLE dbo.server_maintenance ADD CONSTRAINT FK_server_maintenance_scheduled_by 
                FOREIGN KEY (scheduled_by_user_id) REFERENCES dbo.Users(' + @usersPKColumn + ') ON DELETE SET NULL';
            EXEC(@addSchedSQL);
            PRINT '  [OK] scheduled_by_user_id';
        END
        
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_maintenance') AND name = 'assigned_engineer_id')
        AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'engineers')
        BEGIN
            ALTER TABLE dbo.server_maintenance ADD assigned_engineer_id INT NULL;
            ALTER TABLE dbo.server_maintenance ADD CONSTRAINT FK_server_maintenance_assigned_engineer 
                FOREIGN KEY (assigned_engineer_id) REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;
            PRINT '  [OK] assigned_engineer_id';
        END
        
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_maintenance') AND name = 'schedule_type')
        BEGIN
            ALTER TABLE dbo.server_maintenance ADD schedule_type NVARCHAR(20) NULL;
        END
    END
    
    -- server_incidents
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_incidents')
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_incidents') AND name = 'created_by_user_id')
        BEGIN
            DECLARE @addIncidentSQL NVARCHAR(500);
            SET @addIncidentSQL = 'ALTER TABLE dbo.server_incidents ADD created_by_user_id INT NULL;
            ALTER TABLE dbo.server_incidents ADD CONSTRAINT FK_server_incidents_created_by 
                FOREIGN KEY (created_by_user_id) REFERENCES dbo.Users(' + @usersPKColumn + ') ON DELETE SET NULL';
            EXEC(@addIncidentSQL);
            PRINT '  [OK] created_by_user_id';
        END
    END
    
    -- engineers
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'engineers')
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.engineers') AND name = 'user_id')
        BEGIN
            DECLARE @addEngineerSQL NVARCHAR(500);
            SET @addEngineerSQL = 'ALTER TABLE dbo.engineers ADD user_id INT NULL;
            ALTER TABLE dbo.engineers ADD CONSTRAINT FK_engineers_user 
                FOREIGN KEY (user_id) REFERENCES dbo.Users(' + @usersPKColumn + ') ON DELETE SET NULL';
            EXEC(@addEngineerSQL);
            
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_engineers_user_id' AND object_id = OBJECT_ID('dbo.engineers'))
            BEGIN
                CREATE INDEX IX_engineers_user_id ON dbo.engineers(user_id);
            END
            PRINT '  [OK] user_id link';
        END
    END
END

-- servers.engineer_id
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'servers')
AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'engineers')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'engineer_id')
    BEGIN
        ALTER TABLE dbo.servers ADD engineer_id INT NULL;
        ALTER TABLE dbo.servers ADD CONSTRAINT FK_servers_engineer 
            FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;
        PRINT '  [OK] engineer_id';
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_engineer_id' AND object_id = OBJECT_ID('dbo.servers'))
    BEGIN
        CREATE INDEX IX_servers_engineer_id ON dbo.servers(engineer_id);
    END
END

PRINT '';

-- =====================================================
-- DONE
-- =====================================================
PRINT '========================================';
PRINT 'INSTALLATION COMPLETE!';
PRINT '========================================';
PRINT '';

SELECT 'Roles' AS Item, COUNT(*) AS Count FROM dbo.roles
UNION ALL SELECT 'Permissions', COUNT(*) FROM dbo.permissions
UNION ALL SELECT 'Role-Permissions', COUNT(*) FROM dbo.role_permissions;

PRINT '';

SET NOCOUNT OFF;

GO
