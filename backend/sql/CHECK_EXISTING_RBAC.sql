-- =====================================================
-- CHECK EXISTING RBAC TABLES
-- Run this first to see what exists
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'EXISTING RBAC TABLES CHECK';
PRINT '========================================';
PRINT '';

-- Check what tables exist
PRINT '1. Checking which tables exist...';
PRINT '';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'roles')
    PRINT '   [YES] roles table exists';
ELSE
    PRINT '   [NO]  roles table does NOT exist';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'permissions')
    PRINT '   [YES] permissions table exists';
ELSE
    PRINT '   [NO]  permissions table does NOT exist';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'role_permissions')
    PRINT '   [YES] role_permissions table exists';
ELSE
    PRINT '   [NO]  role_permissions table does NOT exist';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'user_roles')
    PRINT '   [YES] user_roles table exists';
ELSE
    PRINT '   [NO]  user_roles table does NOT exist';

PRINT '';

-- Check permissions table structure if exists
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'permissions')
BEGIN
    PRINT '2. Current permissions table structure:';
    PRINT '';
    
    SELECT 
        c.name AS column_name,
        t.name AS data_type,
        c.max_length,
        c.is_nullable
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.permissions')
    ORDER BY c.column_id;
    
    PRINT '';
    PRINT '3. Sample permissions data:';
    PRINT '';
    
    SELECT TOP 5 * FROM dbo.permissions;
END

PRINT '';

-- Check Users table structure
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users')
BEGIN
    PRINT '4. Users table structure:';
    PRINT '';
    
    SELECT 
        c.name AS column_name,
        t.name AS data_type,
        c.max_length,
        c.is_nullable,
        CASE WHEN pk.column_id IS NOT NULL THEN 'PK' ELSE '' END AS key_type
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    LEFT JOIN (
        SELECT ic.object_id, ic.column_id
        FROM sys.indexes i
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        WHERE i.is_primary_key = 1
    ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
    WHERE c.object_id = OBJECT_ID('dbo.Users')
    ORDER BY c.column_id;
END

PRINT '';
PRINT '========================================';
PRINT 'DONE';
PRINT '========================================';

GO
