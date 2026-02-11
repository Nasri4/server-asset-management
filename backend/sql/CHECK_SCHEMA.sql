-- Check existing schema
USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT 'Checking role_permissions table structure...';
PRINT '';

-- Get columns from role_permissions
IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL
BEGIN
    SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'role_permissions'
    ORDER BY ORDINAL_POSITION;
END
ELSE
BEGIN
    PRINT 'role_permissions table does not exist';
END
GO

PRINT '';
PRINT 'Checking Users table structure...';
PRINT '';

-- Get columns from Users
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL
BEGIN
    SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Users'
    ORDER BY ORDINAL_POSITION;
END
ELSE
BEGIN
    PRINT 'Users table does not exist';
END
GO
