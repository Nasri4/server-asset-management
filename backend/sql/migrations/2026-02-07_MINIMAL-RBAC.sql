-- =====================================================
-- MINIMAL RBAC SETUP
-- Adds only essential RBAC columns to existing tables
-- Safe to run multiple times
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'MINIMAL RBAC MIGRATION';
PRINT '========================================';
PRINT '';

-- =====================================================
-- 1) CREATE ROLES TABLE
-- =====================================================
PRINT '1. Creating roles table...';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'roles' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.roles (
        role_id INT IDENTITY(1,1) PRIMARY KEY,
        role_name NVARCHAR(50) NOT NULL UNIQUE,
        description NVARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT '   ✓ roles table created';
END
ELSE
BEGIN
    PRINT '   ⊘ roles table already exists';
END

GO

-- =====================================================
-- 2) SEED ROLES
-- =====================================================
PRINT '2. Seeding roles...';

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_name = 'Admin')
BEGIN
    INSERT INTO dbo.roles (role_name, description) VALUES ('Admin', 'Full system access');
    PRINT '   ✓ Admin role created';
END

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_name = 'TeamLead')
BEGIN
    INSERT INTO dbo.roles (role_name, description) VALUES ('TeamLead', 'Team-scoped manager');
    PRINT '   ✓ TeamLead role created';
END

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_name = 'Engineer')
BEGIN
    INSERT INTO dbo.roles (role_name, description) VALUES ('Engineer', 'Assigned servers operator');
    PRINT '   ✓ Engineer role created';
END

PRINT '';

GO

-- =====================================================
-- 3) CREATE TEAMS TABLE (if not exists)
-- =====================================================
PRINT '3. Creating teams table...';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'teams' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.teams (
        team_id INT IDENTITY(1,1) PRIMARY KEY,
        team_name NVARCHAR(100) NOT NULL,
        description NVARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
    );
    PRINT '   ✓ teams table created';
    
    -- Add a default team
    INSERT INTO dbo.teams (team_name, description) VALUES ('Engineering Team', 'Default engineering team');
    PRINT '   ✓ Default team created';
END
ELSE
BEGIN
    PRINT '   ⊘ teams table already exists';
END

PRINT '';

GO

-- =====================================================
-- 4) ADD RBAC COLUMNS TO USERS TABLE
-- =====================================================
PRINT '4. Adding RBAC columns to Users table...';

-- Add role_id column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'role_id')
BEGIN
    ALTER TABLE dbo.Users ADD role_id INT NULL;
    PRINT '   ✓ Added role_id column';
END
ELSE
BEGIN
    PRINT '   ⊘ role_id column already exists';
END

-- Add team_id column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'team_id')
BEGIN
    ALTER TABLE dbo.Users ADD team_id INT NULL;
    PRINT '   ✓ Added team_id column';
END
ELSE
BEGIN
    PRINT '   ⊘ team_id column already exists';
END

-- Add email column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'email')
BEGIN
    ALTER TABLE dbo.Users ADD email NVARCHAR(255) NULL;
    PRINT '   ✓ Added email column';
END
ELSE
BEGIN
    PRINT '   ⊘ email column already exists';
END

-- Add full_name column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'full_name')
BEGIN
    ALTER TABLE dbo.Users ADD full_name NVARCHAR(255) NULL;
    PRINT '   ✓ Added full_name column';
END
ELSE
BEGIN
    PRINT '   ⊘ full_name column already exists';
END

-- Add is_active column
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'is_active')
BEGIN
    ALTER TABLE dbo.Users ADD is_active BIT NOT NULL DEFAULT 1;
    PRINT '   ✓ Added is_active column';
END
ELSE
BEGIN
    PRINT '   ⊘ is_active column already exists';
END

PRINT '';

GO

-- =====================================================
-- 5) SET DEFAULT ROLE FOR EXISTING USERS
-- =====================================================
PRINT '5. Setting default roles for existing users...';

DECLARE @defaultRoleId INT;
SELECT @defaultRoleId = role_id FROM dbo.roles WHERE role_name = 'Admin';

IF EXISTS (SELECT 1 FROM dbo.Users WHERE role_id IS NULL)
BEGIN
    UPDATE dbo.Users 
    SET role_id = @defaultRoleId 
    WHERE role_id IS NULL;
    
    PRINT '   ✓ Set existing users to Admin role';
END
ELSE
BEGIN
    PRINT '   ⊘ All users already have roles';
END

PRINT '';

GO

-- =====================================================
-- 6) ADD FOREIGN KEY CONSTRAINTS
-- =====================================================
PRINT '6. Adding foreign key constraints...';

-- Add FK: Users.role_id -> roles.role_id
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Users_roles')
BEGIN
    ALTER TABLE dbo.Users 
    ADD CONSTRAINT FK_Users_roles 
    FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id);
    
    PRINT '   ✓ Added FK: Users -> roles';
END
ELSE
BEGIN
    PRINT '   ⊘ FK: Users -> roles already exists';
END

-- Add FK: Users.team_id -> teams.team_id
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Users_teams')
BEGIN
    ALTER TABLE dbo.Users 
    ADD CONSTRAINT FK_Users_teams 
    FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id);
    
    PRINT '   ✓ Added FK: Users -> teams';
END
ELSE
BEGIN
    PRINT '   ⊘ FK: Users -> teams already exists';
END

PRINT '';

GO

-- =====================================================
-- 7) CREATE INDEXES
-- =====================================================
PRINT '7. Creating indexes...';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_role_id')
BEGIN
    CREATE INDEX IX_Users_role_id ON dbo.Users(role_id);
    PRINT '   ✓ Created index on Users.role_id';
END
ELSE
BEGIN
    PRINT '   ⊘ Index IX_Users_role_id already exists';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_team_id')
BEGIN
    CREATE INDEX IX_Users_team_id ON dbo.Users(team_id);
    PRINT '   ✓ Created index on Users.team_id';
END
ELSE
BEGIN
    PRINT '   ⊘ Index IX_Users_team_id already exists';
END

PRINT '';

GO

-- =====================================================
-- SUMMARY
-- =====================================================
PRINT '';
PRINT '========================================';
PRINT 'MINIMAL RBAC MIGRATION COMPLETE!';
PRINT '========================================';
PRINT '';
PRINT 'Created:';
PRINT '  • roles table with 3 roles (Admin, TeamLead, Engineer)';
PRINT '  • teams table (if not existed)';
PRINT '  • RBAC columns in Users table (role_id, team_id, email, full_name, is_active)';
PRINT '  • Foreign key constraints';
PRINT '  • Indexes';
PRINT '';
PRINT 'Next step:';
PRINT '  Run: CREATE_TEST_USERS.sql';
PRINT '';

-- Show current state
SELECT 
    role_id,
    role_name,
    description
FROM dbo.roles;

PRINT '';
PRINT 'Existing users:';
SELECT 
    username,
    email,
    full_name,
    role_id,
    team_id,
    is_active
FROM dbo.Users;

GO
