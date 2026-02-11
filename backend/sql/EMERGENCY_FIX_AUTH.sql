-- =====================================================
-- EMERGENCY AUTH FIX
-- Rebuilds role_permissions table with correct structure
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'EMERGENCY AUTH FIX';
PRINT '========================================';
PRINT '';

-- Step 1: Check current role_permissions structure
PRINT '1. Current role_permissions columns:';
IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL
BEGIN
    SELECT 
        '   ' + c.name + ' (' + t.name + 
        CASE WHEN c.max_length > 0 AND t.name LIKE '%char' 
             THEN '(' + CAST(c.max_length AS VARCHAR) + ')' 
             ELSE '' 
        END + ')' AS ColumnInfo
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.role_permissions')
    ORDER BY c.column_id;
END
ELSE
BEGIN
    PRINT '   Table does not exist!';
END
PRINT '';

-- Step 2: Backup existing data
PRINT '2. Backing up existing role_permissions...';
IF OBJECT_ID('dbo.role_permissions_backup', 'U') IS NOT NULL
    DROP TABLE dbo.role_permissions_backup;

IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL
BEGIN
    SELECT * 
    INTO dbo.role_permissions_backup
    FROM dbo.role_permissions;
    
    PRINT '   ✓ Backed up ' + CAST(@@ROWCOUNT AS VARCHAR) + ' rows';
END
ELSE
BEGIN
    PRINT '   No existing table to backup';
END
PRINT '';

-- Step 3: Drop and recreate table with correct structure
PRINT '3. Recreating role_permissions table...';

-- Drop foreign keys first
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_role_permissions_role')
    ALTER TABLE dbo.role_permissions DROP CONSTRAINT FK_role_permissions_role;

-- Drop table
IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL
    DROP TABLE dbo.role_permissions;

-- Create with correct structure
CREATE TABLE dbo.role_permissions (
    role_permission_id INT IDENTITY(1,1) PRIMARY KEY,
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

-- Step 4: Seed default permissions
PRINT '4. Seeding permissions...';

-- Admin gets all permissions
DECLARE @adminRoleId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Admin');
DECLARE @engineerRoleId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Engineer');
DECLARE @viewerRoleId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Viewer');

IF @adminRoleId IS NOT NULL
BEGIN
    INSERT INTO dbo.role_permissions (role_id, permission_key) VALUES
    (@adminRoleId, 'admin:all'),
    (@adminRoleId, 'view:all'),
    (@adminRoleId, 'edit:all'),
    (@adminRoleId, 'delete:all'),
    (@adminRoleId, 'view:servers'),
    (@adminRoleId, 'edit:servers'),
    (@adminRoleId, 'delete:servers'),
    (@adminRoleId, 'view:incidents'),
    (@adminRoleId, 'edit:incidents'),
    (@adminRoleId, 'view:maintenance'),
    (@adminRoleId, 'edit:maintenance'),
    (@adminRoleId, 'view:users'),
    (@adminRoleId, 'edit:users');
    
    PRINT '   ✓ Seeded Admin permissions (' + CAST(@@ROWCOUNT AS VARCHAR) + ')';
END

IF @engineerRoleId IS NOT NULL
BEGIN
    INSERT INTO dbo.role_permissions (role_id, permission_key) VALUES
    (@engineerRoleId, 'view:all'),
    (@engineerRoleId, 'view:servers'),
    (@engineerRoleId, 'edit:servers'),
    (@engineerRoleId, 'view:incidents'),
    (@engineerRoleId, 'edit:incidents'),
    (@engineerRoleId, 'view:maintenance'),
    (@engineerRoleId, 'edit:maintenance');
    
    PRINT '   ✓ Seeded Engineer permissions (' + CAST(@@ROWCOUNT AS VARCHAR) + ')';
END

IF @viewerRoleId IS NOT NULL
BEGIN
    INSERT INTO dbo.role_permissions (role_id, permission_key) VALUES
    (@viewerRoleId, 'view:all'),
    (@viewerRoleId, 'view:servers'),
    (@viewerRoleId, 'view:incidents'),
    (@viewerRoleId, 'view:maintenance');
    
    PRINT '   ✓ Seeded Viewer permissions (' + CAST(@@ROWCOUNT AS VARCHAR) + ')';
END
PRINT '';

-- Step 5: Show final structure
PRINT '5. Final permissions summary:';
SELECT 
    r.role_name,
    COUNT(*) as permission_count,
    STRING_AGG(rp.permission_key, ', ') as permissions
FROM dbo.role_permissions rp
JOIN dbo.roles r ON r.role_id = rp.role_id
GROUP BY r.role_name
ORDER BY r.role_name;
PRINT '';

-- Step 6: Recreate stored procedure without errors
PRINT '6. Recreating sp_get_user_permissions...';

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

-- Step 7: Verify developer user has a role
PRINT '7. Checking developer user setup:';
DECLARE @devUserId INT = (SELECT user_id FROM dbo.Users WHERE username = 'developer');
DECLARE @devHasRole INT = 0;

IF @devUserId IS NOT NULL
BEGIN
    SELECT @devHasRole = COUNT(*)
    FROM dbo.user_roles
    WHERE user_id = @devUserId;
    
    IF @devHasRole = 0
    BEGIN
        PRINT '   ⚠ Developer has no role assigned - assigning Admin role...';
        
        INSERT INTO dbo.user_roles (user_id, role_id)
        SELECT @devUserId, role_id
        FROM dbo.roles
        WHERE role_name = 'Admin';
        
        PRINT '   ✓ Assigned Admin role to developer';
    END
    ELSE
    BEGIN
        PRINT '   ✓ Developer has role(s) assigned';
        
        SELECT 
            u.username,
            r.role_name
        FROM dbo.Users u
        JOIN dbo.user_roles ur ON u.user_id = ur.user_id
        JOIN dbo.roles r ON r.role_id = ur.role_id
        WHERE u.user_id = @devUserId;
    END
END
ELSE
BEGIN
    PRINT '   ⚠ Developer user not found in Users table';
END
PRINT '';

PRINT '========================================';
PRINT '✅ EMERGENCY FIX COMPLETE';
PRINT '========================================';
PRINT '';
PRINT 'NEXT STEPS:';
PRINT '1. Restart your backend server (Ctrl+C then npm run dev)';
PRINT '2. Try logging in with:';
PRINT '   Username: developer';
PRINT '   Password: developer123';
PRINT '';
GO
