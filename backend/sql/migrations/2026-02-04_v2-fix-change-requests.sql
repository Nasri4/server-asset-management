-- =====================================================
-- FIX: Change Requests Table
-- Date: 2026-02-04
-- Description: Fix foreign key constraints to avoid cascade path issues
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

-- Drop table if exists (to recreate with correct constraints)
IF OBJECT_ID('dbo.change_requests', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.change_requests;
    PRINT 'Dropped existing change_requests table';
END
GO

-- Recreate change_requests table with corrected constraints
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

-- Add foreign key to servers
ALTER TABLE dbo.change_requests WITH CHECK
    ADD CONSTRAINT FK_change_requests_server FOREIGN KEY (server_id)
    REFERENCES dbo.servers(server_id) ON DELETE SET NULL;

-- Add foreign key to engineers (requested_by) - no cascade delete
ALTER TABLE dbo.change_requests WITH CHECK
    ADD CONSTRAINT FK_change_requests_requested_by FOREIGN KEY (requested_by)
    REFERENCES dbo.engineers(engineer_id);

-- Add foreign key to engineers (approved_by) - NO ACTION to avoid cascade path
ALTER TABLE dbo.change_requests WITH CHECK
    ADD CONSTRAINT FK_change_requests_approved_by FOREIGN KEY (approved_by)
    REFERENCES dbo.engineers(engineer_id) ON DELETE NO ACTION;

-- Add foreign key to engineers (implementer) - NO ACTION to avoid cascade path
ALTER TABLE dbo.change_requests WITH CHECK
    ADD CONSTRAINT FK_change_requests_implementer FOREIGN KEY (implementer)
    REFERENCES dbo.engineers(engineer_id) ON DELETE NO ACTION;

-- Create indexes
CREATE INDEX IX_change_requests_server ON dbo.change_requests(server_id);
CREATE INDEX IX_change_requests_status ON dbo.change_requests(status, created_at DESC);
CREATE INDEX IX_change_requests_requested_by ON dbo.change_requests(requested_by);

PRINT '✓ Successfully created change_requests table with corrected constraints';
GO
