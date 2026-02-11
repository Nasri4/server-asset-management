-- =====================================================
-- CREATE AUTH STORED PROCEDURES
-- Required for login to work
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

-- =====================================================
-- sp_get_user_permissions
-- Returns user roles and permissions
-- Called by auth system on login
-- =====================================================

IF OBJECT_ID('dbo.sp_get_user_permissions', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_get_user_permissions;
GO

CREATE PROCEDURE dbo.sp_get_user_permissions
    @username NVARCHAR(100) = NULL,
    @email NVARCHAR(320) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Normalize inputs
    DECLARE @usernameNorm NVARCHAR(100) = LOWER(LTRIM(RTRIM(COALESCE(@username, @email, ''))));
    
    -- Find user (try username first, then email if provided)
    DECLARE @userId INT;
    
    SELECT TOP 1 @userId = user_id
    FROM dbo.Users
    WHERE LOWER(username) = @usernameNorm
       OR (@email IS NOT NULL AND LOWER(username) = LOWER(@email));
    
    IF @userId IS NULL
    BEGIN
        -- Return empty recordsets (auth will handle)
        SELECT role_name FROM dbo.roles WHERE 1=0;
        SELECT permission_key FROM dbo.role_permissions WHERE 1=0;
        RETURN;
    END
    
    -- Recordset 1: User roles
    SELECT DISTINCT r.role_name
    FROM dbo.user_roles ur
    JOIN dbo.roles r ON r.role_id = ur.role_id
    WHERE ur.user_id = @userId;
    
    -- Recordset 2: User permissions (from roles)
    -- Check if role_permissions has permission_key column
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.role_permissions') AND name = 'permission_key')
    BEGIN
        SELECT DISTINCT rp.permission_key
        FROM dbo.user_roles ur
        JOIN dbo.role_permissions rp ON rp.role_id = ur.role_id
        WHERE ur.user_id = @userId;
    END
    ELSE
    BEGIN
        -- If permission_key doesn't exist, return empty recordset
        -- Auth system will use default permissions
        SELECT TOP 0 '' as permission_key;
    END
END
GO

PRINT '✓ Created sp_get_user_permissions';
GO

-- =====================================================
-- sp_upsert_user_from_login
-- Creates/updates user on login (if needed)
-- =====================================================

IF OBJECT_ID('dbo.sp_upsert_user_from_login', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_upsert_user_from_login;
GO

CREATE PROCEDURE dbo.sp_upsert_user_from_login
    @email NVARCHAR(320),
    @full_name NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @emailNorm NVARCHAR(320) = LOWER(LTRIM(RTRIM(@email)));
    DECLARE @userId INT;
    
    -- Check if user exists
    SELECT @userId = user_id
    FROM dbo.Users
    WHERE LOWER(username) = @emailNorm;
    
    IF @userId IS NULL
    BEGIN
        -- Get default team (first team, or create one)
        DECLARE @defaultTeamId INT;
        SELECT TOP 1 @defaultTeamId = team_id FROM dbo.teams ORDER BY team_id;
        
        IF @defaultTeamId IS NULL
        BEGIN
            INSERT INTO dbo.teams (team_name) VALUES ('Default Team');
            SET @defaultTeamId = SCOPE_IDENTITY();
        END
        
        -- Create user
        INSERT INTO dbo.Users (username, full_name, team_id, is_active)
        VALUES (@emailNorm, @full_name, @defaultTeamId, 1);
        
        SET @userId = SCOPE_IDENTITY();
        
        -- Assign default Engineer role
        DECLARE @engineerRoleId INT = (SELECT role_id FROM dbo.roles WHERE LOWER(role_name) = 'engineer');
        
        IF @engineerRoleId IS NOT NULL
        BEGIN
            INSERT INTO dbo.user_roles (user_id, role_id)
            VALUES (@userId, @engineerRoleId);
        END
    END
    ELSE IF @full_name IS NOT NULL
    BEGIN
        -- Update full_name if provided
        UPDATE dbo.Users
        SET full_name = @full_name
        WHERE user_id = @userId;
    END
    
    SELECT @userId as user_id;
END
GO

PRINT '✓ Created sp_upsert_user_from_login';
GO

PRINT '';
PRINT '========================================';
PRINT 'AUTH PROCEDURES CREATED SUCCESSFULLY';
PRINT '========================================';
PRINT '';
PRINT 'You can now login!';
PRINT '';
GO
