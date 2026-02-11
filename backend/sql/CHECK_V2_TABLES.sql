-- Check all V2 enterprise tables
PRINT 'Checking V2 Enterprise Tables...'
PRINT ''

-- Check activity_log
IF OBJECT_ID('dbo.activity_log', 'U') IS NOT NULL
    PRINT '✓ activity_log exists'
ELSE
    PRINT '✗ activity_log MISSING'

-- Check saved_views
IF OBJECT_ID('dbo.saved_views', 'U') IS NOT NULL
    PRINT '✓ saved_views exists'
ELSE
    PRINT '✗ saved_views MISSING'

-- Check attachments
IF OBJECT_ID('dbo.attachments', 'U') IS NOT NULL
    PRINT '✓ attachments exists'
ELSE
    PRINT '✗ attachments MISSING'

-- Check notifications
IF OBJECT_ID('dbo.notifications', 'U') IS NOT NULL
    PRINT '✓ notifications exists'
ELSE
    PRINT '✗ notifications MISSING'

PRINT ''
PRINT 'Done!'
