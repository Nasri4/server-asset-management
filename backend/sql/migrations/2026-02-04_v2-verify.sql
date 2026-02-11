-- =====================================================
-- V2 VERIFICATION SCRIPT
-- Check which V2 tables and columns were created successfully
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'V2 FEATURE VERIFICATION';
PRINT '========================================';
PRINT '';

-- Check new tables
PRINT '1. NEW TABLES:';
PRINT '   activity_log: ' + CASE WHEN OBJECT_ID('dbo.activity_log', 'U') IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END;
PRINT '   saved_views: ' + CASE WHEN OBJECT_ID('dbo.saved_views', 'U') IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END;
PRINT '   attachments: ' + CASE WHEN OBJECT_ID('dbo.attachments', 'U') IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END;
PRINT '   notifications: ' + CASE WHEN OBJECT_ID('dbo.notifications', 'U') IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END;
PRINT '   change_requests: ' + CASE WHEN OBJECT_ID('dbo.change_requests', 'U') IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING (Run fix script)' END;
PRINT '';

-- Check new columns on servers
PRINT '2. SERVERS TABLE ENHANCEMENTS:';
PRINT '   deleted_at: ' + CASE WHEN EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'deleted_at') THEN '✓ EXISTS' ELSE '✗ MISSING' END;
PRINT '   last_seen_at: ' + CASE WHEN EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'last_seen_at') THEN '✓ EXISTS' ELSE '✗ MISSING' END;
PRINT '   health_status: ' + CASE WHEN EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'health_status') THEN '✓ EXISTS' ELSE '✗ MISSING' END;
PRINT '   criticality: ' + CASE WHEN EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'criticality') THEN '✓ EXISTS' ELSE '✗ MISSING' END;
PRINT '   tags: ' + CASE WHEN EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'tags') THEN '✓ EXISTS' ELSE '✗ MISSING' END;
PRINT '';

-- Check stored procedures
PRINT '3. STORED PROCEDURES:';
PRINT '   sp_log_activity: ' + CASE WHEN OBJECT_ID('dbo.sp_log_activity', 'P') IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END;
PRINT '   sp_create_notification: ' + CASE WHEN OBJECT_ID('dbo.sp_create_notification', 'P') IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END;
PRINT '';

-- Check data
PRINT '4. SEEDED DATA:';
SELECT @count = COUNT(*) FROM dbo.saved_views WHERE user_id IS NULL;
PRINT '   System saved views: ' + CAST(@count AS VARCHAR) + ' views';
PRINT '';

PRINT '========================================';
PRINT 'VERIFICATION COMPLETE';
PRINT '';
IF OBJECT_ID('dbo.change_requests', 'U') IS NULL
BEGIN
    PRINT '⚠ ACTION REQUIRED:';
    PRINT '  Run: 2026-02-04_v2-fix-change-requests.sql';
    PRINT '';
END
ELSE
BEGIN
    PRINT '✓ All V2 features installed successfully!';
    PRINT '';
END
PRINT '========================================';

-- Show sample data
PRINT '';
PRINT '5. SAMPLE SAVED VIEWS:';
SELECT TOP 3
    view_name,
    resource_type,
    is_default,
    is_shared
FROM dbo.saved_views
WHERE user_id IS NULL
ORDER BY view_name;

DECLARE @count INT;
