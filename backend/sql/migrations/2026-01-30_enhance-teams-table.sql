-- =============================================
-- Migration: Enhance Teams Table
-- Description: Add enterprise fields for team management
-- Date: 2026-01-30
-- =============================================

USE [SERVER_ASSET_MANAGEMENT];
GO

-- Add new columns to teams table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.teams') AND name = 'department')
BEGIN
    ALTER TABLE dbo.teams ADD department NVARCHAR(100) NULL;
    PRINT 'Added column: department';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.teams') AND name = 'oncall_email')
BEGIN
    ALTER TABLE dbo.teams ADD oncall_email NVARCHAR(255) NULL;
    PRINT 'Added column: oncall_email';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.teams') AND name = 'oncall_phone')
BEGIN
    ALTER TABLE dbo.teams ADD oncall_phone NVARCHAR(50) NULL;
    PRINT 'Added column: oncall_phone';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.teams') AND name = 'description')
BEGIN
    ALTER TABLE dbo.teams ADD description NVARCHAR(500) NULL;
    PRINT 'Added column: description';
END

GO

PRINT 'Migration completed: Enhanced teams table with enterprise fields';
