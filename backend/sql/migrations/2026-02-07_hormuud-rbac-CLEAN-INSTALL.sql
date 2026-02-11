-- =====================================================
-- HORMUUD TELECOM - RBAC (CLEAN INSTALL)
-- Drops old RBAC tables and creates fresh
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'HORMUUD RBAC - CLEAN INSTALLATION';
PRINT '========================================';
PRINT '';

-- =====================================================
-- STEP 1: DROP OLD RBAC TABLES (CLEAN SLATE)
-- =====================================================
PRINT '1. Removing old RBAC tables...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'role_permissions')
BEGIN
    DROP TABLE dbo.role_permissions;
    PRINT '   Dropped: role_permissions';
END

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'permissions')
BEGIN
    DROP TABLE dbo.permissions;
    PRINT '   Dropped: permissions';
END

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'user_roles')
BEGIN
    DROP TABLE dbo.user_roles;
    PRINT '   Dropped: user_roles';
END

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'roles')
BEGIN
    DROP TABLE dbo.roles;
    PRINT '   Dropped: roles';
END

PRINT '';

-- =====================================================
-- STEP 2: CREATE ROLES
-- =====================================================
PRINT '2. Creating roles table...';

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
PRINT '';

-- =====================================================
-- STEP 3: CREATE PERMISSIONS
-- =====================================================
PRINT '3. Creating permissions table...';

CREATE TABLE dbo.permissions (
    permission_id INT IDENTITY(1,1) NOT NULL,
    permission_key NVARCHAR(100) NOT NULL,
    permission_name NVARCHAR(200) NOT NULL,
    category NVARCHAR(50) NOT NULL,
    description NVARCHAR(500) NULL,
    CONSTRAINT PK_permissions PRIMARY KEY (permission_id),
    CONSTRAINT UQ_permissions_permission_key UNIQUE (permission_key)
);

PRINT '   SUCCESS: Permissions table created';
PRINT '';

-- =====================================================
-- STEP 4: SEED PERMISSIONS (SEPARATE BATCH)
-- =====================================================
GO

PRINT '4. Seeding permissions...';

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

PRINT '   SUCCESS: 35 permissions seeded';
PRINT '';

GO

-- =====================================================
-- STEP 5: CREATE ROLE_PERMISSIONS (SEPARATE BATCH)
-- =====================================================
PRINT '5. Creating role_permissions...';

CREATE TABLE dbo.role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_id),
    CONSTRAINT FK_role_permissions_role FOREIGN KEY (role_id) 
        REFERENCES dbo.roles(role_id) ON DELETE CASCADE,
    CONSTRAINT FK_role_permissions_permission FOREIGN KEY (permission_id) 
        REFERENCES dbo.permissions(permission_id) ON DELETE CASCADE
);

PRINT '   SUCCESS: role_permissions table created';
PRINT '';

GO

-- =====================================================
-- STEP 6: ASSIGN PERMISSIONS (SEPARATE BATCH)
-- =====================================================
PRINT '6. Assigning permissions to roles...';

DECLARE @adminId INT;
DECLARE @teamLeadId INT;
DECLARE @engineerId INT;

SELECT @adminId = role_id FROM dbo.roles WHERE role_name = 'Admin';
SELECT @teamLeadId = role_id FROM dbo.roles WHERE role_name = 'TeamLead';
SELECT @engineerId = role_id FROM dbo.roles WHERE role_name = 'Engineer';

-- Admin: All permissions
INSERT INTO dbo.role_permissions (role_id, permission_id)
SELECT @adminId, permission_id FROM dbo.permissions;

PRINT '   SUCCESS: Admin (35 permissions)';

-- TeamLead: Team-scoped
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

PRINT '   SUCCESS: TeamLead (10 permissions)';

-- Engineer: Own-scoped
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

PRINT '   SUCCESS: Engineer (11 permissions)';
PRINT '';

GO

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================
PRINT '';
PRINT '========================================';
PRINT 'INSTALLATION COMPLETE!';
PRINT '========================================';
PRINT '';
PRINT 'Summary:';

SELECT 
    r.role_name,
    COUNT(rp.permission_id) as permission_count
FROM dbo.roles r
LEFT JOIN dbo.role_permissions rp ON r.role_id = rp.role_id
GROUP BY r.role_name
ORDER BY r.role_name;

PRINT '';
PRINT 'Next steps:';
PRINT '  1. Check Users table: SELECT TOP 5 * FROM dbo.Users;';
PRINT '  2. Run CHECK_USERS_SCHEMA.sql to see table structure';
PRINT '  3. Follow HORMUUD_RBAC_QUICK_START.md';
PRINT '';

GO
