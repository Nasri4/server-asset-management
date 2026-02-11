-- =====================================================
-- CHECK ROLE PERMISSIONS TABLE STRUCTURE
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT 'Current role_permissions table structure:';
PRINT '';

-- Show all columns
SELECT 
    c.name as column_name,
    t.name as data_type,
    c.max_length,
    c.is_nullable,
    c.is_identity
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.role_permissions')
ORDER BY c.column_id;

PRINT '';
PRINT 'Sample data:';

-- Show sample data using dynamic SQL to handle unknown columns
DECLARE @sql NVARCHAR(MAX);
SET @sql = 'SELECT TOP 5 * FROM dbo.role_permissions';
EXEC sp_executesql @sql;

GO
