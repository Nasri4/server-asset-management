-- =====================================================
-- FINAL AUTH AND PASSWORD FIX
-- Complete setup for developer login
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'FINAL AUTH AND PASSWORD FIX';
PRINT '========================================';
PRINT '';

-- =====================================================
-- STEP 1: Ensure teams table exists and has at least one team
-- =====================================================
PRINT '1. Checking teams...';

IF OBJECT_ID('dbo.teams', 'U') IS NULL
BEGIN
    PRINT '   ⚠ teams table does not exist - creating it...';
    
    CREATE TABLE dbo.teams (
        team_id INT IDENTITY(1,1) PRIMARY KEY,
        team_name NVARCHAR(200) NOT NULL UNIQUE,
        description NVARCHAR(500),
        created_at DATETIME2(0) DEFAULT GETDATE()
    );
    
    INSERT INTO dbo.teams (team_name, description)
    VALUES ('IT Operations', 'Default IT operations team');
    
    PRINT '   ✓ Created teams table';
END
ELSE
BEGIN
    PRINT '   ✓ teams table exists';
    
    -- Ensure at least one team exists
    IF NOT EXISTS (SELECT 1 FROM dbo.teams)
    BEGIN
        INSERT INTO dbo.teams (team_name, description)
        VALUES ('IT Operations', 'Default IT operations team');
        PRINT '   ✓ Created default team';
    END
END

DECLARE @defaultTeamId INT = (SELECT TOP 1 team_id FROM dbo.teams ORDER BY team_id);
PRINT '   Default team_id: ' + CAST(@defaultTeamId AS VARCHAR);
PRINT '';
GO

-- =====================================================
-- STEP 2: Drop and recreate role_permissions
-- =====================================================
PRINT '2. Recreating role_permissions...';

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_role_permissions_role')
    ALTER TABLE dbo.role_permissions DROP CONSTRAINT FK_role_permissions_role;

IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL
    DROP TABLE dbo.role_permissions;

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
-- STEP 3: Seed permissions
-- =====================================================
PRINT '3. Seeding permissions...';

DECLARE @adminId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Admin');
DECLARE @engineerId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Engineer');
DECLARE @viewerId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Viewer');

IF @adminId IS NOT NULL
BEGIN
    INSERT INTO dbo.role_permissions (role_id, permission_key) VALUES
    (@adminId, 'admin:all'),
    (@adminId, 'view:all'),
    (@adminId, 'edit:all'),
    (@adminId, 'delete:all');
    PRINT '   ✓ Admin: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' permissions';
END

IF @engineerId IS NOT NULL
BEGIN
    INSERT INTO dbo.role_permissions (role_id, permission_key) VALUES
    (@engineerId, 'view:all'),
    (@engineerId, 'edit:all');
    PRINT '   ✓ Engineer: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' permissions';
END

IF @viewerId IS NOT NULL
BEGIN
    INSERT INTO dbo.role_permissions (role_id, permission_key) VALUES
    (@viewerId, 'view:all');
    PRINT '   ✓ Viewer: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' permissions';
END

PRINT '';
GO

-- =====================================================
-- STEP 4: Setup developer user
-- =====================================================
PRINT '4. Setting up developer user...';

DECLARE @devUserId INT = (SELECT user_id FROM dbo.Users WHERE username = 'developer');
DECLARE @adminId INT = (SELECT role_id FROM dbo.roles WHERE role_name = 'Admin');
DECLARE @defaultTeamId INT = (SELECT TOP 1 team_id FROM dbo.teams ORDER BY team_id);

IF @devUserId IS NULL
BEGIN
    PRINT '   ⚠ Developer user not found in Users table';
    PRINT '   Creating developer user...';
    
    INSERT INTO dbo.Users (username, full_name, team_id, is_active, password_hash)
    VALUES (
        'developer',
        'Developer User',
        @defaultTeamId,
        1,
        '$2b$12$Ll.Af27AxRwR1BvMx57ag.F3TH7Pomg7AfDQkSLxfptdq7uilwOF6'
    );
    
    SET @devUserId = SCOPE_IDENTITY();
    PRINT '   ✓ Created developer user with ID: ' + CAST(@devUserId AS VARCHAR);
END
ELSE
BEGIN
    PRINT '   ✓ Developer user found with ID: ' + CAST(@devUserId AS VARCHAR);
    
    -- Ensure developer has team_id
    UPDATE dbo.Users
    SET team_id = @defaultTeamId,
        is_active = 1,
        password_hash = '$2b$12$Ll.Af27AxRwR1BvMx57ag.F3TH7Pomg7AfDQkSLxfptdq7uilwOF6'
    WHERE user_id = @devUserId;
    
    PRINT '   ✓ Updated developer: password, team_id, is_active';
END

-- Assign Admin role
DELETE FROM dbo.user_roles WHERE user_id = @devUserId;

INSERT INTO dbo.user_roles (user_id, role_id)
VALUES (@devUserId, @adminId);

PRINT '   ✓ Assigned Admin role';
PRINT '';

-- Show final user state
SELECT 
    u.user_id,
    u.username,
    u.full_name,
    u.team_id,
    t.team_name,
    u.is_active,
    CASE WHEN u.password_hash IS NULL OR LEN(u.password_hash) = 0 
         THEN 'NO PASSWORD' 
         ELSE 'HAS PASSWORD (length: ' + CAST(LEN(u.password_hash) AS VARCHAR) + ')' 
    END as password_status,
    r.role_name
FROM dbo.Users u
LEFT JOIN dbo.teams t ON t.team_id = u.team_id
LEFT JOIN dbo.user_roles ur ON u.user_id = ur.user_id
LEFT JOIN dbo.roles r ON r.role_id = ur.role_id
WHERE u.user_id = @devUserId;

PRINT '';
GO

-- =====================================================
-- STEP 5: Create stored procedure
-- =====================================================
PRINT '5. Creating stored procedure...';

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
GO

-- =====================================================
-- STEP 6: Test everything
-- =====================================================
PRINT '';
PRINT '6. Testing setup...';
PRINT '';
PRINT 'Testing sp_get_user_permissions for developer:';
EXEC dbo.sp_get_user_permissions @username = 'developer';
PRINT '';

PRINT '========================================';
PRINT '✅ SETUP COMPLETE';
PRINT '========================================';
PRINT '';
PRINT 'You can now login with:';
PRINT '  Username: developer';
PRINT '  Password: developer123';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Restart backend: npm run dev';
PRINT '2. Go to: http://localhost:3000/login';
PRINT '';
GO
