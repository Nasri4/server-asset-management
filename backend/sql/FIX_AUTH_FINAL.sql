-- =====================================================
-- FINAL AUTH FIX
-- Uses GO statements to ensure proper batch execution
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'FINAL AUTH FIX';
PRINT '========================================';
PRINT '';

-- =====================================================
-- STEP 1: Drop and recreate role_permissions
-- =====================================================
PRINT '1. Recreating role_permissions...';

-- Drop foreign keys that reference role_permissions
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_role_permissions_role')
    ALTER TABLE dbo.role_permissions DROP CONSTRAINT FK_role_permissions_role;

-- Drop old table
IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL
    DROP TABLE dbo.role_permissions;

-- Create new table with correct structure
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
GO

-- =====================================================
-- STEP 2: Seed permissions
-- =====================================================
PRINT '2. Seeding permissions...';

DECLARE @adminId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Admin');
DECLARE @engineerId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Engineer');
DECLARE @viewerId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Viewer');

-- Admin permissions
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
    
    PRINT '   ✓ Admin: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' permissions';
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
    
    PRINT '   ✓ Engineer: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' permissions';
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
    
    PRINT '   ✓ Viewer: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' permissions';
END

PRINT '';
GO

-- =====================================================
-- STEP 3: Assign developer to Admin role
-- =====================================================
PRINT '3. Setting up developer user...';

DECLARE @devUserId INT = (SELECT user_id FROM dbo.Users WHERE username = 'developer');
DECLARE @adminId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Admin');

IF @devUserId IS NOT NULL AND @adminId IS NOT NULL
BEGIN
    -- Remove old assignments
    DELETE FROM dbo.user_roles WHERE user_id = @devUserId;
    
    -- Add Admin role
    INSERT INTO dbo.user_roles (user_id, role_id)
    VALUES (@devUserId, @adminId);
    
    PRINT '   ✓ Assigned Admin role to developer';
    
    -- Show user details
    SELECT 
        u.user_id,
        u.username,
        u.full_name,
        CASE WHEN u.password_hash IS NULL OR LEN(u.password_hash) = 0 
             THEN 'NO PASSWORD SET' 
             ELSE 'Password set' 
        END as password_status,
        r.role_name
    FROM dbo.Users u
    JOIN dbo.user_roles ur ON u.user_id = ur.user_id
    JOIN dbo.roles r ON r.role_id = ur.role_id
    WHERE u.user_id = @devUserId;
END
ELSE
BEGIN
    IF @devUserId IS NULL
        PRINT '   ⚠ Developer user not found';
    IF @adminId IS NULL
        PRINT '   ⚠ Admin role not found';
END

PRINT '';
GO

-- =====================================================
-- STEP 4: Create stored procedure
-- =====================================================
PRINT '4. Creating stored procedure...';

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
GO

-- =====================================================
-- STEP 5: Test the stored procedure
-- =====================================================
PRINT '5. Testing stored procedure...';
PRINT '';

EXEC dbo.sp_get_user_permissions @username = 'developer';
GO

-- =====================================================
-- STEP 6: Check developer password
-- =====================================================
PRINT '';
PRINT '6. Checking developer password...';

DECLARE @devPass NVARCHAR(255);
SELECT @devPass = password_hash 
FROM dbo.Users 
WHERE username = 'developer';

IF @devPass IS NULL OR LEN(@devPass) = 0
BEGIN
    PRINT '   ⚠ Developer has NO password set!';
    PRINT '';
    PRINT '   To set password, run:';
    PRINT '   UPDATE dbo.Users';
    PRINT '   SET password_hash = ''$2b$10$YourHashHere''';
    PRINT '   WHERE username = ''developer'';';
END
ELSE
BEGIN
    PRINT '   ✓ Developer has password set';
    PRINT '   Password hash: ' + LEFT(@devPass, 20) + '...';
END

PRINT '';
PRINT '========================================';
PRINT '✅ FIX COMPLETE';
PRINT '========================================';
PRINT '';
GO
