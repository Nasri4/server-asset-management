-- =====================================================
-- VERIFY AUTH SETUP
-- Quick check that everything is ready for login
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'AUTH SYSTEM VERIFICATION';
PRINT '========================================';
PRINT '';

-- 1. Check role_permissions table structure
PRINT '1. role_permissions table structure:';
SELECT 
    c.name as column_name,
    t.name as data_type,
    c.max_length,
    c.is_nullable
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.role_permissions')
ORDER BY c.column_id;
PRINT '';

-- 2. Check permissions exist
PRINT '2. Total permissions in system:';
SELECT COUNT(*) as total_permissions
FROM dbo.role_permissions;
PRINT '';

-- 3. Check permissions by role
PRINT '3. Permissions by role:';
SELECT 
    r.role_name,
    COUNT(rp.role_permission_id) as permission_count
FROM dbo.roles r
LEFT JOIN dbo.role_permissions rp ON r.role_id = rp.role_id
GROUP BY r.role_name
ORDER BY r.role_name;
PRINT '';

-- 4. Check developer user
PRINT '4. Developer user status:';
SELECT 
    u.user_id,
    u.username,
    u.full_name,
    u.is_active,
    CASE WHEN u.password_hash IS NOT NULL AND LEN(u.password_hash) > 0 
         THEN 'Has password' 
         ELSE 'No password' 
    END as password_status
FROM dbo.Users u
WHERE u.username = 'developer';
PRINT '';

-- 5. Check developer's roles
PRINT '5. Developer roles:';
SELECT 
    r.role_name
FROM dbo.Users u
JOIN dbo.user_roles ur ON u.user_id = ur.user_id
JOIN dbo.roles r ON ur.role_id = r.role_id
WHERE u.username = 'developer';
PRINT '';

-- 6. Check developer's permissions (test the stored proc)
PRINT '6. Testing sp_get_user_permissions for developer:';
EXEC dbo.sp_get_user_permissions @username = 'developer';
PRINT '';

-- 7. Check stored procedures
PRINT '7. Auth stored procedures:';
SELECT 
    name,
    create_date,
    modify_date
FROM sys.procedures
WHERE name LIKE 'sp_get_user%' OR name LIKE 'sp_upsert%'
ORDER BY name;
PRINT '';

PRINT '========================================';
PRINT 'VERIFICATION COMPLETE';
PRINT '========================================';
PRINT '';
PRINT 'If you see:';
PRINT '  ✓ role_permission_id, role_id, permission_key columns';
PRINT '  ✓ 10+ total permissions';
PRINT '  ✓ Developer has "Admin" role';
PRINT '  ✓ sp_get_user_permissions returns roles and permissions';
PRINT '';
PRINT 'Then you are ready to login!';
PRINT '';
GO
