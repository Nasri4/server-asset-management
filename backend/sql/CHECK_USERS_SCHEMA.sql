-- =====================================================
-- CHECK USERS TABLE SCHEMA
-- Run this to see your Users table structure
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT 'Users table structure:';
PRINT '';

SELECT 
    c.name AS column_name,
    t.name AS data_type,
    c.max_length,
    c.is_nullable,
    c.is_identity,
    CASE WHEN pk.column_id IS NOT NULL THEN 'YES' ELSE 'NO' END AS is_primary_key
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

PRINT '';
PRINT 'Foreign keys on Users table:';

SELECT 
    fk.name AS constraint_name,
    c.name AS column_name,
    OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
    rc.name AS referenced_column
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.Users');

GO
