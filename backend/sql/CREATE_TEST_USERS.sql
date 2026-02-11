-- =====================================================
-- CREATE TEST USERS (Admin, TeamLead, Engineer)
-- Custom usernames: developer, Ismail, Nasri
-- Run AFTER RBAC tables are created
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

PRINT '========================================';
PRINT 'CREATING TEST USERS (developer / Ismail / Nasri)';
PRINT '========================================';
PRINT '';

-- Get role IDs
DECLARE @adminRoleId INT;
DECLARE @teamLeadRoleId INT;
DECLARE @engineerRoleId INT;

SELECT @adminRoleId = role_id FROM dbo.roles WHERE role_name = 'Admin';
SELECT @teamLeadRoleId = role_id FROM dbo.roles WHERE role_name = 'TeamLead';
SELECT @engineerRoleId = role_id FROM dbo.roles WHERE role_name = 'Engineer';

IF @adminRoleId IS NULL OR @teamLeadRoleId IS NULL OR @engineerRoleId IS NULL
BEGIN
  PRINT 'ERROR: Missing one or more roles (Admin/TeamLead/Engineer). Create roles first.';
  RETURN;
END

PRINT 'Role IDs:';
PRINT '  Admin: ' + CAST(@adminRoleId AS VARCHAR(10));
PRINT '  TeamLead: ' + CAST(@teamLeadRoleId AS VARCHAR(10));
PRINT '  Engineer: ' + CAST(@engineerRoleId AS VARCHAR(10));
PRINT '';

-- Ensure at least one team exists
IF NOT EXISTS (SELECT 1 FROM dbo.teams)
BEGIN
    INSERT INTO dbo.teams (team_name) VALUES ('Engineering Team');
    PRINT 'Created team: Engineering Team';
END

DECLARE @teamId INT;
SELECT TOP 1 @teamId = team_id FROM dbo.teams ORDER BY team_id;
PRINT 'Using team_id: ' + CAST(@teamId AS VARCHAR(10));
PRINT '';

-- =====================================================
-- 1) CREATE ADMIN USER (developer)
-- =====================================================
PRINT '1. Creating Admin user (developer)...';

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = 'developer')
BEGIN
    -- Real bcrypt hash for password: Admin@123
    DECLARE @adminHash NVARCHAR(255) = '$2b$10$oGxmELpu6IL01X0TJDTPJeaxAS6VtV2xOkwz9Wp8PLLwF4VSxGW0W';
    
    INSERT INTO dbo.Users (
        username, 
        email, 
        password_hash, 
        full_name, 
        role_id, 
        team_id, 
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        'developer',
        'admin@hormuud.com',
        @adminHash,
        'System Administrator',
        @adminRoleId,
        NULL, -- Admin not tied to team
        1,
        GETDATE(),
        GETDATE()
    );
    
    PRINT '   SUCCESS: Admin created';
    PRINT '   Username: developer';
    PRINT '   Password: Admin@123';
END
ELSE
BEGIN
    PRINT '   SKIP: developer already exists';
END

PRINT '';

-- =====================================================
-- 2) CREATE TEAM LEAD USER (Ismail)
-- =====================================================
PRINT '2. Creating Team Lead user (Ismail)...';

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = 'Ismail')
BEGIN
    -- Real bcrypt hash for password: Ismail@123
    DECLARE @teamLeadHash NVARCHAR(255) = '$2b$10$d./1LpcNqLkJ7DiERotTgOiLaXzixSZXVxpZppjVmTD8FERRzgtwy';
    
    INSERT INTO dbo.Users (
        username, 
        email, 
        password_hash, 
        full_name, 
        role_id, 
        team_id, 
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        'Ismail',
        'ismail@hormuud.com',
        @teamLeadHash,
        'Ismail CC (Team Lead)',
        @teamLeadRoleId,
        @teamId,
        1,
        GETDATE(),
        GETDATE()
    );
    
    PRINT '   SUCCESS: Team Lead created';
    PRINT '   Username: Ismail';
    PRINT '   Password: Ismail@123';
    PRINT '   Team: ' + CAST(@teamId AS VARCHAR(10));
END
ELSE
BEGIN
    PRINT '   SKIP: Ismail already exists';
END

PRINT '';

-- =====================================================
-- 3) CREATE ENGINEER USER (Nasri)
-- =====================================================
PRINT '3. Creating Engineer user (Nasri)...';

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = 'Nasri')
BEGIN
    -- Real bcrypt hash for password: dev@123
    DECLARE @engineerHash NVARCHAR(255) = '$2b$10$s3Xbg7iG4sqV.gFJZzow6umx54CesH6A9JF1EYKK//iTsgR4yCfYe';
    
    DECLARE @newUserId INT;
    
    INSERT INTO dbo.Users (
        username, 
        email, 
        password_hash, 
        full_name, 
        role_id, 
        team_id, 
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        'Nasri',
        'nasri@hormuud.com',
        @engineerHash,
        'Abdisamad Nasri (Engineer)',
        @engineerRoleId,
        @teamId,
        1,
        GETDATE(),
        GETDATE()
    );
    
    -- Get the new user ID
    SET @newUserId = SCOPE_IDENTITY();
    
    PRINT '   SUCCESS: Engineer created';
    PRINT '   Username: Nasri';
    PRINT '   Password: dev@123';
    PRINT '   Team: ' + CAST(@teamId AS VARCHAR(10));
    
    -- Create corresponding engineer profile
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'engineers')
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.engineers WHERE email = 'nasri@hormuud.com')
        BEGIN
            -- Check if user_id column exists in engineers table
            IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.engineers') AND name = 'user_id')
            BEGIN
                INSERT INTO dbo.engineers (
                    user_id,
                    full_name,
                    email,
                    phone,
                    team_id,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (
                    @newUserId,
                    'Abdisamad Nasri (Engineer)',
                    'nasri@hormuud.com',
                    '+252-61-234-5678',
                    @teamId,
                    1,
                    GETDATE(),
                    GETDATE()
                );
                PRINT '   SUCCESS: Engineer profile created (linked by user_id)';
            END
            ELSE
            BEGIN
                -- Legacy schema without user_id
                INSERT INTO dbo.engineers (
                    full_name,
                    email,
                    phone,
                    team_id,
                    is_active,
                    created_at,
                    updated_at
                )
                VALUES (
                    'Abdisamad Nasri (Engineer)',
                    'nasri@hormuud.com',
                    '+252-61-234-5678',
                    @teamId,
                    1,
                    GETDATE(),
                    GETDATE()
                );
                PRINT '   SUCCESS: Engineer profile created (legacy schema)';
            END
        END
    END
END
ELSE
BEGIN
    PRINT '   SKIP: Nasri already exists';
END

PRINT '';

-- =====================================================
-- SUMMARY
-- =====================================================
PRINT '';
PRINT '========================================';
PRINT 'TEST USERS CREATED!';
PRINT '========================================';
PRINT '';
PRINT 'You can now login with:';
PRINT '';
PRINT '1. ADMIN:';
PRINT '   Username: developer';
PRINT '   Password: Admin@123';
PRINT '   Access: Full system';
PRINT '';
PRINT '2. TEAM LEAD:';
PRINT '   Username: Ismail';
PRINT '   Password: Ismail@123';
PRINT '   Access: Team-scoped (team_id: ' + CAST(@teamId AS VARCHAR(10)) + ')';
PRINT '';
PRINT '3. ENGINEER:';
PRINT '   Username: Nasri';
PRINT '   Password: dev@123';
PRINT '   Access: Assigned servers only';
PRINT '';
PRINT 'IMPORTANT: Change these passwords in production!';
PRINT '';

-- Show created users
SELECT 
    u.username,
    u.full_name,
    r.role_name,
    u.team_id,
    u.is_active
FROM dbo.Users u
JOIN dbo.roles r ON u.role_id = r.role_id
WHERE u.username IN ('developer', 'Ismail', 'Nasri');

GO
