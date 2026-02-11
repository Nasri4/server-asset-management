-- =====================================================
-- CHECK CURRENT USERS TABLE SCHEMA
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'CHECKING USERS TABLE SCHEMA';
PRINT '========================================';
PRINT '';

-- Check if Users table exists
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    PRINT 'Users table EXISTS';
    PRINT '';
    
    -- Show all columns
    PRINT 'Current columns in dbo.Users:';
    SELECT 
        c.name AS ColumnName,
        t.name AS DataType,
        c.max_length AS MaxLength,
        c.is_nullable AS IsNullable,
        c.is_identity AS IsIdentity
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.Users')
    ORDER BY c.column_id;
    
    PRINT '';
    
    -- Check for RBAC columns specifically
    PRINT 'RBAC Column Check:';
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'user_id')
        PRINT '  ✓ user_id exists'
    ELSE
        PRINT '  ✗ user_id MISSING';
        
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'role_id')
        PRINT '  ✓ role_id exists'
    ELSE
        PRINT '  ✗ role_id MISSING';
        
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'team_id')
        PRINT '  ✓ team_id exists'
    ELSE
        PRINT '  ✗ team_id MISSING';
        
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'email')
        PRINT '  ✓ email exists'
    ELSE
        PRINT '  ✗ email MISSING';
END
ELSE
BEGIN
    PRINT 'Users table DOES NOT EXIST!';
END

PRINT '';

-- Check if RBAC tables exist
PRINT 'RBAC Tables Check:';
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'roles' AND schema_id = SCHEMA_ID('dbo'))
    PRINT '  ✓ roles table exists'
ELSE
    PRINT '  ✗ roles table MISSING';
    
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'permissions' AND schema_id = SCHEMA_ID('dbo'))
    PRINT '  ✓ permissions table exists'
ELSE
    PRINT '  ✗ permissions table MISSING';
    
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'role_permissions' AND schema_id = SCHEMA_ID('dbo'))
    PRINT '  ✓ role_permissions table exists'
ELSE
    PRINT '  ✗ role_permissions table MISSING';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'teams' AND schema_id = SCHEMA_ID('dbo'))
    PRINT '  ✓ teams table exists'
ELSE
    PRINT '  ✗ teams table MISSING';

PRINT '';
PRINT '========================================';
PRINT 'RECOMMENDATION:';
PRINT '========================================';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'role_id')
BEGIN
    PRINT 'You need to run the RBAC migration first!';
    PRINT 'The Users table is missing RBAC columns.';
    PRINT '';
    PRINT 'Run this migration:';
    PRINT '  backend/sql/migrations/2026-02-07_hormuud-rbac-CLEAN-INSTALL.sql';
END
ELSE
BEGIN
    PRINT 'RBAC columns exist. You can create test users.';
END

GO
