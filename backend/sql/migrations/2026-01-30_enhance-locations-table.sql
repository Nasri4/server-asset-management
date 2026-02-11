-- =============================================
-- Migration: Enhance Locations Table
-- Description: Add enterprise infrastructure fields for site management
-- Date: 2026-01-30
-- =============================================

USE [SERVER_ASSET_MANAGEMENT];
GO

-- Add new columns to locations table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.locations') AND name = 'country')
BEGIN
    ALTER TABLE dbo.locations ADD country NVARCHAR(100) NULL;
    PRINT 'Added column: country';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.locations') AND name = 'city')
BEGIN
    ALTER TABLE dbo.locations ADD city NVARCHAR(100) NULL;
    PRINT 'Added column: city';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.locations') AND name = 'address')
BEGIN
    ALTER TABLE dbo.locations ADD address NVARCHAR(500) NULL;
    PRINT 'Added column: address';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.locations') AND name = 'site_type')
BEGIN
    ALTER TABLE dbo.locations ADD site_type NVARCHAR(50) NULL;
    PRINT 'Added column: site_type';
    -- Valid values: 'Data Center', 'Edge', 'Office', 'Outdoor'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.locations') AND name = 'power_source')
BEGIN
    ALTER TABLE dbo.locations ADD power_source NVARCHAR(50) NULL;
    PRINT 'Added column: power_source';
    -- Valid values: 'Grid', 'UPS', 'Generator', 'Solar', 'Hybrid'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.locations') AND name = 'cooling_type')
BEGIN
    ALTER TABLE dbo.locations ADD cooling_type NVARCHAR(50) NULL;
    PRINT 'Added column: cooling_type';
    -- Valid values: 'HVAC', 'Airflow', 'Liquid', 'None'
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.locations') AND name = 'latitude')
BEGIN
    ALTER TABLE dbo.locations ADD latitude DECIMAL(10, 7) NULL;
    PRINT 'Added column: latitude';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.locations') AND name = 'longitude')
BEGIN
    ALTER TABLE dbo.locations ADD longitude DECIMAL(10, 7) NULL;
    PRINT 'Added column: longitude';
END

GO

PRINT 'Migration completed: Enhanced locations table with infrastructure fields';
