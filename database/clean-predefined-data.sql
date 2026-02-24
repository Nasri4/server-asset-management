-- ============================================================
-- CLEAN PREDEFINED DATA - TELCO_ASSET_MGMT
-- Removes teams, departments, locations, racks (user-created data remains in DB)
-- Run schema.sql and stored-procedures.sql first.
-- WARNING: This clears ALL teams, departments, locations, racks.
-- Servers, engineers, incidents, etc. are kept but unlinked.
-- ============================================================
USE TELCO_ASSET_MGMT;
GO

-- Clear FK references first
UPDATE server_applications SET owner_team_id = NULL;
UPDATE servers SET team_id = NULL, department_id = NULL, location_id = NULL, rack_id = NULL;
UPDATE engineers SET team_id = NULL;
UPDATE users SET department_id = NULL, team_id = NULL;

-- Delete in correct order (child before parent)
DELETE FROM teams;
DELETE FROM departments;
DELETE FROM racks;
DELETE FROM locations;

PRINT 'Predefined data cleaned. Teams, departments, locations, racks are now empty.';
PRINT 'Create new data via the application UI.';
GO
