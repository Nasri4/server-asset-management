-- =====================================================
-- V2 COMPLETE SCHEMA VERIFICATION & MIGRATION (FIXED)
-- Date: 2026-02-06
-- Purpose: Ensure all tables, columns, FKs, indexes exist for V2
-- Idempotent: Safe to run multiple times
-- FIXED: Handles existing data in server_security table
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'V2 Schema Verification & Migration';
PRINT '========================================';
PRINT '';

-- =====================================================
-- 1. VERIFY & UPDATE servers TABLE
-- =====================================================
PRINT '1. Verifying servers table...';

-- Add health_status column if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'health_status')
BEGIN
    PRINT '  - Adding health_status column...';
    ALTER TABLE dbo.servers ADD health_status NVARCHAR(20) NULL;
END

-- Add status_override column if missing (for manual status forcing)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'status_override')
BEGIN
    PRINT '  - Adding status_override column...';
    ALTER TABLE dbo.servers ADD status_override NVARCHAR(20) NULL;
END

-- Add status_override_by column if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'status_override_by')
BEGIN
    PRINT '  - Adding status_override_by column...';
    ALTER TABLE dbo.servers ADD status_override_by INT NULL;
END

-- Add status_override_at column if missing
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.servers') AND name = 'status_override_at')
BEGIN
    PRINT '  - Adding status_override_at column...';
    ALTER TABLE dbo.servers ADD status_override_at DATETIME NULL;
END

-- Update status constraint to include new statuses
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_servers_status' AND parent_object_id = OBJECT_ID('dbo.servers'))
BEGIN
    PRINT '  - Updating status constraint...';
    ALTER TABLE dbo.servers DROP CONSTRAINT CK_servers_status;
END

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_servers_status' AND parent_object_id = OBJECT_ID('dbo.servers'))
BEGIN
    ALTER TABLE dbo.servers ADD CONSTRAINT CK_servers_status 
        CHECK (status IN ('Active','Maintenance','Degraded','Offline','Incident','Under Visit','Down','Issue','Warning'));
END

-- Update health_status constraint
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_servers_health_status' AND parent_object_id = OBJECT_ID('dbo.servers'))
BEGIN
    PRINT '  - Adding health_status constraint...';
    ALTER TABLE dbo.servers ADD CONSTRAINT CK_servers_health_status 
        CHECK (health_status IS NULL OR health_status IN ('Healthy','Warning','Critical','Down','Unknown'));
END

PRINT '  - servers table verified.';
PRINT '';

-- =====================================================
-- 2. VERIFY & UPDATE server_security TABLE
-- =====================================================
PRINT '2. Verifying server_security table...';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_security')
BEGIN
    PRINT '  - Creating server_security table...';
    CREATE TABLE dbo.server_security (
        security_id INT IDENTITY(1,1) NOT NULL,
        server_id INT NOT NULL,
        
        -- OS & Patching
        os_name NVARCHAR(100) NULL,
        os_version NVARCHAR(100) NULL,
        patch_level NVARCHAR(100) NULL,
        last_patched_at DATETIME NULL,
        
        -- Hardening Status
        hardening_status NVARCHAR(50) NOT NULL DEFAULT 'Not Assessed',
        ssh_key_only BIT NULL DEFAULT 0,
        firewall_enabled BIT NULL DEFAULT 0,
        antivirus_installed BIT NULL DEFAULT 0,
        
        -- Backup & Compliance
        backup_enabled BIT NULL DEFAULT 0,
        backup_frequency NVARCHAR(50) NULL,
        backup_last_success DATETIME NULL,
        log_retention_days INT NULL,
        
        -- Compliance
        compliance_framework NVARCHAR(100) NULL,
        compliance_status NVARCHAR(50) NULL,
        last_audit_at DATETIME NULL,
        next_audit_due DATETIME NULL,
        
        -- Metadata
        notes NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT PK_server_security PRIMARY KEY (security_id),
        CONSTRAINT FK_server_security_server FOREIGN KEY (server_id) 
            REFERENCES dbo.servers(server_id) ON DELETE CASCADE,
        CONSTRAINT CK_server_security_hardening_status 
            CHECK (hardening_status IN ('Not Assessed','In Progress','Hardened','Non-Compliant','Pending Review'))
    );
    
    CREATE UNIQUE INDEX UQ_server_security_server_id ON dbo.server_security(server_id);
    CREATE INDEX IX_server_security_hardening_status ON dbo.server_security(hardening_status);
    
    PRINT '  - server_security table created.';
END
ELSE
BEGIN
    PRINT '  - server_security table exists.';
    
    -- Verify/add columns that might be missing
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_security') AND name = 'hardening_status')
    BEGIN
        ALTER TABLE dbo.server_security ADD hardening_status NVARCHAR(50) NOT NULL DEFAULT 'Not Assessed';
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_security') AND name = 'compliance_framework')
    BEGIN
        ALTER TABLE dbo.server_security ADD compliance_framework NVARCHAR(100) NULL;
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_security') AND name = 'compliance_status')
    BEGIN
        ALTER TABLE dbo.server_security ADD compliance_status NVARCHAR(50) NULL;
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_security') AND name = 'last_audit_at')
    BEGIN
        ALTER TABLE dbo.server_security ADD last_audit_at DATETIME NULL;
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_security') AND name = 'next_audit_due')
    BEGIN
        ALTER TABLE dbo.server_security ADD next_audit_due DATETIME NULL;
    END
    
    -- FIXED: Update existing values before applying constraint
    PRINT '  - Checking existing hardening_status values...';
    
    -- Update any non-standard values
    UPDATE dbo.server_security
    SET hardening_status = CASE
        WHEN hardening_status IS NULL THEN 'Not Assessed'
        WHEN LOWER(LTRIM(RTRIM(hardening_status))) IN ('not assessed', 'notassessed', 'not started', 'notstarted', 'pending') THEN 'Not Assessed'
        WHEN LOWER(LTRIM(RTRIM(hardening_status))) IN ('in progress', 'inprogress', 'in_progress', 'progress', 'ongoing') THEN 'In Progress'
        WHEN LOWER(LTRIM(RTRIM(hardening_status))) IN ('hardened', 'completed', 'complete', 'secured', 'compliant') THEN 'Hardened'
        WHEN LOWER(LTRIM(RTRIM(hardening_status))) IN ('non-compliant', 'noncompliant', 'non_compliant', 'failed', 'incomplete') THEN 'Non-Compliant'
        WHEN LOWER(LTRIM(RTRIM(hardening_status))) IN ('pending review', 'pendingreview', 'pending_review', 'review', 'under review') THEN 'Pending Review'
        WHEN hardening_status IN ('Not Assessed', 'In Progress', 'Hardened', 'Non-Compliant', 'Pending Review') THEN hardening_status
        ELSE 'Not Assessed'
    END
    WHERE hardening_status IS NULL 
       OR hardening_status NOT IN ('Not Assessed', 'In Progress', 'Hardened', 'Non-Compliant', 'Pending Review');
    
    DECLARE @updatedSecurity INT = @@ROWCOUNT;
    IF @updatedSecurity > 0
    BEGIN
        PRINT '    - Normalized ' + CAST(@updatedSecurity AS VARCHAR(10)) + ' hardening_status values';
    END
END

-- Update hardening_status constraint (only if not exists or needs update)
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_server_security_hardening_status' AND parent_object_id = OBJECT_ID('dbo.server_security'))
BEGIN
    -- Check if constraint definition is correct
    DECLARE @constraintDef NVARCHAR(MAX);
    SELECT @constraintDef = definition 
    FROM sys.check_constraints 
    WHERE name = 'CK_server_security_hardening_status' AND parent_object_id = OBJECT_ID('dbo.server_security');
    
    -- If constraint doesn't include all new values, drop and recreate
    IF @constraintDef NOT LIKE '%Pending Review%'
    BEGIN
        PRINT '  - Updating hardening_status constraint...';
        ALTER TABLE dbo.server_security DROP CONSTRAINT CK_server_security_hardening_status;
        ALTER TABLE dbo.server_security ADD CONSTRAINT CK_server_security_hardening_status 
            CHECK (hardening_status IN ('Not Assessed','In Progress','Hardened','Non-Compliant','Pending Review'));
    END
END
ELSE
BEGIN
    PRINT '  - Adding hardening_status constraint...';
    ALTER TABLE dbo.server_security ADD CONSTRAINT CK_server_security_hardening_status 
        CHECK (hardening_status IN ('Not Assessed','In Progress','Hardened','Non-Compliant','Pending Review'));
END

PRINT '  - server_security table verified.';
PRINT '';

-- =====================================================
-- 3. VERIFY & UPDATE server_incidents TABLE
-- =====================================================
PRINT '3. Verifying server_incidents table...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_incidents')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_incidents') AND name = 'engineer_id')
    BEGIN
        PRINT '  - Adding engineer_id column...';
        ALTER TABLE dbo.server_incidents ADD engineer_id INT NULL;
        
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_server_incidents_engineer')
        BEGIN
            ALTER TABLE dbo.server_incidents ADD CONSTRAINT FK_server_incidents_engineer 
                FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;
        END
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_incidents') AND name = 'root_cause')
    BEGIN
        PRINT '  - Adding root_cause column...';
        ALTER TABLE dbo.server_incidents ADD root_cause NVARCHAR(MAX) NULL;
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_incidents') AND name = 'resolution')
    BEGIN
        PRINT '  - Adding resolution column...';
        ALTER TABLE dbo.server_incidents ADD resolution NVARCHAR(MAX) NULL;
    END
    
    PRINT '  - server_incidents table verified.';
END
PRINT '';

-- =====================================================
-- 4. VERIFY & UPDATE server_maintenance TABLE
-- =====================================================
PRINT '4. Verifying server_maintenance table...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_maintenance')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_maintenance') AND name = 'engineer_id')
    BEGIN
        PRINT '  - Adding engineer_id column...';
        ALTER TABLE dbo.server_maintenance ADD engineer_id INT NULL;
        
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_server_maintenance_engineer')
        BEGIN
            ALTER TABLE dbo.server_maintenance ADD CONSTRAINT FK_server_maintenance_engineer 
                FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;
        END
        
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_server_maintenance_engineer_id' AND object_id = OBJECT_ID('dbo.server_maintenance'))
        BEGIN
            CREATE INDEX IX_server_maintenance_engineer_id ON dbo.server_maintenance(engineer_id);
        END
    END
    
    PRINT '  - server_maintenance table verified.';
END
PRINT '';

-- =====================================================
-- 5. VERIFY & UPDATE server_visits TABLE
-- =====================================================
PRINT '5. Verifying server_visits table...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_visits')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_visits') AND name = 'engineer_id')
    BEGIN
        PRINT '  - Adding engineer_id column...';
        ALTER TABLE dbo.server_visits ADD engineer_id INT NULL;
        
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_server_visits_engineer')
        BEGIN
            ALTER TABLE dbo.server_visits ADD CONSTRAINT FK_server_visits_engineer 
                FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;
        END
        
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_server_visits_engineer_id' AND object_id = OBJECT_ID('dbo.server_visits'))
        BEGIN
            CREATE INDEX IX_server_visits_engineer_id ON dbo.server_visits(engineer_id);
        END
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_visits') AND name = 'visit_type')
    BEGIN
        PRINT '  - Adding visit_type column...';
        ALTER TABLE dbo.server_visits ADD visit_type NVARCHAR(100) NULL;
    END
    
    PRINT '  - server_visits table verified.';
END
PRINT '';

-- =====================================================
-- 6. VERIFY & UPDATE server_monitoring TABLE
-- =====================================================
PRINT '6. Verifying server_monitoring table...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_monitoring')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_monitoring') AND name = 'health_status')
    BEGIN
        PRINT '  - Adding health_status column...';
        ALTER TABLE dbo.server_monitoring ADD health_status NVARCHAR(20) NULL;
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_monitoring') AND name = 'last_check_at')
    BEGIN
        PRINT '  - Adding last_check_at column...';
        ALTER TABLE dbo.server_monitoring ADD last_check_at DATETIME NULL;
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_monitoring') AND name = 'cpu_usage')
    BEGIN
        PRINT '  - Adding cpu_usage column...';
        ALTER TABLE dbo.server_monitoring ADD cpu_usage DECIMAL(5,2) NULL;
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_monitoring') AND name = 'memory_usage')
    BEGIN
        PRINT '  - Adding memory_usage column...';
        ALTER TABLE dbo.server_monitoring ADD memory_usage DECIMAL(5,2) NULL;
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_monitoring') AND name = 'disk_usage')
    BEGIN
        PRINT '  - Adding disk_usage column...';
        ALTER TABLE dbo.server_monitoring ADD disk_usage DECIMAL(5,2) NULL;
    END
    
    PRINT '  - server_monitoring table verified.';
END
PRINT '';

-- =====================================================
-- 7. VERIFY INDEXES FOR PERFORMANCE
-- =====================================================
PRINT '7. Verifying performance indexes...';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_team_id' AND object_id = OBJECT_ID('dbo.servers'))
BEGIN
    CREATE INDEX IX_servers_team_id ON dbo.servers(team_id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_engineer_id' AND object_id = OBJECT_ID('dbo.servers'))
BEGIN
    CREATE INDEX IX_servers_engineer_id ON dbo.servers(engineer_id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_location_id' AND object_id = OBJECT_ID('dbo.servers'))
BEGIN
    CREATE INDEX IX_servers_location_id ON dbo.servers(location_id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_rack_id' AND object_id = OBJECT_ID('dbo.servers'))
BEGIN
    CREATE INDEX IX_servers_rack_id ON dbo.servers(rack_id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_status_health' AND object_id = OBJECT_ID('dbo.servers'))
BEGIN
    CREATE INDEX IX_servers_status_health ON dbo.servers(status, health_status) INCLUDE (server_id, server_code, hostname);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_server_incidents_server_id' AND object_id = OBJECT_ID('dbo.server_incidents'))
BEGIN
    CREATE INDEX IX_server_incidents_server_id ON dbo.server_incidents(server_id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_server_incidents_status_severity' AND object_id = OBJECT_ID('dbo.server_incidents'))
BEGIN
    CREATE INDEX IX_server_incidents_status_severity ON dbo.server_incidents(status, severity, server_id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_server_maintenance_server_id' AND object_id = OBJECT_ID('dbo.server_maintenance'))
BEGIN
    CREATE INDEX IX_server_maintenance_server_id ON dbo.server_maintenance(server_id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_server_maintenance_status_scheduled' AND object_id = OBJECT_ID('dbo.server_maintenance'))
BEGIN
    CREATE INDEX IX_server_maintenance_status_scheduled ON dbo.server_maintenance(status, scheduled_start, server_id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_server_visits_server_id' AND object_id = OBJECT_ID('dbo.server_visits'))
BEGIN
    CREATE INDEX IX_server_visits_server_id ON dbo.server_visits(server_id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_server_visits_status_scheduled' AND object_id = OBJECT_ID('dbo.server_visits'))
BEGIN
    CREATE INDEX IX_server_visits_status_scheduled ON dbo.server_visits(status, scheduled_at, server_id);
END

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'audit_logs')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_logs_entity' AND object_id = OBJECT_ID('dbo.audit_logs'))
    BEGIN
        CREATE INDEX IX_audit_logs_entity ON dbo.audit_logs(entity, entity_id, created_at DESC);
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_logs_created_at' AND object_id = OBJECT_ID('dbo.audit_logs'))
    BEGIN
        CREATE INDEX IX_audit_logs_created_at ON dbo.audit_logs(created_at DESC);
    END
END

PRINT '  - All indexes verified.';
PRINT '';

-- =====================================================
-- 8. VERIFY activity_log TABLE (for unified timeline)
-- =====================================================
PRINT '8. Verifying activity_log table...';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'activity_log')
BEGIN
    PRINT '  - Creating activity_log table...';
    CREATE TABLE dbo.activity_log (
        activity_id INT IDENTITY(1,1) NOT NULL,
        entity_type NVARCHAR(50) NOT NULL,
        entity_id INT NOT NULL,
        server_id INT NULL,
        action NVARCHAR(50) NOT NULL,
        actor_type NVARCHAR(20) NOT NULL DEFAULT 'user',
        actor_id INT NULL,
        actor_name NVARCHAR(200) NULL,
        description NVARCHAR(500) NULL,
        old_value NVARCHAR(MAX) NULL,
        new_value NVARCHAR(MAX) NULL,
        metadata NVARCHAR(MAX) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT PK_activity_log PRIMARY KEY (activity_id)
    );
    
    CREATE INDEX IX_activity_log_server_id ON dbo.activity_log(server_id, created_at DESC);
    CREATE INDEX IX_activity_log_entity ON dbo.activity_log(entity_type, entity_id, created_at DESC);
    CREATE INDEX IX_activity_log_created_at ON dbo.activity_log(created_at DESC);
    
    PRINT '  - activity_log table created.';
END
ELSE
BEGIN
    PRINT '  - activity_log table exists.';
    
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.activity_log') AND name = 'server_id')
    BEGIN
        PRINT '  - Adding server_id column to activity_log...';
        ALTER TABLE dbo.activity_log ADD server_id INT NULL;
        
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_activity_log_server_id' AND object_id = OBJECT_ID('dbo.activity_log'))
        BEGIN
            CREATE INDEX IX_activity_log_server_id ON dbo.activity_log(server_id, created_at DESC);
        END
    END
END

PRINT '  - activity_log table verified.';
PRINT '';

-- =====================================================
-- 9. VERIFY server_applications JUNCTION TABLE
-- =====================================================
PRINT '9. Verifying server_applications table...';

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'server_applications')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_server_applications_server' AND parent_object_id = OBJECT_ID('dbo.server_applications'))
    BEGIN
        PRINT '  - Adding FK_server_applications_server...';
        ALTER TABLE dbo.server_applications ADD CONSTRAINT FK_server_applications_server 
            FOREIGN KEY (server_id) REFERENCES dbo.servers(server_id) ON DELETE CASCADE;
    END
    
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_server_applications_application' AND parent_object_id = OBJECT_ID('dbo.server_applications'))
    BEGIN
        PRINT '  - Adding FK_server_applications_application...';
        ALTER TABLE dbo.server_applications ADD CONSTRAINT FK_server_applications_application 
            FOREIGN KEY (application_id) REFERENCES dbo.applications(application_id) ON DELETE CASCADE;
    END
    
    PRINT '  - server_applications table verified.';
END
PRINT '';

-- =====================================================
-- COMPLETION
-- =====================================================
PRINT '';
PRINT '========================================';
PRINT 'V2 Schema Verification Complete!';
PRINT '========================================';
PRINT '';
PRINT 'Summary:';
PRINT '  - All tables verified/created';
PRINT '  - All columns verified/added';
PRINT '  - All foreign keys verified';
PRINT '  - All indexes created for performance';
PRINT '  - Ready for V2 Status Engine';
PRINT '';

GO
