-- =====================================================
-- FIX PERMISSION COLUMN
-- Adds permission_key if missing
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'CHECKING role_permissions TABLE';
PRINT '========================================';
PRINT '';

-- Show current columns
PRINT 'Current columns in role_permissions:';
SELECT 
    '  ' + COLUMN_NAME + ' (' + DATA_TYPE + ')' as ColumnInfo
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'role_permissions'
ORDER BY ORDINAL_POSITION;
PRINT '';

-- Add permission_key column if it doesn't exist
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.role_permissions') 
      AND name = 'permission_key'
)
BEGIN
    PRINT 'Adding permission_key column...';
    
    ALTER TABLE dbo.role_permissions
    ADD permission_key NVARCHAR(100) NULL;
    
    PRINT '✓ Added permission_key column';
    
    -- Populate with default permissions based on role
    UPDATE dbo.role_permissions
    SET permission_key = 'view:all'
    WHERE permission_key IS NULL;
    
    PRINT '✓ Set default permissions';
END
ELSE
BEGIN
    PRINT '✓ permission_key column already exists';
END
PRINT '';

-- Add unique constraint if not exists
IF NOT EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE object_id = OBJECT_ID('dbo.role_permissions') 
      AND name = 'UQ_role_permissions_role_permission'
)
BEGIN
    PRINT 'Adding unique constraint...';
    
    -- First, remove any duplicates
    WITH CTE AS (
        SELECT *,
            ROW_NUMBER() OVER (
                PARTITION BY role_id, permission_key 
                ORDER BY (SELECT NULL)
            ) AS rn
        FROM dbo.role_permissions
    )
    DELETE FROM CTE WHERE rn > 1;
    
    -- Add constraint
    ALTER TABLE dbo.role_permissions
    ADD CONSTRAINT UQ_role_permissions_role_permission 
    UNIQUE (role_id, permission_key);
    
    PRINT '✓ Added unique constraint';
END
ELSE
BEGIN
    PRINT '✓ Unique constraint already exists';
END
PRINT '';

-- Show sample data
PRINT 'Sample role_permissions data:';
SELECT TOP 5
    rp.role_permission_id,
    r.role_name,
    rp.permission_key
FROM dbo.role_permissions rp
JOIN dbo.roles r ON r.role_id = rp.role_id;

IF @@ROWCOUNT = 0
BEGIN
    PRINT 'No permissions found - seeding defaults...';
    
    -- Seed default permissions for each role
    INSERT INTO dbo.role_permissions (role_id, permission_key)
    SELECT r.role_id, p.permission_key
    FROM dbo.roles r
    CROSS JOIN (
        VALUES 
            ('view:all'),
            ('view:servers'),
            ('view:incidents'),
            ('view:maintenance'),
            ('edit:servers'),
            ('edit:incidents'),
            ('delete:servers'),
            ('admin:all')
    ) AS p(permission_key)
    WHERE NOT EXISTS (
        SELECT 1 
        FROM dbo.role_permissions rp2 
        WHERE rp2.role_id = r.role_id 
          AND rp2.permission_key = p.permission_key
    )
    -- Admins get all permissions, others get view permissions only
    AND (
        (r.role_name = 'Admin') OR 
        (p.permission_key LIKE 'view:%')
    );
    
    PRINT '✓ Seeded default permissions';
    
    -- Show what was created
    SELECT 
        r.role_name,
        COUNT(*) as permission_count
    FROM dbo.role_permissions rp
    JOIN dbo.roles r ON r.role_id = rp.role_id
    GROUP BY r.role_name
    ORDER BY r.role_name;
END
PRINT '';

PRINT '========================================';
PRINT 'FIX COMPLETE';
PRINT '========================================';
PRINT '';
PRINT 'Next: Restart backend and try logging in!';
PRINT '';
GO
