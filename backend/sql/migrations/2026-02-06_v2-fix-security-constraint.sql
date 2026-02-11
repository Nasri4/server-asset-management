-- =====================================================
-- V2 FIX: Security Hardening Status Constraint
-- Date: 2026-02-06
-- Purpose: Update existing hardening_status values to match new constraint
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT '========================================';
PRINT 'Fixing server_security hardening_status';
PRINT '========================================';
PRINT '';

-- Step 1: Check current values
PRINT 'Current hardening_status values:';
SELECT DISTINCT hardening_status, COUNT(*) as count
FROM dbo.server_security
GROUP BY hardening_status;
PRINT '';

-- Step 2: Update existing values to match new constraint
PRINT 'Updating existing values...';

UPDATE dbo.server_security
SET hardening_status = CASE
    -- Map common variations to standard values
    WHEN hardening_status IS NULL THEN 'Not Assessed'
    WHEN LOWER(LTRIM(RTRIM(hardening_status))) IN ('not assessed', 'notassessed', 'not started', 'notstarted', 'pending') THEN 'Not Assessed'
    WHEN LOWER(LTRIM(RTRIM(hardening_status))) IN ('in progress', 'inprogress', 'in_progress', 'progress', 'ongoing') THEN 'In Progress'
    WHEN LOWER(LTRIM(RTRIM(hardening_status))) IN ('hardened', 'completed', 'complete', 'secured', 'compliant') THEN 'Hardened'
    WHEN LOWER(LTRIM(RTRIM(hardening_status))) IN ('non-compliant', 'noncompliant', 'non_compliant', 'failed', 'incomplete') THEN 'Non-Compliant'
    WHEN LOWER(LTRIM(RTRIM(hardening_status))) IN ('pending review', 'pendingreview', 'pending_review', 'review', 'under review') THEN 'Pending Review'
    -- If already matches standard value, keep it
    WHEN hardening_status IN ('Not Assessed', 'In Progress', 'Hardened', 'Non-Compliant', 'Pending Review') THEN hardening_status
    -- Default fallback
    ELSE 'Not Assessed'
END
WHERE hardening_status IS NULL 
   OR hardening_status NOT IN ('Not Assessed', 'In Progress', 'Hardened', 'Non-Compliant', 'Pending Review');

DECLARE @updated INT = @@ROWCOUNT;
PRINT '  - Updated ' + CAST(@updated AS VARCHAR(10)) + ' rows';
PRINT '';

-- Step 3: Verify all values are now compliant
PRINT 'Verifying all values are now compliant:';
SELECT DISTINCT hardening_status, COUNT(*) as count
FROM dbo.server_security
GROUP BY hardening_status;
PRINT '';

-- Step 4: Check if any non-compliant values remain
DECLARE @nonCompliant INT;
SELECT @nonCompliant = COUNT(*)
FROM dbo.server_security
WHERE hardening_status NOT IN ('Not Assessed', 'In Progress', 'Hardened', 'Non-Compliant', 'Pending Review');

IF @nonCompliant > 0
BEGIN
    PRINT 'WARNING: ' + CAST(@nonCompliant AS VARCHAR(10)) + ' rows still have non-compliant values!';
    PRINT 'Please review these rows manually:';
    SELECT security_id, server_id, hardening_status
    FROM dbo.server_security
    WHERE hardening_status NOT IN ('Not Assessed', 'In Progress', 'Hardened', 'Non-Compliant', 'Pending Review');
    PRINT '';
    PRINT 'Migration ABORTED. Please fix these values and re-run.';
END
ELSE
BEGIN
    -- Step 5: Drop existing constraint if it exists
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_server_security_hardening_status' AND parent_object_id = OBJECT_ID('dbo.server_security'))
    BEGIN
        PRINT 'Dropping existing constraint...';
        ALTER TABLE dbo.server_security DROP CONSTRAINT CK_server_security_hardening_status;
        PRINT '  - Existing constraint dropped';
    END
    PRINT '';
    
    -- Step 6: Add the new constraint
    PRINT 'Adding new constraint...';
    ALTER TABLE dbo.server_security ADD CONSTRAINT CK_server_security_hardening_status 
        CHECK (hardening_status IN ('Not Assessed','In Progress','Hardened','Non-Compliant','Pending Review'));
    PRINT '  - Constraint added successfully!';
    PRINT '';
    
    PRINT '========================================';
    PRINT 'Fix completed successfully!';
    PRINT '========================================';
END

GO
