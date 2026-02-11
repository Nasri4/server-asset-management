-- =====================================================
-- SERVER ASSET MANAGEMENT - BASE SCHEMA (Fresh Install)
-- Target DB: Microsoft SQL Server
-- Notes:
--  - Idempotent for fresh installs (creates objects if missing)
--  - Existing installations should prefer incremental migrations in sql/migrations/
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

/* =====================================================
 * CORE TABLES
 * ===================================================== */

IF OBJECT_ID('dbo.teams', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.teams (
		team_id INT IDENTITY(1,1) NOT NULL,
		team_name NVARCHAR(200) NOT NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_teams_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_teams_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_teams PRIMARY KEY (team_id)
	);

	CREATE UNIQUE INDEX UQ_teams_team_name ON dbo.teams(team_name);
END
GO

IF OBJECT_ID('dbo.engineers', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.engineers (
		engineer_id INT IDENTITY(1,1) NOT NULL,
		full_name NVARCHAR(200) NOT NULL,
		email NVARCHAR(320) NULL,
		phone NVARCHAR(50) NULL,
		team_id INT NULL,
		is_active BIT NOT NULL CONSTRAINT DF_engineers_is_active DEFAULT (1),
		created_at DATETIME NOT NULL CONSTRAINT DF_engineers_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_engineers_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_engineers PRIMARY KEY (engineer_id)
	);

	ALTER TABLE dbo.engineers WITH CHECK
		ADD CONSTRAINT FK_engineers_team
		FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id)
		ON DELETE SET NULL;

	CREATE INDEX IX_engineers_team_id ON dbo.engineers(team_id);
END
GO

IF OBJECT_ID('dbo.locations', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.locations (
		location_id INT IDENTITY(1,1) NOT NULL,
		site_name NVARCHAR(200) NOT NULL,
		address NVARCHAR(400) NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_locations_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_locations_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_locations PRIMARY KEY (location_id)
	);

	CREATE UNIQUE INDEX UQ_locations_site_name ON dbo.locations(site_name);
END
GO

IF OBJECT_ID('dbo.racks', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.racks (
		rack_id INT IDENTITY(1,1) NOT NULL,
		rack_code NVARCHAR(100) NOT NULL,
		location_id INT NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_racks_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_racks_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_racks PRIMARY KEY (rack_id)
	);

	ALTER TABLE dbo.racks WITH CHECK
		ADD CONSTRAINT FK_racks_location
		FOREIGN KEY (location_id) REFERENCES dbo.locations(location_id)
		ON DELETE SET NULL;

	CREATE UNIQUE INDEX UQ_racks_rack_code ON dbo.racks(rack_code);
	CREATE INDEX IX_racks_location_id ON dbo.racks(location_id);
END
GO

IF OBJECT_ID('dbo.servers', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.servers (
		server_id INT IDENTITY(1,1) NOT NULL,
		server_code NVARCHAR(100) NOT NULL,
		hostname NVARCHAR(200) NOT NULL,
		server_type NVARCHAR(100) NOT NULL,
		environment NVARCHAR(50) NOT NULL,
		role NVARCHAR(100) NOT NULL,
		status NVARCHAR(20) NOT NULL CONSTRAINT DF_servers_status DEFAULT('Active'),
		power NVARCHAR(20) NULL,

		team_id INT NULL,
		engineer_id INT NULL,
		location_id INT NULL,
		rack_id INT NULL,
		u_position NVARCHAR(50) NULL,
		install_date DATE NULL,

		created_at DATETIME NOT NULL CONSTRAINT DF_servers_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_servers_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_servers PRIMARY KEY (server_id)
	);

	ALTER TABLE dbo.servers WITH CHECK
		ADD CONSTRAINT CK_servers_status CHECK (status IN ('Active','Maintenance','Degraded','Offline'));

	ALTER TABLE dbo.servers WITH CHECK
		ADD CONSTRAINT CK_servers_power CHECK (power IS NULL OR power IN ('Single','Double','Triple','Quad'));

	ALTER TABLE dbo.servers WITH CHECK
		ADD CONSTRAINT FK_servers_team FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id) ON DELETE SET NULL;

	ALTER TABLE dbo.servers WITH CHECK
		ADD CONSTRAINT FK_servers_engineer FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;

	ALTER TABLE dbo.servers WITH CHECK
		ADD CONSTRAINT FK_servers_location FOREIGN KEY (location_id) REFERENCES dbo.locations(location_id) ON DELETE SET NULL;

	ALTER TABLE dbo.servers WITH CHECK
		ADD CONSTRAINT FK_servers_rack FOREIGN KEY (rack_id) REFERENCES dbo.racks(rack_id) ON DELETE SET NULL;

	CREATE UNIQUE INDEX UQ_servers_server_code ON dbo.servers(server_code);
	CREATE INDEX IX_servers_team_id ON dbo.servers(team_id);
	CREATE INDEX IX_servers_engineer_id ON dbo.servers(engineer_id);
	CREATE INDEX IX_servers_location_id ON dbo.servers(location_id);
	CREATE INDEX IX_servers_rack_id ON dbo.servers(rack_id);
END
GO

/* =====================================================
 * OPERATIONAL TABLES (All reference servers.server_id)
 * ===================================================== */

IF OBJECT_ID('dbo.server_incidents', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.server_incidents (
		incident_id INT IDENTITY(1,1) NOT NULL,
		server_id INT NOT NULL,
		engineer_id INT NULL,
		incident_type NVARCHAR(100) NULL,
		severity NVARCHAR(20) NOT NULL,
		status NVARCHAR(20) NOT NULL,
		description NVARCHAR(MAX) NULL,
		reported_at DATETIME NOT NULL CONSTRAINT DF_server_incidents_reported_at DEFAULT (GETDATE()),
		resolved_at DATETIME NULL,
		root_cause NVARCHAR(MAX) NULL,
		resolution NVARCHAR(MAX) NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_server_incidents_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_server_incidents_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_server_incidents PRIMARY KEY (incident_id)
	);

	ALTER TABLE dbo.server_incidents WITH CHECK
		ADD CONSTRAINT FK_server_incidents_server FOREIGN KEY (server_id)
		REFERENCES dbo.servers(server_id) ON DELETE CASCADE;

	ALTER TABLE dbo.server_incidents WITH CHECK
		ADD CONSTRAINT FK_server_incidents_engineer FOREIGN KEY (engineer_id)
		REFERENCES dbo.engineers(engineer_id) ON DELETE SET NULL;

	ALTER TABLE dbo.server_incidents WITH CHECK
		ADD CONSTRAINT CK_server_incidents_status CHECK (status IN ('Open','InProgress','Resolved','Closed'));

	ALTER TABLE dbo.server_incidents WITH CHECK
		ADD CONSTRAINT CK_server_incidents_severity CHECK (severity IN ('Critical','Major','Medium','Low'));

	CREATE INDEX IX_server_incidents_server_id ON dbo.server_incidents(server_id);
	CREATE INDEX IX_server_incidents_engineer_id ON dbo.server_incidents(engineer_id);
	CREATE INDEX IX_server_incidents_server_status ON dbo.server_incidents(server_id, status, severity, created_at DESC);
END
GO

IF OBJECT_ID('dbo.server_maintenance', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.server_maintenance (
		maintenance_id INT IDENTITY(1,1) NOT NULL,
		server_id INT NOT NULL,
		maintenance_type NVARCHAR(100) NULL,
		status NVARCHAR(20) NOT NULL,
		scheduled_start DATETIME NULL,
		scheduled_end DATETIME NULL,
		notes NVARCHAR(MAX) NULL,
		started_at DATETIME NULL,
		completed_at DATETIME NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_server_maintenance_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_server_maintenance_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_server_maintenance PRIMARY KEY (maintenance_id)
	);

	ALTER TABLE dbo.server_maintenance WITH CHECK
		ADD CONSTRAINT FK_server_maintenance_server FOREIGN KEY (server_id)
		REFERENCES dbo.servers(server_id) ON DELETE CASCADE;

	ALTER TABLE dbo.server_maintenance WITH CHECK
		ADD CONSTRAINT CK_server_maintenance_status CHECK (status IN ('Scheduled','InProgress','Completed','Cancelled'));

	CREATE INDEX IX_server_maintenance_server_id ON dbo.server_maintenance(server_id);
	CREATE INDEX IX_server_maintenance_server_status ON dbo.server_maintenance(server_id, status, scheduled_start DESC);
END
GO

IF OBJECT_ID('dbo.server_monitoring', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.server_monitoring (
		server_id INT NOT NULL,
		uptime_percent DECIMAL(5,2) NULL,
		cpu_threshold INT NULL,
		ram_threshold INT NULL,
		disk_threshold INT NULL,
		last_check_at DATETIME NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_server_monitoring_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_server_monitoring_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_server_monitoring PRIMARY KEY (server_id)
	);

	ALTER TABLE dbo.server_monitoring WITH CHECK
		ADD CONSTRAINT FK_server_monitoring_server FOREIGN KEY (server_id)
		REFERENCES dbo.servers(server_id) ON DELETE CASCADE;
END
GO

IF OBJECT_ID('dbo.server_security', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.server_security (
		server_id INT NOT NULL,
		patch_level NVARCHAR(100) NULL,
		last_patch_date DATE NULL,
		has_antivirus BIT NULL,
		firewall_enabled BIT NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_server_security_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_server_security_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_server_security PRIMARY KEY (server_id)
	);

	ALTER TABLE dbo.server_security WITH CHECK
		ADD CONSTRAINT FK_server_security_server FOREIGN KEY (server_id)
		REFERENCES dbo.servers(server_id) ON DELETE CASCADE;
END
GO

IF OBJECT_ID('dbo.server_network', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.server_network (
		network_id INT IDENTITY(1,1) NOT NULL,
		server_id INT NOT NULL,
		ip_address NVARCHAR(64) NULL,
		mac_address NVARCHAR(64) NULL,
		vlan NVARCHAR(50) NULL,
		subnet_mask NVARCHAR(64) NULL,
		gateway NVARCHAR(64) NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_server_network_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_server_network_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_server_network PRIMARY KEY (network_id)
	);

	ALTER TABLE dbo.server_network WITH CHECK
		ADD CONSTRAINT FK_server_network_server FOREIGN KEY (server_id)
		REFERENCES dbo.servers(server_id) ON DELETE CASCADE;

	CREATE INDEX IX_server_network_server_id ON dbo.server_network(server_id);
END
GO

IF OBJECT_ID('dbo.server_hardware', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.server_hardware (
		server_id INT NOT NULL,
		manufacturer NVARCHAR(200) NULL,
		model NVARCHAR(200) NULL,
		serial_number NVARCHAR(200) NULL,
		cpu NVARCHAR(200) NULL,
		ram_gb INT NULL,
		disk_gb INT NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_server_hardware_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_server_hardware_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_server_hardware PRIMARY KEY (server_id)
	);

	ALTER TABLE dbo.server_hardware WITH CHECK
		ADD CONSTRAINT FK_server_hardware_server FOREIGN KEY (server_id)
		REFERENCES dbo.servers(server_id) ON DELETE CASCADE;
END
GO

IF OBJECT_ID('dbo.server_visits', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.server_visits (
		visit_id INT IDENTITY(1,1) NOT NULL,
		server_id INT NOT NULL,
		visit_type NVARCHAR(50) NOT NULL,
		visit_date DATETIME NOT NULL,
		notes NVARCHAR(MAX) NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_server_visits_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_server_visits_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_server_visits PRIMARY KEY (visit_id)
	);

	ALTER TABLE dbo.server_visits WITH CHECK
		ADD CONSTRAINT FK_server_visits_server FOREIGN KEY (server_id)
		REFERENCES dbo.servers(server_id) ON DELETE CASCADE;

	CREATE INDEX IX_server_visits_server_id ON dbo.server_visits(server_id);
END
GO

/* =====================================================
 * CREDENTIALS + AUDIT
 * ===================================================== */

IF OBJECT_ID('dbo.server_credentials', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.server_credentials (
		server_id INT NOT NULL,
		login_username NVARCHAR(200) NULL,
		password_enc NVARCHAR(MAX) NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_server_credentials_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_server_credentials_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_server_credentials PRIMARY KEY (server_id)
	);

	ALTER TABLE dbo.server_credentials WITH CHECK
		ADD CONSTRAINT FK_server_credentials_server FOREIGN KEY (server_id)
		REFERENCES dbo.servers(server_id) ON DELETE CASCADE;
END
GO

IF OBJECT_ID('dbo.audit_logs', 'U') IS NULL
BEGIN
	CREATE TABLE dbo.audit_logs (
		audit_id INT IDENTITY(1,1) NOT NULL,
		actor NVARCHAR(255) NOT NULL,
		action NVARCHAR(100) NOT NULL,
		entity NVARCHAR(100) NOT NULL,
		entity_id NVARCHAR(100) NULL,
		details NVARCHAR(MAX) NULL,
		created_at DATETIME NOT NULL CONSTRAINT DF_audit_logs_created_at DEFAULT (GETDATE()),
		updated_at DATETIME NOT NULL CONSTRAINT DF_audit_logs_updated_at DEFAULT (GETDATE()),
		CONSTRAINT PK_audit_logs PRIMARY KEY (audit_id)
	);

	CREATE INDEX IX_audit_logs_created_at ON dbo.audit_logs(created_at DESC);
END
GO

/* =====================================================
 * STORED PROCEDURE USED BY BACKEND: dbo.sp_register_server
 * ===================================================== */

IF OBJECT_ID('dbo.sp_register_server', 'P') IS NULL
EXEC('CREATE PROCEDURE dbo.sp_register_server AS BEGIN SET NOCOUNT ON; END');
GO

ALTER PROCEDURE dbo.sp_register_server
	@server_code NVARCHAR(100),
	@hostname NVARCHAR(200),
	@server_type NVARCHAR(100),
	@environment NVARCHAR(50),
	@role NVARCHAR(100),
	@team_id INT = NULL,
	@location_id INT = NULL
AS
BEGIN
	SET NOCOUNT ON;

	INSERT INTO dbo.servers(
		server_code,
		hostname,
		server_type,
		environment,
		role,
		status,
		team_id,
		location_id,
		created_at,
		updated_at
	)
	VALUES(
		@server_code,
		@hostname,
		@server_type,
		@environment,
		@role,
		'Active',
		@team_id,
		@location_id,
		GETDATE(),
		GETDATE()
	);

	SELECT SCOPE_IDENTITY() AS server_id;
END
GO
