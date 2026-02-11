-- =====================================================
-- INCIDENT AUTOMATION SYSTEM
-- Migration: 2026-01-30
-- Purpose: Add stored procedures and indexes for automated incident management
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

-- =====================================================
-- 1. ADD INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for deduplication queries (server_id + incident_type + status)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_server_incidents_dedup' AND object_id = OBJECT_ID('dbo.server_incidents'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_server_incidents_dedup
    ON dbo.server_incidents(server_id, incident_type, status, created_at)
    INCLUDE (incident_id, severity, description, updated_at);
    PRINT '✓ Created index: IX_server_incidents_dedup';
END
ELSE
    PRINT '✓ Index IX_server_incidents_dedup already exists';
GO

-- Index for audit log queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_audit_logs_entity_lookup' AND object_id = OBJECT_ID('dbo.audit_logs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_audit_logs_entity_lookup
    ON dbo.audit_logs(entity, entity_id, created_at DESC)
    INCLUDE (action, actor, details);
    PRINT '✓ Created index: IX_audit_logs_entity_lookup';
END
ELSE
    PRINT '✓ Index IX_audit_logs_entity_lookup already exists';
GO

-- =====================================================
-- 2. STORED PROCEDURE: Auto-Create or Update Incident
-- =====================================================

IF OBJECT_ID('dbo.sp_incident_auto_upsert', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_incident_auto_upsert;
GO

CREATE PROCEDURE dbo.sp_incident_auto_upsert
    @server_id INT,
    @incident_type NVARCHAR(100),
    @severity NVARCHAR(50),
    @description NVARCHAR(500),
    @source NVARCHAR(100),
    @fingerprint NVARCHAR(255) = NULL,
    @dedup_window_minutes INT = 30,
    @actor NVARCHAR(255) = 'system'
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @incident_id INT;
    DECLARE @was_created BIT = 0;
    DECLARE @existing_description NVARCHAR(500);
    DECLARE @cutoff_time DATETIME;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Calculate deduplication cutoff time
        SET @cutoff_time = DATEADD(MINUTE, -@dedup_window_minutes, GETDATE());
        
        -- Check for existing OPEN incident for same server + incident_type
        SELECT TOP 1 
            @incident_id = incident_id,
            @existing_description = description
        FROM dbo.server_incidents WITH (UPDLOCK, ROWLOCK)
        WHERE server_id = @server_id
            AND incident_type = @incident_type
            AND status = 'Open'
            AND created_at >= @cutoff_time
        ORDER BY created_at DESC;
        
        IF @incident_id IS NOT NULL
        BEGIN
            -- UPDATE EXISTING INCIDENT (Deduplication)
            DECLARE @new_description NVARCHAR(500);
            DECLARE @timestamp_marker NVARCHAR(50);
            
            SET @timestamp_marker = '[' + CONVERT(VARCHAR(19), GETDATE(), 120) + '] ';
            
            -- Safely append new message (prevent overflow)
            IF LEN(@existing_description) + LEN(@timestamp_marker) + LEN(@description) <= 450
                SET @new_description = @existing_description + CHAR(13) + CHAR(10) + @timestamp_marker + @description;
            ELSE
                SET @new_description = @timestamp_marker + @description; -- Replace if too long
            
            UPDATE dbo.server_incidents
            SET 
                description = @new_description,
                severity = @severity, -- Update to latest severity
                updated_at = GETDATE()
            WHERE incident_id = @incident_id;
            
            SET @was_created = 0;
            
            -- Log audit for deduplication
            INSERT INTO dbo.audit_logs (actor, action, entity, entity_id, details, created_at)
            VALUES (
                @actor,
                'INCIDENT_DEDUP_UPDATE',
                'server_incidents',
                @incident_id,
                JSON_QUERY('{"source":"' + @source + '","metric":"' + @incident_type + '","fingerprint":"' + ISNULL(@fingerprint, '') + '","dedup_window_minutes":' + CAST(@dedup_window_minutes AS VARCHAR) + '}'),
                GETDATE()
            );
        END
        ELSE
        BEGIN
            -- CREATE NEW INCIDENT
            INSERT INTO dbo.server_incidents (
                server_id,
                incident_type,
                severity,
                description,
                status,
                created_at,
                updated_at
            )
            VALUES (
                @server_id,
                @incident_type,
                @severity,
                @description,
                'Open',
                GETDATE(),
                GETDATE()
            );
            
            SET @incident_id = SCOPE_IDENTITY();
            SET @was_created = 1;
            
            -- Log audit for creation
            INSERT INTO dbo.audit_logs (actor, action, entity, entity_id, details, created_at)
            VALUES (
                @actor,
                'INCIDENT_AUTO_CREATE',
                'server_incidents',
                @incident_id,
                JSON_QUERY('{"source":"' + @source + '","metric":"' + @incident_type + '","fingerprint":"' + ISNULL(@fingerprint, '') + '","severity":"' + @severity + '"}'),
                GETDATE()
            );
        END
        
        COMMIT TRANSACTION;
        
        -- Return result
        SELECT 
            @incident_id AS incident_id,
            @was_created AS was_created;
            
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
            
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT '✓ Created stored procedure: sp_incident_auto_upsert';
GO

-- =====================================================
-- 3. STORED PROCEDURE: Auto-Resolve Incident
-- =====================================================

IF OBJECT_ID('dbo.sp_incident_auto_resolve', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_incident_auto_resolve;
GO

CREATE PROCEDURE dbo.sp_incident_auto_resolve
    @server_id INT,
    @incident_type NVARCHAR(100),
    @message NVARCHAR(500),
    @actor NVARCHAR(255) = 'system'
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @incident_id INT = NULL;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Find latest OPEN incident for this server + incident_type
        SELECT TOP 1 @incident_id = incident_id
        FROM dbo.server_incidents WITH (UPDLOCK, ROWLOCK)
        WHERE server_id = @server_id
            AND incident_type = @incident_type
            AND status = 'Open'
        ORDER BY created_at DESC;
        
        IF @incident_id IS NOT NULL
        BEGIN
            -- Mark incident as resolved
            UPDATE dbo.server_incidents
            SET 
                status = 'Resolved',
                resolved_at = GETDATE(),
                updated_at = GETDATE(),
                description = description + CHAR(13) + CHAR(10) + '[AUTO-RESOLVED: ' + @message + ']'
            WHERE incident_id = @incident_id;
            
            -- Log audit
            INSERT INTO dbo.audit_logs (actor, action, entity, entity_id, details, created_at)
            VALUES (
                @actor,
                'INCIDENT_AUTO_RESOLVE',
                'server_incidents',
                @incident_id,
                JSON_QUERY('{"metric":"' + @incident_type + '","recovery_message":"' + @message + '"}'),
                GETDATE()
            );
        END
        
        COMMIT TRANSACTION;
        
        -- Return result
        SELECT @incident_id AS resolved_incident_id;
        
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
            
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT '✓ Created stored procedure: sp_incident_auto_resolve';
GO

-- =====================================================
-- 4. VERIFICATION
-- =====================================================

PRINT '';
PRINT '═══════════════════════════════════════════════════';
PRINT ' INCIDENT AUTOMATION MIGRATION COMPLETED';
PRINT '═══════════════════════════════════════════════════';
PRINT '';
PRINT 'Created Resources:';
PRINT '  ✓ Index: IX_server_incidents_dedup';
PRINT '  ✓ Index: IX_audit_logs_entity_lookup';
PRINT '  ✓ Stored Procedure: sp_incident_auto_upsert';
PRINT '  ✓ Stored Procedure: sp_incident_auto_resolve';
PRINT '';
PRINT 'Next Steps:';
PRINT '  1. Deploy backend webhook endpoints';
PRINT '  2. Configure MONITORING_WEBHOOK_SECRET';
PRINT '  3. Update monitoring systems with webhook URL';
PRINT '  4. Test with sample alerts';
PRINT '';
GO
