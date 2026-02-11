-- =====================================================
-- SET DEVELOPER PASSWORD
-- Sets password to "developer123"
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

PRINT 'Setting developer password...';

-- Bcrypt hash for "developer123" (cost factor 12)
-- Generated with: bcrypt.hash('developer123', 12)
UPDATE dbo.Users
SET password_hash = '$2b$12$Ll.Af27AxRwR1BvMx57ag.F3TH7Pomg7AfDQkSLxfptdq7uilwOF6'
WHERE username = 'developer';

IF @@ROWCOUNT > 0
BEGIN
    PRINT '✓ Password set for developer';
    PRINT '';
    PRINT 'Login credentials:';
    PRINT '  Username: developer';
    PRINT '  Password: developer123';
END
ELSE
BEGIN
    PRINT '⚠ Developer user not found';
END

PRINT '';
GO
