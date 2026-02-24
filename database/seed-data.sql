-- ============================================================
-- MINIMAL SEED - TELCO_ASSET_MGMT
-- Only essential data. No predefined locations, racks, departments, teams.
-- Run schema.sql and stored-procedures.sql first.
-- ============================================================
USE TELCO_ASSET_MGMT;
GO

-- ============================================================
-- ROLES
-- ============================================================
IF (SELECT COUNT(*) FROM roles) = 0
BEGIN
  INSERT INTO roles (role_name, description, level) VALUES
  ('Admin', 'Full global access', 100),
  ('Department Head', 'Full control within department', 80),
  ('Team Leader', 'Full control within team', 60),
  ('Engineer', 'Manage assigned servers', 40),
  ('Viewer', 'Read-only access', 10);
END;
GO

-- ============================================================
-- PERMISSIONS
-- ============================================================
IF (SELECT COUNT(*) FROM permissions) = 0
BEGIN
  INSERT INTO permissions (permission_name, module, action, description) VALUES
  ('servers.create', 'servers', 'create', 'Create servers'),
  ('servers.read', 'servers', 'read', 'View servers'),
  ('servers.update', 'servers', 'update', 'Update servers'),
  ('servers.delete', 'servers', 'delete', 'Delete servers'),
  ('servers.credentials', 'servers', 'credentials', 'View credentials'),
  ('incidents.create', 'incidents', 'create', 'Create incidents'),
  ('incidents.read', 'incidents', 'read', 'View incidents'),
  ('incidents.update', 'incidents', 'update', 'Update incidents'),
  ('incidents.delete', 'incidents', 'delete', 'Delete incidents'),
  ('maintenance.create', 'maintenance', 'create', 'Schedule maintenance'),
  ('maintenance.read', 'maintenance', 'read', 'View maintenance'),
  ('maintenance.update', 'maintenance', 'update', 'Update maintenance'),
  ('maintenance.delete', 'maintenance', 'delete', 'Delete maintenance'),
  ('engineers.create', 'engineers', 'create', 'Create engineers'),
  ('engineers.read', 'engineers', 'read', 'View engineers'),
  ('engineers.update', 'engineers', 'update', 'Update engineers'),
  ('engineers.delete', 'engineers', 'delete', 'Delete engineers'),
  ('teams.create', 'teams', 'create', 'Create teams'),
  ('teams.read', 'teams', 'read', 'View teams'),
  ('teams.update', 'teams', 'update', 'Update teams'),
  ('teams.delete', 'teams', 'delete', 'Delete teams'),
  ('departments.create', 'departments', 'create', 'Create departments'),
  ('departments.read', 'departments', 'read', 'View departments'),
  ('departments.update', 'departments', 'update', 'Update departments'),
  ('departments.delete', 'departments', 'delete', 'Delete departments'),
  ('reports.read', 'reports', 'read', 'View reports'),
  ('reports.export', 'reports', 'export', 'Export reports'),
  ('audit.read', 'audit', 'read', 'View audit logs'),
  ('admin.users', 'admin', 'manage', 'Manage users'),
  ('admin.roles', 'admin', 'manage', 'Manage roles'),
  ('admin.settings', 'admin', 'manage', 'Manage settings');
END;
GO

-- ============================================================
-- ROLE PERMISSIONS (Admin = all)
-- ============================================================
IF (SELECT COUNT(*) FROM role_permissions) = 0
BEGIN
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT 1, permission_id FROM permissions;
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT 2, permission_id FROM permissions
  WHERE permission_name NOT IN ('admin.users', 'admin.roles', 'admin.settings');
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT 3, permission_id FROM permissions
  WHERE module IN ('servers', 'incidents', 'maintenance', 'engineers', 'reports')
     OR permission_name IN ('teams.read', 'teams.update', 'audit.read');
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT 4, permission_id FROM permissions
  WHERE permission_name IN ('servers.read', 'servers.update', 'servers.credentials',
    'incidents.create', 'incidents.read', 'incidents.update',
    'maintenance.read', 'maintenance.update', 'engineers.read', 'teams.read', 'reports.read');
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT 5, permission_id FROM permissions WHERE action = 'read';
END;
GO

-- ============================================================
-- DEFAULT ADMIN USER
-- Password: Admin@123 (change after first login)
-- Add your email/phone in Admin > Users for OTP delivery
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin')
BEGIN
  INSERT INTO users (username, password_hash, full_name, email, phone, role_id) VALUES
  ('admin', '$2b$12$LJ3m4ys3Lk0TSwMCkGKEaOZ4HkMKRc1JN.YOGANvjMwWHDmcoKxHi', 'Administrator', NULL, NULL, 1);
END;
GO

-- ============================================================
-- SYSTEM SETTINGS (minimal)
-- ============================================================
IF (SELECT COUNT(*) FROM system_settings) = 0
BEGIN
  INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description) VALUES
  ('system_name', 'TELCO Asset Management', 'string', 'general', 'System name'),
  ('timezone', 'Africa/Mogadishu', 'string', 'general', 'Timezone'),
  ('otp_expiry_minutes', '5', 'number', 'security', 'OTP expiry'),
  ('otp_max_attempts', '3', 'number', 'security', 'OTP max attempts');
END;
GO
