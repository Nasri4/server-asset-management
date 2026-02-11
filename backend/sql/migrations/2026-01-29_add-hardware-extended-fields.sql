-- Add extended hardware fields for datacenter asset tracking
-- Migration: 2026-01-29_add-hardware-extended-fields.sql

USE [SAM];
GO

-- Add new columns to server_hardware table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_hardware') AND name = 'raid_level')
BEGIN
    ALTER TABLE dbo.server_hardware
    ADD raid_level NVARCHAR(50) NULL;
    PRINT 'Added raid_level column';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_hardware') AND name = 'nic_count')
BEGIN
    ALTER TABLE dbo.server_hardware
    ADD nic_count INT NULL;
    PRINT 'Added nic_count column';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_hardware') AND name = 'power_supply')
BEGIN
    ALTER TABLE dbo.server_hardware
    ADD power_supply NVARCHAR(100) NULL;
    PRINT 'Added power_supply column';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.server_hardware') AND name = 'warranty_expiry')
BEGIN
    ALTER TABLE dbo.server_hardware
    ADD warranty_expiry DATE NULL;
    PRINT 'Added warranty_expiry column';
END
GO

PRINT 'Hardware extended fields migration completed successfully';
GO
