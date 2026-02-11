-- Check if activity_log table exists and its structure
IF OBJECT_ID('dbo.activity_log', 'U') IS NOT NULL
BEGIN
    PRINT '✓ activity_log table exists'
    
    -- Show table structure
    SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'activity_log'
    ORDER BY ORDINAL_POSITION;
    
    -- Show sample count
    SELECT COUNT(*) as total_records FROM dbo.activity_log;
    
    -- Show sample records if any
    SELECT TOP 5 * FROM dbo.activity_log ORDER BY created_at DESC;
END
ELSE
BEGIN
    PRINT '✗ activity_log table does NOT exist'
END
