-- Unlock all user accounts (e.g. after too many failed logins).
-- Run in SSMS: USE TELCO_ASSET_MGMT; then run this.
USE TELCO_ASSET_MGMT;
GO

UPDATE users SET failed_attempts = 0, locked_until = NULL;
GO

PRINT 'All user accounts unlocked.';
