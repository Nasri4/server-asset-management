-- ========================================
-- CREATE ACTIVITY_LOG TABLE
-- ========================================

PRINT 'Creating activity_log table...'

-- Drop if exists (for clean re-run)
IF OBJECT_ID('dbo.activity_log', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.activity_log;
    PRINT '  Dropped existing activity_log table'
END

-- Create activity_log table
CREATE TABLE dbo.activity_log (
    activity_id INT IDENTITY(1,1) PRIMARY KEY,
    event_type NVARCHAR(100) NOT NULL,
    resource_type NVARCHAR(100) NOT NULL,
    resource_id NVARCHAR(100) NOT NULL,
    actor_id INT NULL,
    actor_name NVARCHAR(255) NOT NULL,
    actor_type NVARCHAR(50) NOT NULL DEFAULT 'system',
    description NVARCHAR(MAX) NOT NULL,
    metadata NVARCHAR(MAX) NULL,
    ip_address NVARCHAR(50) NULL,
    user_agent NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    INDEX IX_activity_log_resource (resource_type, resource_id),
    INDEX IX_activity_log_created_at (created_at DESC),
    INDEX IX_activity_log_event_type (event_type),
    INDEX IX_activity_log_actor (actor_id)
);

PRINT '✓ Created activity_log table with indexes'

-- Insert some sample activity for server 15
INSERT INTO dbo.activity_log (event_type, resource_type, resource_id, actor_name, actor_type, description, metadata)
VALUES 
    ('updated', 'server', '15', 'System Admin', 'engineer', 'Server configuration updated', '{"field": "status", "old_value": "Maintenance", "new_value": "Active"}'),
    ('created', 'server', '15', 'John Doe', 'engineer', 'Server registered in inventory', '{"hostname": "web-server-01", "environment": "Production"}'),
    ('patched', 'server', '15', 'System', 'system', 'Security patch KB4023 applied successfully', '{"patch_id": "KB4023", "duration": "15m"}'),
    ('rebooted', 'server', '15', 'Auto-Scheduler', 'system', 'Server reboot for kernel updates', '{"planned": true, "downtime": "5m"}');

PRINT '✓ Inserted sample activity records'

-- Verify
SELECT COUNT(*) as total_activities FROM dbo.activity_log WHERE resource_id = '15';
SELECT TOP 5 
    activity_id,
    event_type,
    resource_type,
    actor_name,
    description,
    created_at
FROM dbo.activity_log 
WHERE resource_id = '15'
ORDER BY created_at DESC;

PRINT '✓ Activity log table ready!'
