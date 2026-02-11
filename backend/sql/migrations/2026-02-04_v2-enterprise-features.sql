-- =====================================================
-- V2 ENTERPRISE FEATURES MIGRATION
-- Date: 2026-02-04
-- Description: Adds Activity Log, Saved Views, Attachments, Notifications, Change Requests
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

-- =====================================================
-- 1. ACTIVITY LOG (Event Stream)
-- =====================================================
IF OBJECT_ID('dbo.activity_log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.activity_log (
        activity_id BIGINT IDENTITY(1,1) NOT NULL,
        event_type NVARCHAR(100) NOT NULL, -- ServerCreated, StatusChanged, IncidentResolved, etc.
        resource_type NVARCHAR(50) NOT NULL, -- Server, Incident, Maintenance, etc.
        resource_id NVARCHAR(100) NOT NULL, -- ID of the resource
        
        actor_id INT NULL, -- User/Engineer who performed the action
        actor_name NVARCHAR(200) NULL, -- Cached name for performance
        actor_type NVARCHAR(50) NULL, -- 'user', 'engineer', 'system'
        
        description NVARCHAR(1000) NOT NULL, -- Human-readable: "John Doe changed status from Maintenance to Active"
        metadata NVARCHAR(MAX) NULL, -- JSON: { "oldValue": "Maintenance", "newValue": "Active" }
        
        ip_address NVARCHAR(50) NULL,
        user_agent NVARCHAR(500) NULL,
        
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT PK_activity_log PRIMARY KEY (activity_id)
    );
    
    CREATE INDEX IX_activity_log_resource ON dbo.activity_log(resource_type, resource_id, created_at DESC);
    CREATE INDEX IX_activity_log_actor ON dbo.activity_log(actor_id, created_at DESC);
    CREATE INDEX IX_activity_log_event_type ON dbo.activity_log(event_type, created_at DESC);
    CREATE INDEX IX_activity_log_created_at ON dbo.activity_log(created_at DESC);
    
    PRINT 'Created activity_log table';
END
GO

-- =====================================================
-- 2. SAVED VIEWS (User-defined table filters)
-- =====================================================
IF OBJECT_ID('dbo.saved_views', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.saved_views (
        view_id INT IDENTITY(1,1) NOT NULL,
        user_id INT NULL, -- NULL for system/global views
        view_name NVARCHAR(200) NOT NULL,
        resource_type NVARCHAR(50) NOT NULL, -- 'servers', 'incidents', 'maintenance', etc.
        
        filter_config NVARCHAR(MAX) NOT NULL, -- JSON: { "status": ["Active"], "environment": ["Production"] }
        sort_config NVARCHAR(MAX) NULL, -- JSON: { "field": "server_code", "order": "asc" }
        column_config NVARCHAR(MAX) NULL, -- JSON: ["server_code", "hostname", "status", "engineer"]
        
        is_default BIT NOT NULL DEFAULT 0,
        is_shared BIT NOT NULL DEFAULT 0, -- Share with team
        
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT PK_saved_views PRIMARY KEY (view_id)
    );
    
    CREATE INDEX IX_saved_views_user_resource ON dbo.saved_views(user_id, resource_type);
    CREATE INDEX IX_saved_views_resource_type ON dbo.saved_views(resource_type);
    
    PRINT 'Created saved_views table';
END
GO

-- =====================================================
-- 3. ATTACHMENTS (Files for servers, incidents, maintenance)
-- =====================================================
IF OBJECT_ID('dbo.attachments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.attachments (
        attachment_id INT IDENTITY(1,1) NOT NULL,
        resource_type NVARCHAR(50) NOT NULL, -- 'server', 'incident', 'maintenance'
        resource_id INT NOT NULL,
        
        file_name NVARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL, -- Bytes
        file_type NVARCHAR(100) NULL, -- MIME type
        storage_path NVARCHAR(1000) NOT NULL, -- File path or S3 key
        
        uploaded_by INT NULL, -- Engineer ID
        uploaded_by_name NVARCHAR(200) NULL, -- Cached name
        uploaded_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        description NVARCHAR(1000) NULL,
        
        deleted_at DATETIME NULL, -- Soft delete
        
        CONSTRAINT PK_attachments PRIMARY KEY (attachment_id)
    );
    
    CREATE INDEX IX_attachments_resource ON dbo.attachments(resource_type, resource_id, deleted_at);
    CREATE INDEX IX_attachments_uploaded_by ON dbo.attachments(uploaded_by);
    
    PRINT 'Created attachments table';
END
GO

-- =====================================================
-- 4. NOTIFICATIONS (User notifications)
-- =====================================================
IF OBJECT_ID('dbo.notifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.notifications (
        notification_id INT IDENTITY(1,1) NOT NULL,
        user_id INT NULL, -- Engineer ID or user ID
        
        title NVARCHAR(500) NOT NULL,
        message NVARCHAR(MAX) NULL,
        notification_type NVARCHAR(100) NULL, -- 'IncidentAssigned', 'MaintenanceDue', 'ServerDown', etc.
        
        resource_type NVARCHAR(50) NULL,
        resource_id INT NULL,
        resource_url NVARCHAR(1000) NULL, -- Deep link
        
        is_read BIT NOT NULL DEFAULT 0,
        read_at DATETIME NULL,
        
        priority NVARCHAR(50) NOT NULL DEFAULT 'Normal', -- 'High', 'Normal', 'Low'
        
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        expires_at DATETIME NULL, -- Auto-archive old notifications
        
        CONSTRAINT PK_notifications PRIMARY KEY (notification_id)
    );
    
    CREATE INDEX IX_notifications_user_isread ON dbo.notifications(user_id, is_read, created_at DESC);
    CREATE INDEX IX_notifications_created_at ON dbo.notifications(created_at DESC);
    
    PRINT 'Created notifications table';
END
GO

-- =====================================================
-- 5. CHANGE REQUESTS (Change Management workflow)
-- =====================================================
IF OBJECT_ID('dbo.change_requests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.change_requests (
        change_id INT IDENTITY(1,1) NOT NULL,
        change_number NVARCHAR(50) NOT NULL UNIQUE, -- CHG-2026-0001
        server_id INT NULL,
        
        title NVARCHAR(500) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        justification NVARCHAR(MAX) NULL,
        risk_assessment NVARCHAR(MAX) NULL,
        rollback_plan NVARCHAR(MAX) NULL,
        
        -- Classification
        change_type NVARCHAR(100) NOT NULL, -- 'Standard', 'Normal', 'Emergency'
        impact NVARCHAR(50) NOT NULL, -- 'Critical', 'High', 'Medium', 'Low'
        urgency NVARCHAR(50) NOT NULL,
        
        -- Status & Approval
        status NVARCHAR(50) NOT NULL DEFAULT 'Draft', -- 'Draft', 'Submitted', 'UnderReview', 'Approved', 'Rejected', 'Scheduled', 'InProgress', 'Completed', 'Cancelled'
        approval_status NVARCHAR(50) NULL, -- 'Pending', 'Approved', 'Rejected'
        approved_by INT NULL,
        approved_at DATETIME NULL,
        rejection_reason NVARCHAR(MAX) NULL,
        
        -- Schedule
        requested_start DATETIME NULL,
        requested_end DATETIME NULL,
        actual_start DATETIME NULL,
        actual_end DATETIME NULL,
        
        -- People
        requested_by INT NOT NULL, -- Engineer ID
        implementer INT NULL,
        
        -- Results
        outcome NVARCHAR(50) NULL, -- 'Success', 'Failed', 'RolledBack'
        notes NVARCHAR(MAX) NULL,
        
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        deleted_at DATETIME NULL,
        
        CONSTRAINT PK_change_requests PRIMARY KEY (change_id)
    );
    
    ALTER TABLE dbo.change_requests WITH CHECK
        ADD CONSTRAINT FK_change_requests_server FOREIGN KEY (server_id)
        REFERENCES dbo.servers(server_id) ON DELETE SET NULL;
    
    ALTER TABLE dbo.change_requests WITH CHECK
        ADD CONSTRAINT FK_change_requests_requested_by FOREIGN KEY (requested_by)
        REFERENCES dbo.engineers(engineer_id);
    
    ALTER TABLE dbo.change_requests WITH CHECK
        ADD CONSTRAINT FK_change_requests_approved_by FOREIGN KEY (approved_by)
        REFERENCES dbo.engineers(engineer_id) ON DELETE NO ACTION;
    
    ALTER TABLE dbo.change_requests WITH CHECK
        ADD CONSTRAINT FK_change_requests_implementer FOREIGN KEY (implementer)
        REFERENCES dbo.engineers(engineer_id) ON DELETE NO ACTION;
    
    CREATE INDEX IX_change_requests_server ON dbo.change_requests(server_id);
    CREATE INDEX IX_change_requests_status ON dbo.change_requests(status, created_at DESC);
    CREATE INDEX IX_change_requests_requested_by ON dbo.change_requests(requested_by);
    
    PRINT 'Created change_requests table';
END
GO

-- =====================================================
-- 6. ENHANCE EXISTING TABLES FOR V2
-- =====================================================

-- Add soft delete to servers if not exists
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'deleted_at')
BEGIN
    ALTER TABLE dbo.servers ADD deleted_at DATETIME NULL;
    PRINT 'Added deleted_at to servers table';
END
ELSE
BEGIN
    PRINT 'deleted_at already exists on servers table';
END
GO

-- Create index on deleted_at if it doesn't exist (separate batch after column is created)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_deleted_at' AND object_id = OBJECT_ID('dbo.servers'))
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'deleted_at')
    BEGIN
        CREATE INDEX IX_servers_deleted_at ON dbo.servers(deleted_at) WHERE deleted_at IS NOT NULL;
        PRINT 'Created index IX_servers_deleted_at';
    END
END
GO

-- Add last_seen_at to servers if not exists (for real-time monitoring)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'last_seen_at')
BEGIN
    ALTER TABLE dbo.servers ADD last_seen_at DATETIME NULL;
    CREATE INDEX IX_servers_last_seen_at ON dbo.servers(last_seen_at DESC);
    PRINT 'Added last_seen_at to servers table';
END
GO

-- Add health_status to servers if not exists (separate from status)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'health_status')
BEGIN
    ALTER TABLE dbo.servers ADD health_status NVARCHAR(50) NULL;
    CREATE INDEX IX_servers_health_status ON dbo.servers(health_status);
    PRINT 'Added health_status to servers table';
END
GO

-- Add criticality to servers if not exists
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'criticality')
BEGIN
    ALTER TABLE dbo.servers ADD criticality NVARCHAR(50) NULL DEFAULT 'Medium';
    CREATE INDEX IX_servers_criticality ON dbo.servers(criticality);
    PRINT 'Added criticality to servers table';
END
GO

-- Add tags to servers for quick filtering
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'tags')
BEGIN
    ALTER TABLE dbo.servers ADD tags NVARCHAR(500) NULL;
    PRINT 'Added tags to servers table';
END
GO

-- =====================================================
-- 7. SEED DATA FOR SAVED VIEWS
-- =====================================================

-- Only insert if table is empty
IF NOT EXISTS (SELECT 1 FROM dbo.saved_views)
BEGIN
    -- System views for Servers
    INSERT INTO dbo.saved_views (user_id, view_name, resource_type, filter_config, sort_config, column_config, is_default, is_shared)
    VALUES
        (NULL, 'All Servers', 'servers', '{}', '{"field":"server_code","order":"asc"}', '["server_code","hostname","status","environment","engineer","location"]', 1, 1),
        (NULL, 'Production Servers', 'servers', '{"environment":["Production"]}', '{"field":"server_code","order":"asc"}', '["server_code","hostname","status","health_status","criticality","engineer"]', 0, 1),
        (NULL, 'Critical Systems', 'servers', '{"criticality":["Critical","High"]}', '{"field":"criticality","order":"asc"}', '["server_code","hostname","status","health_status","criticality","engineer"]', 0, 1),
        (NULL, 'Offline Servers', 'servers', '{"status":["Offline"]}', '{"field":"updated_at","order":"desc"}', '["server_code","hostname","status","health_status","engineer","updated_at"]', 0, 1),
        (NULL, 'Maintenance Mode', 'servers', '{"status":["Maintenance"]}', '{"field":"updated_at","order":"desc"}', '["server_code","hostname","status","engineer","updated_at"]', 0, 1);
    
    -- System views for Incidents
    INSERT INTO dbo.saved_views (user_id, view_name, resource_type, filter_config, sort_config, column_config, is_default, is_shared)
    VALUES
        (NULL, 'All Incidents', 'incidents', '{}', '{"field":"reported_at","order":"desc"}', '["incident_id","server_code","severity","status","engineer","reported_at"]', 1, 1),
        (NULL, 'Open Incidents', 'incidents', '{"status":["Open","InProgress"]}', '{"field":"severity","order":"asc"}', '["incident_id","server_code","severity","status","engineer","reported_at"]', 0, 1),
        (NULL, 'Critical Incidents', 'incidents', '{"severity":["Critical"]}', '{"field":"reported_at","order":"desc"}', '["incident_id","server_code","severity","status","engineer","reported_at"]', 0, 1);
    
    -- System views for Maintenance
    INSERT INTO dbo.saved_views (user_id, view_name, resource_type, filter_config, sort_config, column_config, is_default, is_shared)
    VALUES
        (NULL, 'All Maintenance', 'maintenance', '{}', '{"field":"scheduled_start","order":"desc"}', '["maintenance_id","server_code","maintenance_type","status","scheduled_start"]', 1, 1),
        (NULL, 'Scheduled', 'maintenance', '{"status":["Scheduled"]}', '{"field":"scheduled_start","order":"asc"}', '["maintenance_id","server_code","maintenance_type","scheduled_start","scheduled_end"]', 0, 1),
        (NULL, 'In Progress', 'maintenance', '{"status":["InProgress"]}', '{"field":"started_at","order":"desc"}', '["maintenance_id","server_code","maintenance_type","started_at"]', 0, 1);
    
    PRINT 'Seeded system saved views';
END
GO

-- =====================================================
-- 8. CREATE HELPER STORED PROCEDURES
-- =====================================================

-- Procedure to log activity
IF OBJECT_ID('dbo.sp_log_activity', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_log_activity;
GO

CREATE PROCEDURE dbo.sp_log_activity
    @event_type NVARCHAR(100),
    @resource_type NVARCHAR(50),
    @resource_id NVARCHAR(100),
    @actor_id INT = NULL,
    @actor_name NVARCHAR(200) = NULL,
    @actor_type NVARCHAR(50) = NULL,
    @description NVARCHAR(1000),
    @metadata NVARCHAR(MAX) = NULL,
    @ip_address NVARCHAR(50) = NULL,
    @user_agent NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO dbo.activity_log (
        event_type, resource_type, resource_id,
        actor_id, actor_name, actor_type,
        description, metadata,
        ip_address, user_agent
    )
    VALUES (
        @event_type, @resource_type, @resource_id,
        @actor_id, @actor_name, @actor_type,
        @description, @metadata,
        @ip_address, @user_agent
    );
END
GO

-- Procedure to create notification
IF OBJECT_ID('dbo.sp_create_notification', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_create_notification;
GO

CREATE PROCEDURE dbo.sp_create_notification
    @user_id INT,
    @title NVARCHAR(500),
    @message NVARCHAR(MAX) = NULL,
    @notification_type NVARCHAR(100) = NULL,
    @resource_type NVARCHAR(50) = NULL,
    @resource_id INT = NULL,
    @resource_url NVARCHAR(1000) = NULL,
    @priority NVARCHAR(50) = 'Normal'
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO dbo.notifications (
        user_id, title, message, notification_type,
        resource_type, resource_id, resource_url, priority
    )
    VALUES (
        @user_id, @title, @message, @notification_type,
        @resource_type, @resource_id, @resource_url, @priority
    );
END
GO

PRINT '✓ V2 Enterprise Features Migration Completed Successfully';
GO
