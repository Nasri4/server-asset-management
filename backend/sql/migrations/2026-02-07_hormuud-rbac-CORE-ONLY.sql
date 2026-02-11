-- =====================================================
-- HORMUUD TELECOM - RBAC CORE (MINIMAL)
-- Creates only RBAC tables, no modifications
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'HORMUUD RBAC - CORE INSTALLATION';
PRINT '========================================';

-- =====================================================
-- 1. CREATE ROLES
-- =====================================================
PRINT '';
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
    
    INSERT INTO dbo.roles (role_name, description) VALUES 
    ('Admin', 'Full system access'),
    ('TeamLead', 'Team-scoped manager'),
    ('Engineer', 'Restricted operator');
    
    PRINT '   SUCCESS: Roles created';
END
ELSE
BEGIN
    PRINT '   SKIP: Roles exist';
    
    IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_name = 'Admin')
    BEGIN
        INSERT INTO dbo.roles (role_name, description) VALUES 
        ('Admin', 'Full system access'),
        ('TeamLead', 'Team-scoped manager'),
        ('Engineer', 'Restricted operator');
    END
END

-- =====================================================
-- 2. DROP OLD PERMISSIONS IF WRONG SCHEMA
-- =====================================================
PRINT '';
PRINT '2. Checking permissions table...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'permissions')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.permissions') AND name = 'permission_name')
    BEGIN
        PRINT '   WARN: Old permissions schema detected';
        
        IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'role_permissions')
        BEGIN
            DROP TABLE dbo.role_permissions;
            PRINT '   SUCCESS: Dropped role_permissions';
        END
        
        DROP TABLE dbo.permissions;
        PRINT '   SUCCESS: Dropped old permissions';
    END
END

-- =====================================================
-- 3. CREATE PERMISSIONS
-- =====================================================
PRINT '';
PRINT '3. Creating permissions table...';

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
    ('maintenance.read.all', 'Read All Maintenance', 'maintenance', 'View all'),
    ('maintenance.read.team', 'Read Team Maintenance', 'maintenance', 'View team'),
    ('maintenance.read.own', 'Read Own Maintenance', 'maintenance', 'View assigned'),
    ('maintenance.schedule.all', 'Schedule All Maintenance', 'maintenance', 'Schedule any'),
    ('maintenance.schedule.team', 'Schedule Team Maintenance', 'maintenance', 'Schedule team'),
    ('maintenance.complete.assigned', 'Complete Assigned Maintenance', 'maintenance', 'Complete'),
    ('incidents.read.all', 'Read All Incidents', 'incidents', 'View all'),
    ('incidents.read.team', 'Read Team Incidents', 'incidents', 'View team'),
    ('incidents.read.own', 'Read Own Incidents', 'incidents', 'View assigned'),
    ('incidents.create', 'Create Incidents', 'incidents', 'Create'),
    ('incidents.update', 'Update Incidents', 'incidents', 'Update'),
    ('visits.read.all', 'Read All Visits', 'visits', 'View all'),
    ('visits.read.team', 'Read Team Visits', 'visits', 'View team'),
    ('visits.read.own', 'Read Own Visits', 'visits', 'View own'),
    ('visits.create.own', 'Create Own Visits', 'visits', 'Create'),
    ('visits.complete.own', 'Complete Own Visits', 'visits', 'Complete'),
    ('security.manage.all', 'Manage All Security', 'security', 'All'),
    ('security.manage.team', 'Manage Team Security', 'security', 'Team'),
    ('security.manage.own', 'Manage Own Security', 'security', 'Own'),
    ('security.reveal.all', 'Reveal All Credentials', 'security', 'All'),
    ('security.reveal.team', 'Reveal Team Credentials', 'security', 'Team'),
    ('security.reveal.own', 'Reveal Own Credentials', 'security', 'Own'),
    ('reports.view.all', 'View All Reports', 'reports', 'Global'),
    ('reports.view.team', 'View Team Reports', 'reports', 'Team'),
    ('reports.view.own', 'View Own Reports', 'reports', 'Personal'),
    ('auditlogs.view', 'View Audit Logs', 'system', 'Audit logs'),
    ('settings.manage', 'Manage Settings', 'system', 'Settings'),
    ('users.manage.all', 'Manage All Users', 'users', 'All users'),
    ('users.manage.team', 'Manage Team Users', 'users', 'Team users');
    
    PRINT '   SUCCESS: 35 permissions created';
END
ELSE
BEGIN
    PRINT '   SKIP: Permissions exist';
END

-- =====================================================
-- 4. CREATE ROLE_PERMISSIONS
-- =====================================================
PRINT '';
PRINT '4. Creating role_permissions...';

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
    
    -- Get role IDs
    DECLARE @adminId INT;
    DECLARE @teamLeadId INT;
    DECLARE @engineerId INT;
    
    SELECT @adminId = role_id FROM dbo.roles WHERE role_name = 'Admin';
    SELECT @teamLeadId = role_id FROM dbo.roles WHERE role_name = 'TeamLead';
    SELECT @engineerId = role_id FROM dbo.roles WHERE role_name = 'Engineer';
    
    -- Admin: All
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @adminId, permission_id FROM dbo.permissions;
    
    -- TeamLead
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @teamLeadId, permission_id FROM dbo.permissions
    WHERE permission_key IN (
        'servers.read.team',
        'maintenance.read.team',
        'maintenance.schedule.team',
        'incidents.read.team',
        'incidents.create',
        'incidents.update',
        'visits.read.team',
        'security.manage.team',
        'reports.view.team',
        'users.manage.team'
    );
    
    -- Engineer
    INSERT INTO dbo.role_permissions (role_id, permission_id)
    SELECT @engineerId, permission_id FROM dbo.permissions
    WHERE permission_key IN (
        'servers.read.own',
        'servers.read.team',
        'maintenance.read.own',
        'maintenance.complete.assigned',
        'incidents.read.own',
        'visits.read.own',
        'visits.create.own',
        'visits.complete.own',
        'security.manage.own',
        'security.reveal.own',
        'reports.view.own'
    );
    
    PRINT '   SUCCESS: Permissions assigned';
END
ELSE
BEGIN
    PRINT '   SKIP: role_permissions exist';
END

-- =====================================================
-- DONE
-- =====================================================
PRINT '';
PRINT '========================================';
PRINT 'SUCCESS!';
PRINT '========================================';
PRINT '';
PRINT 'Created:';
PRINT '  - 3 Roles';
PRINT '  - 35 Permissions';
PRINT '  - Role-Permission mappings';
PRINT '';
PRINT 'Run this to verify:';
PRINT '  SELECT * FROM dbo.roles;';
PRINT '  SELECT * FROM dbo.permissions;';
PRINT '  SELECT r.role_name, COUNT(*) as perms';
PRINT '  FROM dbo.roles r';
PRINT '  JOIN dbo.role_permissions rp ON r.role_id = rp.role_id';
PRINT '  GROUP BY r.role_name;';
PRINT '';
PRINT 'Next: Review HORMUUD_RBAC_QUICK_START.md';
PRINT '';

SET NOCOUNT OFF;

GO
