-- ============================================================
-- TELCO SERVER ASSET MANAGEMENT SYSTEM
-- Complete Database Schema
-- SQL Server 2019+
-- ============================================================

CREATE DATABASE TELCO_ASSET_MGMT;
GO
USE TELCO_ASSET_MGMT;
GO

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
    department_id INT IDENTITY(1,1) PRIMARY KEY,
    department_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(255),
    head_name NVARCHAR(100),
    head_email NVARCHAR(100),
    head_phone NVARCHAR(50),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
    team_id INT IDENTITY(1,1) PRIMARY KEY,
    team_name NVARCHAR(100) NOT NULL,
    department_id INT NOT NULL,
    description NVARCHAR(255),
    oncall_phone NVARCHAR(50),
    oncall_email NVARCHAR(100),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- ============================================================
-- ROLES & PERMISSIONS
-- ============================================================
CREATE TABLE roles (
    role_id INT IDENTITY(1,1) PRIMARY KEY,
    role_name NVARCHAR(50) NOT NULL UNIQUE,
    description NVARCHAR(255),
    level INT NOT NULL DEFAULT 0
);

CREATE TABLE permissions (
    permission_id INT IDENTITY(1,1) PRIMARY KEY,
    permission_name NVARCHAR(100) NOT NULL UNIQUE,
    module NVARCHAR(50) NOT NULL,
    action NVARCHAR(20) NOT NULL,
    description NVARCHAR(255)
);

CREATE TABLE role_permissions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id),
    UNIQUE(role_id, permission_id)
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(100) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    full_name NVARCHAR(100) NOT NULL,
    email NVARCHAR(100),
    phone NVARCHAR(50),
    role_id INT NOT NULL,
    department_id INT,
    team_id INT,
    is_active BIT DEFAULT 1,
    otp_method NVARCHAR(20) DEFAULT 'sms',
    last_login DATETIME,
    failed_attempts INT DEFAULT 0,
    locked_until DATETIME,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

-- ============================================================
-- ENGINEERS
-- ============================================================
CREATE TABLE engineers (
    engineer_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT UNIQUE,
    full_name NVARCHAR(100) NOT NULL,
    phone NVARCHAR(50),
    email NVARCHAR(100),
    employee_id NVARCHAR(50),
    team_id INT,
    specialization NVARCHAR(100),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (team_id) REFERENCES teams(team_id)
);

-- ============================================================
-- LOCATIONS
-- ============================================================
CREATE TABLE locations (
    location_id INT IDENTITY(1,1) PRIMARY KEY,
    country NVARCHAR(50),
    city NVARCHAR(50),
    site_name NVARCHAR(100) NOT NULL,
    site_type NVARCHAR(50),
    address NVARCHAR(255),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    power_source NVARCHAR(50),
    cooling_type NVARCHAR(50),
    contact_name NVARCHAR(100),
    contact_phone NVARCHAR(50),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);

-- ============================================================
-- RACKS
-- ============================================================
CREATE TABLE racks (
    rack_id INT IDENTITY(1,1) PRIMARY KEY,
    location_id INT NOT NULL,
    rack_code NVARCHAR(50) NOT NULL,
    rack_name NVARCHAR(100),
    total_u INT DEFAULT 42,
    power_circuit_a NVARCHAR(100),
    power_circuit_b NVARCHAR(100),
    description NVARCHAR(255),
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
);

-- ============================================================
-- SERVERS
-- ============================================================
CREATE TABLE servers (
    server_id INT IDENTITY(1,1) PRIMARY KEY,
    server_code NVARCHAR(50) UNIQUE NOT NULL,
    hostname NVARCHAR(100),
    server_type NVARCHAR(50),
    environment NVARCHAR(50),
    role NVARCHAR(100),
    status NVARCHAR(50) DEFAULT 'Active',
    power_type NVARCHAR(20) DEFAULT 'Single',
    team_id INT,
    department_id INT,
    location_id INT,
    rack_id INT,
    u_position_start INT,
    u_position_end INT,
    install_date DATE,
    decommission_date DATE,
    notes NVARCHAR(500),
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (team_id) REFERENCES teams(team_id),
    FOREIGN KEY (department_id) REFERENCES departments(department_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    FOREIGN KEY (rack_id) REFERENCES racks(rack_id)
);

-- ============================================================
-- SERVER ASSIGNMENTS (Engineer accountability)
-- ============================================================
CREATE TABLE server_assignments (
    assignment_id INT IDENTITY(1,1) PRIMARY KEY,
    server_id INT NOT NULL,
    engineer_id INT NOT NULL,
    assigned_by INT,
    assigned_at DATETIME DEFAULT GETDATE(),
    unassigned_at DATETIME,
    is_primary BIT DEFAULT 1,
    FOREIGN KEY (server_id) REFERENCES servers(server_id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(engineer_id),
    FOREIGN KEY (assigned_by) REFERENCES users(user_id)
);

-- ============================================================
-- SERVER CREDENTIALS (Encrypted)
-- ============================================================
CREATE TABLE server_credentials (
    credential_id INT IDENTITY(1,1) PRIMARY KEY,
    server_id INT NOT NULL,
    credential_type NVARCHAR(50) DEFAULT 'SSH',
    username NVARCHAR(100),
    password_encrypted NVARCHAR(500),
    port INT,
    notes NVARCHAR(255),
    created_by INT,
    updated_by INT,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (server_id) REFERENCES servers(server_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
);

-- ============================================================
-- SERVER HARDWARE
-- ============================================================
CREATE TABLE server_hardware (
    hardware_id INT IDENTITY(1,1) PRIMARY KEY,
    server_id INT UNIQUE NOT NULL,
    vendor NVARCHAR(50),
    model NVARCHAR(100),
    serial_number NVARCHAR(100),
    asset_tag NVARCHAR(100),
    cpu_model NVARCHAR(100),
    cpu_cores INT,
    ram_gb INT,
    storage_tb DECIMAL(6,2),
    raid_level NVARCHAR(20),
    nic_count INT,
    power_supply NVARCHAR(50),
    warranty_start DATE,
    warranty_expiry DATE,
    FOREIGN KEY (server_id) REFERENCES servers(server_id)
);

-- ============================================================
-- SERVER NETWORK
-- ============================================================
CREATE TABLE server_network (
    network_id INT IDENTITY(1,1) PRIMARY KEY,
    server_id INT NOT NULL,
    ip_address NVARCHAR(50),
    secondary_ip NVARCHAR(50),
    ipv6 NVARCHAR(50),
    subnet NVARCHAR(50),
    vlan NVARCHAR(50),
    gateway NVARCHAR(50),
    dns_primary NVARCHAR(50),
    dns_secondary NVARCHAR(50),
    network_type NVARCHAR(50),
    bandwidth NVARCHAR(50),
    firewall_enabled BIT DEFAULT 0,
    nat_enabled BIT DEFAULT 0,
    FOREIGN KEY (server_id) REFERENCES servers(server_id)
);

-- ============================================================
-- APPLICATIONS
-- ============================================================
CREATE TABLE applications (
    application_id INT IDENTITY(1,1) PRIMARY KEY,
    app_name NVARCHAR(100) NOT NULL,
    app_type NVARCHAR(50),
    version NVARCHAR(50),
    criticality NVARCHAR(20),
    sla_level NVARCHAR(20),
    description NVARCHAR(255),
    created_at DATETIME DEFAULT GETDATE()
);

CREATE TABLE server_applications (
    id INT IDENTITY(1,1) PRIMARY KEY,
    server_id INT NOT NULL,
    application_id INT NOT NULL,
    ports NVARCHAR(100),
    database_type NVARCHAR(50),
    database_name NVARCHAR(100),
    owner_team_id INT,
    status NVARCHAR(50) DEFAULT 'Active',
    installed_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (server_id) REFERENCES servers(server_id),
    FOREIGN KEY (application_id) REFERENCES applications(application_id),
    FOREIGN KEY (owner_team_id) REFERENCES teams(team_id)
);

-- ============================================================
-- SERVER SECURITY
-- ============================================================
CREATE TABLE server_security (
    security_id INT IDENTITY(1,1) PRIMARY KEY,
    server_id INT UNIQUE NOT NULL,
    os_name NVARCHAR(50),
    os_version NVARCHAR(50),
    hardening_status NVARCHAR(50) DEFAULT 'Pending',
    ssh_key_only BIT DEFAULT 0,
    antivirus_installed BIT DEFAULT 0,
    backup_enabled BIT DEFAULT 0,
    backup_frequency NVARCHAR(50),
    backup_destination NVARCHAR(255),
    log_retention_days INT DEFAULT 90,
    compliance_status NVARCHAR(100),
    last_audit_date DATE,
    next_audit_date DATE,
    FOREIGN KEY (server_id) REFERENCES servers(server_id)
);

-- ============================================================
-- SERVER MONITORING
-- ============================================================
CREATE TABLE server_monitoring (
    monitoring_id INT IDENTITY(1,1) PRIMARY KEY,
    server_id INT UNIQUE NOT NULL,
    monitoring_tool NVARCHAR(50),
    monitoring_url NVARCHAR(255),
    cpu_threshold INT DEFAULT 80,
    ram_threshold INT DEFAULT 85,
    disk_threshold INT DEFAULT 90,
    uptime_percent DECIMAL(5,2) DEFAULT 99.99,
    last_health_check DATETIME,
    health_status NVARCHAR(20) DEFAULT 'Unknown',
    alert_enabled BIT DEFAULT 1,
    FOREIGN KEY (server_id) REFERENCES servers(server_id)
);

-- ============================================================
-- MAINTENANCE
-- ============================================================
CREATE TABLE maintenance (
    maintenance_id INT IDENTITY(1,1) PRIMARY KEY,
    server_id INT NOT NULL,
    template_id INT,
    maintenance_type NVARCHAR(50) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(500),
    scheduled_date DATETIME NOT NULL,
    scheduled_end DATETIME,
    actual_start DATETIME,
    actual_end DATETIME,
    status NVARCHAR(50) DEFAULT 'Scheduled',
    priority NVARCHAR(20) DEFAULT 'Medium',
    assigned_engineer_id INT,
    notify_team BIT DEFAULT 1,
    notify_engineer BIT DEFAULT 1,
    sms_sent BIT DEFAULT 0,
    reminder_sent BIT DEFAULT 0,
    recurrence_type NVARCHAR(50),
    recurrence_interval INT,
    next_scheduled_date DATETIME,
    checklist_tasks NVARCHAR(MAX),
    completion_notes NVARCHAR(500),
    created_by INT,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (server_id) REFERENCES servers(server_id),
    FOREIGN KEY (assigned_engineer_id) REFERENCES engineers(engineer_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- ============================================================
-- MAINTENANCE TEMPLATES
-- ============================================================
CREATE TABLE maintenance_templates (
    template_id INT IDENTITY(1,1) PRIMARY KEY,
    template_name NVARCHAR(120) NOT NULL,
    maintenance_type NVARCHAR(50) NOT NULL,
    default_priority NVARCHAR(20),
    default_description NVARCHAR(500),
    checklist_tasks NVARCHAR(MAX),
    is_active BIT DEFAULT 1,
    created_by INT,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

ALTER TABLE maintenance
ADD CONSTRAINT FK_maintenance_template_id FOREIGN KEY (template_id) REFERENCES maintenance_templates(template_id);

-- ============================================================
-- MAINTENANCE RUNS (History)
-- ============================================================
CREATE TABLE maintenance_runs (
    run_id INT IDENTITY(1,1) PRIMARY KEY,
    maintenance_id INT NOT NULL,
    run_status NVARCHAR(30) NOT NULL DEFAULT 'Pending',
    run_result NVARCHAR(30),
    started_at DATETIME,
    completed_at DATETIME,
    completion_notes NVARCHAR(1000),
    completed_by INT,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (maintenance_id) REFERENCES maintenance(maintenance_id),
    FOREIGN KEY (completed_by) REFERENCES users(user_id)
);

-- ============================================================
-- INCIDENTS
-- ============================================================
CREATE TABLE incidents (
    incident_id INT IDENTITY(1,1) PRIMARY KEY,
    server_id INT NOT NULL,
    incident_type NVARCHAR(50) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    severity NVARCHAR(20) NOT NULL,
    description NVARCHAR(1000),
    status NVARCHAR(50) DEFAULT 'Open',
    reported_by INT,
    assigned_to INT,
    escalated_to INT,
    root_cause NVARCHAR(500),
    resolution_notes NVARCHAR(500),
    sla_deadline DATETIME,
    reported_at DATETIME DEFAULT GETDATE(),
    acknowledged_at DATETIME,
    resolved_at DATETIME,
    closed_at DATETIME,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (server_id) REFERENCES servers(server_id),
    FOREIGN KEY (reported_by) REFERENCES users(user_id),
    FOREIGN KEY (assigned_to) REFERENCES engineers(engineer_id),
    FOREIGN KEY (escalated_to) REFERENCES engineers(engineer_id)
);

-- ============================================================
-- VISITS
-- ============================================================
CREATE TABLE server_visits (
    visit_id INT IDENTITY(1,1) PRIMARY KEY,
    server_id INT NOT NULL,
    engineer_id INT NOT NULL,
    visit_date DATETIME NOT NULL,
    visit_type NVARCHAR(50),
    purpose NVARCHAR(255),
    findings NVARCHAR(500),
    actions_taken NVARCHAR(500),
    duration_minutes INT,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (server_id) REFERENCES servers(server_id),
    FOREIGN KEY (engineer_id) REFERENCES engineers(engineer_id)
);

-- ============================================================
-- AUDIT LOG (Immutable)
-- ============================================================
CREATE TABLE audit_log (
    log_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    username NVARCHAR(100),
    action NVARCHAR(50) NOT NULL,
    entity_type NVARCHAR(50) NOT NULL,
    entity_id INT,
    old_value NVARCHAR(MAX),
    new_value NVARCHAR(MAX),
    ip_address NVARCHAR(50),
    user_agent NVARCHAR(255),
    is_sensitive BIT DEFAULT 0,
    performed_at DATETIME DEFAULT GETDATE()
);

-- ============================================================
-- OTP LOG
-- ============================================================
CREATE TABLE otp_log (
    otp_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    otp_code NVARCHAR(10),
    purpose NVARCHAR(100),
    phone_number NVARCHAR(50),
    status NVARCHAR(20) DEFAULT 'Pending',
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    expires_at DATETIME,
    verified_at DATETIME,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ============================================================
-- SMS LOG
-- ============================================================
CREATE TABLE sms_log (
    sms_id INT IDENTITY(1,1) PRIMARY KEY,
    recipient NVARCHAR(50) NOT NULL,
    message NVARCHAR(500) NOT NULL,
    sms_type NVARCHAR(50),
    status NVARCHAR(20) DEFAULT 'Pending',
    provider_response NVARCHAR(500),
    related_entity NVARCHAR(50),
    entity_id INT,
    sent_at DATETIME DEFAULT GETDATE()
);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE notification_preferences (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    email_enabled BIT DEFAULT 1,
    sms_enabled BIT DEFAULT 1,
    incident_alerts BIT DEFAULT 1,
    maintenance_alerts BIT DEFAULT 1,
    system_alerts BIT DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ============================================================
-- SYSTEM SETTINGS
-- ============================================================
CREATE TABLE system_settings (
    setting_id INT IDENTITY(1,1) PRIMARY KEY,
    setting_key NVARCHAR(100) NOT NULL UNIQUE,
    setting_value NVARCHAR(500),
    setting_type NVARCHAR(50) DEFAULT 'string',
    category NVARCHAR(50),
    description NVARCHAR(255),
    updated_by INT,
    updated_at DATETIME DEFAULT GETDATE()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IX_servers_status ON servers(status);
CREATE INDEX IX_servers_team ON servers(team_id);
CREATE INDEX IX_servers_location ON servers(location_id);
CREATE INDEX IX_servers_rack ON servers(rack_id);
CREATE INDEX IX_servers_department ON servers(department_id);
CREATE INDEX IX_incidents_status ON incidents(status);
CREATE INDEX IX_incidents_severity ON incidents(severity);
CREATE INDEX IX_incidents_server ON incidents(server_id);
CREATE INDEX IX_maintenance_status ON maintenance(status);
CREATE INDEX IX_maintenance_date ON maintenance(scheduled_date);
CREATE INDEX IX_audit_log_user ON audit_log(user_id);
CREATE INDEX IX_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IX_audit_log_date ON audit_log(performed_at);
CREATE INDEX IX_server_assignments_server ON server_assignments(server_id);
CREATE INDEX IX_server_assignments_engineer ON server_assignments(engineer_id);
CREATE INDEX IX_engineers_team ON engineers(team_id);
CREATE INDEX IX_users_role ON users(role_id);
GO
