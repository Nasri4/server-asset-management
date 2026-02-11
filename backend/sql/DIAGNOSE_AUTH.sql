-- =====================================================
-- DIAGNOSE AUTH ISSUES
-- Checks all auth-related tables and stored procedures
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'AUTH DIAGNOSTICS';
PRINT '========================================';
PRINT '';

-- 1. Check required tables exist
PRINT '1. REQUIRED TABLES:';
PRINT '   Users: ' + CASE WHEN OBJECT_ID('dbo.Users', 'U') IS NOT NULL THEN '✓' ELSE '✗ MISSING' END;
PRINT '   roles: ' + CASE WHEN OBJECT_ID('dbo.roles', 'U') IS NOT NULL THEN '✓' ELSE '✗ MISSING' END;
PRINT '   user_roles: ' + CASE WHEN OBJECT_ID('dbo.user_roles', 'U') IS NOT NULL THEN '✓' ELSE '✗ MISSING' END;
PRINT '   role_permissions: ' + CASE WHEN OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL THEN '✓' ELSE '✗ MISSING' END;
PRINT '';

-- 2. Check Users table structure
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL
BEGIN
    PRINT '2. USERS TABLE COLUMNS:';
    SELECT 
        '   ' + COLUMN_NAME + ' (' + DATA_TYPE + 
        CASE WHEN CHARACTER_MAXIMUM_LENGTH IS NOT NULL THEN '(' + CAST(CHARACTER_MAXIMUM_LENGTH AS VARCHAR) + ')' ELSE '' END + 
        ')' + CASE WHEN IS_NULLABLE = 'NO' THEN ' NOT NULL' ELSE ' NULL' END as ColumnInfo
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Users'
    ORDER BY ORDINAL_POSITION;
    PRINT '';
END

-- 3. Check role_permissions table structure
IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL
BEGIN
    PRINT '3. ROLE_PERMISSIONS TABLE COLUMNS:';
    SELECT 
        '   ' + COLUMN_NAME + ' (' + DATA_TYPE + 
        CASE WHEN CHARACTER_MAXIMUM_LENGTH IS NOT NULL THEN '(' + CAST(CHARACTER_MAXIMUM_LENGTH AS VARCHAR) + ')' ELSE '' END + 
        ')' as ColumnInfo
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'role_permissions'
    ORDER BY ORDINAL_POSITION;
    PRINT '';
END

-- 4. Check users
PRINT '4. EXISTING USERS:';
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL
BEGIN
    SELECT 
        user_id,
        username,
        full_name,
        team_id,
        CASE WHEN password_hash IS NULL OR LEN(password_hash) = 0 THEN 'NO PASSWORD' ELSE 'HAS PASSWORD' END as password_status,
        is_active
    FROM dbo.Users
    ORDER BY user_id;
END
PRINT '';

-- 5. Check roles
PRINT '5. EXISTING ROLES:';
IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL
BEGIN
    SELECT role_id, role_name FROM dbo.roles ORDER BY role_id;
END
PRINT '';

-- 6. Check user role assignments
PRINT '6. USER ROLE ASSIGNMENTS:';
IF OBJECT_ID('dbo.user_roles', 'U') IS NOT NULL AND OBJECT_ID('dbo.Users', 'U') IS NOT NULL
BEGIN
    SELECT 
        u.user_id,
        u.username,
        r.role_name
    FROM dbo.user_roles ur
    JOIN dbo.Users u ON u.user_id = ur.user_id
    JOIN dbo.roles r ON r.role_id = ur.role_id
    ORDER BY u.user_id;
END
PRINT '';

-- 7. Check stored procedures
PRINT '7. STORED PROCEDURES:';
PRINT '   sp_get_user_permissions: ' + CASE WHEN OBJECT_ID('dbo.sp_get_user_permissions', 'P') IS NOT NULL THEN '✓' ELSE '✗ MISSING - THIS WILL CAUSE 500 ERROR!' END;
PRINT '';

-- 8. Test developer login query
PRINT '8. TEST DEVELOPER USER QUERY:';
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL
BEGIN
    SELECT TOP (1)
        u.user_id,
        u.username,
        u.password_hash,
        u.full_name,
        u.team_id,
        u.is_active,
        r.role_name
    FROM dbo.Users u
    LEFT JOIN dbo.user_roles ur ON ur.user_id = u.user_id
    LEFT JOIN dbo.roles r ON r.role_id = ur.role_id
    WHERE LOWER(u.username) = 'developer';
    
    IF @@ROWCOUNT = 0
        PRINT '   ✗ Developer user not found!';
    ELSE
        PRINT '   ✓ Developer user query works';
END
PRINT '';

PRINT '========================================';
PRINT 'DIAGNOSIS COMPLETE';
PRINT '========================================';
PRINT '';
PRINT 'COMMON ISSUES:';
PRINT '  - Missing sp_get_user_permissions stored procedure';
PRINT '  - User has no role assigned in user_roles table';
PRINT '  - role_permissions table has wrong column names';
PRINT '';
GO
