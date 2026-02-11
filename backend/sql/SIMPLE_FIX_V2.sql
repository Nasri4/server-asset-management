-- =====================================================
-- SIMPLE V2 FIX - Only what's needed
-- Handles existing tables, skips what exists
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'V2 SIMPLE FIX - Starting...';
PRINT '========================================';
PRINT '';

-- =====================================================
-- FIX 1: Ensure role_permissions exists with correct structure
-- =====================================================

-- Check if role_permissions has permission_key column
IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.role_permissions') AND name = 'permission_key')
    BEGIN
        PRINT 'role_permissions exists but missing permission_key column';
        PRINT 'Checking what columns it has...';
        
        -- Show current structure
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'role_permissions';
        
        PRINT '';
        PRINT '⚠ Please check the output above and let me know the column names';
    END
    ELSE
    BEGIN
        PRINT '✓ role_permissions table has correct structure';
    END
END
ELSE
BEGIN
    PRINT 'Creating role_permissions table...';
    
    CREATE TABLE dbo.role_permissions (
        role_id INT NOT NULL,
        permission_key NVARCHAR(100) NOT NULL,
        CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_key),
        CONSTRAINT FK_role_permissions_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id)
    );
    
    PRINT '✓ Created role_permissions table';
END
GO

-- =====================================================
-- FIX 2: Skip existing indexes (no errors)
-- =====================================================

-- Only create indexes if they don't exist
IF OBJECT_ID('dbo.activity_log', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_activity_log_resource' AND object_id = OBJECT_ID('dbo.activity_log'))
        CREATE INDEX IX_activity_log_resource ON dbo.activity_log(resource_type, resource_id, created_at DESC);
    
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_activity_log_created_at' AND object_id = OBJECT_ID('dbo.activity_log'))
        CREATE INDEX IX_activity_log_created_at ON dbo.activity_log(created_at DESC);
    
    PRINT '✓ Activity log indexes verified';
END
GO

IF OBJECT_ID('dbo.saved_views', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_saved_views_user_resource' AND object_id = OBJECT_ID('dbo.saved_views'))
        CREATE INDEX IX_saved_views_user_resource ON dbo.saved_views(user_id, resource_type);
    
    PRINT '✓ Saved views indexes verified';
END
GO

IF OBJECT_ID('dbo.servers', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_health_status' AND object_id = OBJECT_ID('dbo.servers'))
        CREATE INDEX IX_servers_health_status ON dbo.servers(health_status);
    
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_criticality' AND object_id = OBJECT_ID('dbo.servers'))
        CREATE INDEX IX_servers_criticality ON dbo.servers(criticality);
    
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_last_seen_at' AND object_id = OBJECT_ID('dbo.servers'))
        CREATE INDEX IX_servers_last_seen_at ON dbo.servers(last_seen_at DESC);
    
    PRINT '✓ Servers indexes verified';
END
GO

-- =====================================================
-- FIX 3: Set password for existing users
-- =====================================================

PRINT '';
PRINT '========================================';
PRINT 'USER STATUS:';
PRINT '========================================';

-- Show current users
SELECT 
    user_id,
    username,
    full_name,
    CASE WHEN password_hash IS NULL THEN 'NO PASSWORD' ELSE 'PASSWORD SET' END as password_status,
    CASE WHEN is_active = 1 THEN 'ACTIVE' ELSE 'INACTIVE' END as status
FROM dbo.Users;

PRINT '';

-- Check if admin has password
DECLARE @adminHasPassword BIT = 0;
SELECT @adminHasPassword = CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END
FROM dbo.Users
WHERE username = 'admin';

IF @adminHasPassword = 0
BEGIN
    PRINT '⚠ Admin user has NO PASSWORD SET';
    PRINT '';
    PRINT 'TO SET PASSWORD (choose one method):';
    PRINT '';
    PRINT 'METHOD 1 - Via API (Recommended):';
    PRINT '  Use bootstrap endpoint (see QUICK_START_V2.md)';
    PRINT '';
    PRINT 'METHOD 2 - Direct SQL:';
    PRINT '  1. Generate bcrypt hash: https://bcrypt-generator.com/';
    PRINT '  2. Run: UPDATE dbo.Users SET password_hash = ''$2b$12$YOUR_HASH'' WHERE username = ''admin''';
    PRINT '';
END
ELSE
BEGIN
    PRINT '✓ Admin user has password set - ready to login!';
END

PRINT '';
PRINT '========================================';
PRINT 'FIX COMPLETE!';
PRINT '========================================';
PRINT '';
PRINT 'NEXT: Install frontend package:';
PRINT '  cd frontend';
PRINT '  npm install cmdk';
PRINT '';
GO
