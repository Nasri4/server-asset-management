-- ========================================
-- CREATE ALL MISSING V2 TABLES
-- ========================================

PRINT 'Creating V2 Enterprise Tables...'
PRINT ''

-- ========================================
-- 1. SAVED_VIEWS TABLE
-- ========================================
PRINT '1. Creating saved_views table...'

IF OBJECT_ID('dbo.saved_views', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.saved_views;
    PRINT '  Dropped existing saved_views table'
END

CREATE TABLE dbo.saved_views (
    view_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NULL,
    resource_type NVARCHAR(100) NOT NULL,
    view_name NVARCHAR(255) NOT NULL,
    filters NVARCHAR(MAX) NULL,
    sort_config NVARCHAR(MAX) NULL,
    column_visibility NVARCHAR(MAX) NULL,
    is_default BIT NOT NULL DEFAULT 0,
    is_shared BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    INDEX IX_saved_views_user_resource (user_id, resource_type)
);

PRINT '  ✓ Created saved_views table'

-- ========================================
-- 2. ATTACHMENTS TABLE
-- ========================================
PRINT '2. Creating attachments table...'

IF OBJECT_ID('dbo.attachments', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.attachments;
    PRINT '  Dropped existing attachments table'
END

CREATE TABLE dbo.attachments (
    attachment_id INT IDENTITY(1,1) PRIMARY KEY,
    resource_type NVARCHAR(100) NOT NULL,
    resource_id NVARCHAR(100) NOT NULL,
    file_name NVARCHAR(500) NOT NULL,
    file_type NVARCHAR(100) NULL,
    file_size BIGINT NULL,
    storage_path NVARCHAR(1000) NOT NULL,
    uploaded_by INT NULL,
    uploaded_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    description NVARCHAR(MAX) NULL,
    
    INDEX IX_attachments_resource (resource_type, resource_id)
);

PRINT '  ✓ Created attachments table'

-- ========================================
-- 3. NOTIFICATIONS TABLE
-- ========================================
PRINT '3. Creating notifications table...'

IF OBJECT_ID('dbo.notifications', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.notifications;
    PRINT '  Dropped existing notifications table'
END

CREATE TABLE dbo.notifications (
    notification_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    title NVARCHAR(255) NOT NULL,
    message NVARCHAR(MAX) NOT NULL,
    type NVARCHAR(50) NOT NULL DEFAULT 'info',
    resource_type NVARCHAR(100) NULL,
    resource_id NVARCHAR(100) NULL,
    is_read BIT NOT NULL DEFAULT 0,
    read_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    INDEX IX_notifications_user_isread (user_id, is_read),
    INDEX IX_notifications_created_at (created_at DESC)
);

PRINT '  ✓ Created notifications table'

-- ========================================
-- VERIFICATION
-- ========================================
PRINT ''
PRINT '========================================='
PRINT 'V2 TABLES CREATED SUCCESSFULLY'
PRINT '========================================='
PRINT ''

-- Verify all tables
IF OBJECT_ID('dbo.activity_log', 'U') IS NOT NULL
    PRINT '✓ activity_log exists'
ELSE
    PRINT '✗ activity_log MISSING'

IF OBJECT_ID('dbo.saved_views', 'U') IS NOT NULL
    PRINT '✓ saved_views exists'
ELSE
    PRINT '✗ saved_views MISSING'

IF OBJECT_ID('dbo.attachments', 'U') IS NOT NULL
    PRINT '✓ attachments exists'
ELSE
    PRINT '✗ attachments MISSING'

IF OBJECT_ID('dbo.notifications', 'U') IS NOT NULL
    PRINT '✓ notifications exists'
ELSE
    PRINT '✗ notifications MISSING'

PRINT ''
PRINT 'All V2 tables are ready!'
