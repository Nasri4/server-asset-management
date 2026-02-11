-- =====================================================
-- COMPLETE AUTH REBUILD
-- Drops and recreates all auth-related tables properly
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'COMPLETE AUTH REBUILD';
PRINT '========================================';
PRINT '';

-- =====================================================
-- STEP 1: Drop existing constraints and tables
-- =====================================================
PRINT '1. Cleaning up existing structures...';

-- Drop foreign keys
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_roles_user')
    ALTER TABLE dbo.user_roles DROP CONSTRAINT FK_user_roles_user;

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_roles_role')
    ALTER TABLE dbo.user_roles DROP CONSTRAINT FK_user_roles_role;

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_role_permissions_role')
    ALTER TABLE dbo.role_permissions DROP CONSTRAINT FK_role_permissions_role;

-- Backup and drop role_permissions
IF OBJECT_ID('dbo.role_permissions_old', 'U') IS NOT NULL
    DROP TABLE dbo.role_permissions_old;

IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL
BEGIN
    SELECT * INTO dbo.role_permissions_old FROM dbo.role_permissions;
    DROP TABLE dbo.role_permissions;
    PRINT '   ✓ Backed up and dropped role_permissions';
END

PRINT '';

-- =====================================================
-- STEP 2: Ensure base tables exist
-- =====================================================
PRINT '2. Ensuring base tables exist...';

-- Create roles table if missing
IF OBJECT_ID('dbo.roles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.roles (
        role_id INT IDENTITY(1,1) PRIMARY KEY,
        role_name NVARCHAR(100) NOT NULL UNIQUE,
        description NVARCHAR(500),
        created_at DATETIME2(0) DEFAULT GETDATE()
    );
    
    INSERT INTO dbo.roles (role_name, description) VALUES
    ('Admin', 'Full system access'),
    ('Engineer', 'Technical staff with edit access'),
    ('Viewer', 'Read-only access');
    
    PRINT '   ✓ Created roles table';
END
ELSE
BEGIN
    PRINT '   ✓ Roles table exists';
END

-- Create user_roles table if missing
IF OBJECT_ID('dbo.user_roles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_roles (
        user_role_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        role_id INT NOT NULL,
        assigned_at DATETIME2(0) DEFAULT GETDATE(),
        CONSTRAINT FK_user_roles_user 
            FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id) ON DELETE CASCADE,
        CONSTRAINT FK_user_roles_role 
            FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id) ON DELETE CASCADE,
        CONSTRAINT UQ_user_roles_user_role 
            UNIQUE (user_id, role_id)
    );
    
    PRINT '   ✓ Created user_roles table';
END
ELSE
BEGIN
    PRINT '   ✓ user_roles table exists';
    
    -- Re-add foreign keys if missing
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_roles_user')
    BEGIN
        ALTER TABLE dbo.user_roles
        ADD CONSTRAINT FK_user_roles_user 
            FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id) ON DELETE CASCADE;
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_roles_role')
    BEGIN
        ALTER TABLE dbo.user_roles
        ADD CONSTRAINT FK_user_roles_role 
            FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id) ON DELETE CASCADE;
    END
END

PRINT '';

-- =====================================================
-- STEP 3: Create role_permissions with correct structure
-- =====================================================
PRINT '3. Creating role_permissions table...';

CREATE TABLE dbo.role_permissions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    role_id INT NOT NULL,
    permission_key NVARCHAR(100) NOT NULL,
    created_at DATETIME2(0) DEFAULT GETDATE(),
    CONSTRAINT FK_role_permissions_role 
        FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id) ON DELETE CASCADE,
    CONSTRAINT UQ_role_permissions_role_permission 
        UNIQUE (role_id, permission_key)
);

PRINT '   ✓ Created role_permissions table';
PRINT '';

-- =====================================================
-- STEP 4: Seed permissions
-- =====================================================
PRINT '4. Seeding permissions...';

DECLARE @adminId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Admin');
DECLARE @engineerId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Engineer');
DECLARE @viewerId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Viewer');

-- Admin permissions (all)
IF @adminId IS NOT NULL
BEGIN
    INSERT INTO dbo.role_permissions (role_id, permission_key) VALUES
    (@adminId, 'admin:all'),
    (@adminId, 'view:all'),
    (@adminId, 'edit:all'),
    (@adminId, 'delete:all'),
    (@adminId, 'view:servers'),
    (@adminId, 'edit:servers'),
    (@adminId, 'delete:servers'),
    (@adminId, 'view:incidents'),
    (@adminId, 'edit:incidents'),
    (@adminId, 'view:maintenance'),
    (@adminId, 'edit:maintenance'),
    (@adminId, 'view:users'),
    (@adminId, 'edit:users'),
    (@adminId, 'view:security'),
    (@adminId, 'edit:security');
    
    PRINT '   ✓ Seeded Admin permissions (' + CAST(@@ROWCOUNT AS VARCHAR) + ')';
END

-- Engineer permissions
IF @engineerId IS NOT NULL
BEGIN
    INSERT INTO dbo.role_permissions (role_id, permission_key) VALUES
    (@engineerId, 'view:all'),
    (@engineerId, 'view:servers'),
    (@engineerId, 'edit:servers'),
    (@engineerId, 'view:incidents'),
    (@engineerId, 'edit:incidents'),
    (@engineerId, 'view:maintenance'),
    (@engineerId, 'edit:maintenance'),
    (@engineerId, 'view:security');
    
    PRINT '   ✓ Seeded Engineer permissions (' + CAST(@@ROWCOUNT AS VARCHAR) + ')';
END

-- Viewer permissions
IF @viewerId IS NOT NULL
BEGIN
    INSERT INTO dbo.role_permissions (role_id, permission_key) VALUES
    (@viewerId, 'view:all'),
    (@viewerId, 'view:servers'),
    (@viewerId, 'view:incidents'),
    (@viewerId, 'view:maintenance'),
    (@viewerId, 'view:security');
    
    PRINT '   ✓ Seeded Viewer permissions (' + CAST(@@ROWCOUNT AS VARCHAR) + ')';
END

PRINT '';

-- =====================================================
-- STEP 5: Assign developer user to Admin role
-- =====================================================
PRINT '5. Setting up developer user...';

DECLARE @devUserId INT = (SELECT user_id FROM dbo.Users WHERE username = 'developer');

IF @devUserId IS NOT NULL
BEGIN
    -- Remove old role assignments
    DELETE FROM dbo.user_roles WHERE user_id = @devUserId;
    
    -- Assign Admin role
    IF @adminId IS NOT NULL
    BEGIN
        INSERT INTO dbo.user_roles (user_id, role_id)
        VALUES (@devUserId, @adminId);
        
        PRINT '   ✓ Assigned Admin role to developer';
    END
    
    -- Show user info
    SELECT 
        u.user_id,
        u.username,
        u.full_name,
        r.role_name,
        COUNT(rp.id) as permission_count
    FROM dbo.Users u
    JOIN dbo.user_roles ur ON u.user_id = ur.user_id
    JOIN dbo.roles r ON r.role_id = ur.role_id
    LEFT JOIN dbo.role_permissions rp ON rp.role_id = r.role_id
    WHERE u.user_id = @devUserId
    GROUP BY u.user_id, u.username, u.full_name, r.role_name;
END
ELSE
BEGIN
    PRINT '   ⚠ Developer user not found';
END

PRINT '';

-- =====================================================
-- STEP 6: Recreate stored procedures
-- =====================================================
PRINT '6. Creating stored procedures...';

-- Drop existing
IF OBJECT_ID('dbo.sp_get_user_permissions', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_get_user_permissions;
GO

CREATE PROCEDURE dbo.sp_get_user_permissions
    @username NVARCHAR(100) = NULL,
    @email NVARCHAR(320) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @usernameNorm NVARCHAR(100) = LOWER(LTRIM(RTRIM(COALESCE(@username, @email, ''))));
    DECLARE @userId INT;
    
    -- Find user
    SELECT TOP 1 @userId = user_id
    FROM dbo.Users
    WHERE LOWER(username) = @usernameNorm
       OR (@email IS NOT NULL AND LOWER(username) = LOWER(@email));
    
    IF @userId IS NULL
    BEGIN
        SELECT role_name FROM dbo.roles WHERE 1=0;
        SELECT permission_key FROM dbo.role_permissions WHERE 1=0;
        RETURN;
    END
    
    -- Recordset 1: User roles
    SELECT DISTINCT r.role_name
    FROM dbo.user_roles ur
    JOIN dbo.roles r ON r.role_id = ur.role_id
    WHERE ur.user_id = @userId;
    
    -- Recordset 2: User permissions
    SELECT DISTINCT rp.permission_key
    FROM dbo.user_roles ur
    JOIN dbo.role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = @userId;
END
GO

PRINT '   ✓ Created sp_get_user_permissions';
PRINT '';

-- =====================================================
-- STEP 7: Test the setup
-- =====================================================
PRINT '7. Testing auth setup...';
PRINT '';
PRINT 'Testing sp_get_user_permissions for developer:';
EXEC dbo.sp_get_user_permissions @username = 'developer';
PRINT '';

PRINT '========================================';
PRINT '✅ AUTH REBUILD COMPLETE';
PRINT '========================================';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Restart backend: npm run dev';
PRINT '2. Login at http://localhost:3000/login';
PRINT '   Username: developer';
PRINT '   Password: developer123';
PRINT '';
GO
