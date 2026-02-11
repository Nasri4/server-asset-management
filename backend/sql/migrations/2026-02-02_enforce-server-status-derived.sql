-- =====================================================
-- ENFORCE DERIVED SERVER STATUS + ENUM CONSTRAINTS
-- Migration: 2026-02-02
-- Purpose:
--  - Enforce strict enum/check constraints for servers/incidents/maintenance
--  - Add missing created_at/updated_at columns where absent
--  - Ensure FKs to dbo.servers(server_id) exist + are indexed
-- =====================================================

USE [SERVER_ASSET_MANAGEMENT];
GO

BEGIN TRY
	BEGIN TRAN;

	/* -----------------------------------------------------
	 * dbo.servers.status
	 * Allowed: Active | Maintenance | Degraded | Offline
	 * ---------------------------------------------------*/
	IF OBJECT_ID('dbo.servers', 'U') IS NOT NULL
		AND COL_LENGTH('dbo.servers', 'status') IS NOT NULL
	BEGIN
		-- Normalize a few known legacy values (if any)
		UPDATE dbo.servers SET status = 'Offline'  WHERE status IN ('Down', 'Critical');
		UPDATE dbo.servers SET status = 'Degraded' WHERE status IN ('Warning');

		IF EXISTS (
			SELECT 1
			FROM dbo.servers
			WHERE status IS NOT NULL
				AND status NOT IN ('Active','Maintenance','Degraded','Offline')
		)
			RAISERROR('Cannot add CK_servers_status: invalid dbo.servers.status values exist. Clean data first.', 16, 1);

		IF NOT EXISTS (
			SELECT 1
			FROM sys.check_constraints
			WHERE name = 'CK_servers_status'
				AND parent_object_id = OBJECT_ID('dbo.servers')
		)
		BEGIN
			ALTER TABLE dbo.servers WITH CHECK
				ADD CONSTRAINT CK_servers_status
				CHECK (status IN ('Active','Maintenance','Degraded','Offline'));
		END
	END

	/* -----------------------------------------------------
	 * dbo.server_incidents
	 * ---------------------------------------------------*/
	IF OBJECT_ID('dbo.server_incidents', 'U') IS NOT NULL
	BEGIN
		-- Ensure core enum columns exist (older installs may be missing these)
		IF COL_LENGTH('dbo.server_incidents', 'status') IS NULL
		BEGIN
			ALTER TABLE dbo.server_incidents
				ADD status NVARCHAR(20) NOT NULL
					CONSTRAINT DF_server_incidents_status DEFAULT ('Open');
		END

		-- Ensure timestamps
		IF COL_LENGTH('dbo.server_incidents', 'created_at') IS NULL
			ALTER TABLE dbo.server_incidents
				ADD created_at DATETIME NOT NULL CONSTRAINT DF_server_incidents_created_at DEFAULT (GETDATE());

		IF COL_LENGTH('dbo.server_incidents', 'updated_at') IS NULL
			ALTER TABLE dbo.server_incidents
				ADD updated_at DATETIME NOT NULL CONSTRAINT DF_server_incidents_updated_at DEFAULT (GETDATE());

		-- Normalize statuses to the canonical enum
		IF COL_LENGTH('dbo.server_incidents', 'status') IS NOT NULL
		BEGIN
			UPDATE dbo.server_incidents
			SET status = 'InProgress'
			WHERE status IN ('Investigating','Mitigating','In Progress','In progress','In-Progress');
		END

		-- Enforce status enum
		IF COL_LENGTH('dbo.server_incidents', 'status') IS NOT NULL
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM dbo.server_incidents
				WHERE status IS NOT NULL
					AND status NOT IN ('Open','InProgress','Resolved','Closed')
			)
				RAISERROR('Cannot add CK_server_incidents_status: invalid dbo.server_incidents.status values exist. Clean data first.', 16, 1);

			IF NOT EXISTS (
				SELECT 1
				FROM sys.check_constraints
				WHERE name = 'CK_server_incidents_status'
					AND parent_object_id = OBJECT_ID('dbo.server_incidents')
			)
			BEGIN
				ALTER TABLE dbo.server_incidents WITH CHECK
					ADD CONSTRAINT CK_server_incidents_status
					CHECK (status IN ('Open','InProgress','Resolved','Closed'));
			END
		END

		-- Enforce severity enum
		IF COL_LENGTH('dbo.server_incidents', 'severity') IS NOT NULL
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM dbo.server_incidents
				WHERE severity IS NOT NULL
					AND severity NOT IN ('Critical','Major','Medium','Low')
			)
				RAISERROR('Cannot add CK_server_incidents_severity: invalid dbo.server_incidents.severity values exist. Clean data first.', 16, 1);

			IF NOT EXISTS (
				SELECT 1
				FROM sys.check_constraints
				WHERE name = 'CK_server_incidents_severity'
					AND parent_object_id = OBJECT_ID('dbo.server_incidents')
			)
			BEGIN
				ALTER TABLE dbo.server_incidents WITH CHECK
					ADD CONSTRAINT CK_server_incidents_severity
					CHECK (severity IN ('Critical','Major','Medium','Low'));
			END
		END

		-- Ensure FK + index
		IF NOT EXISTS (
			SELECT 1
			FROM sys.foreign_keys
			WHERE name = 'FK_server_incidents_server'
				AND parent_object_id = OBJECT_ID('dbo.server_incidents')
		)
		BEGIN
			ALTER TABLE dbo.server_incidents WITH CHECK
				ADD CONSTRAINT FK_server_incidents_server
				FOREIGN KEY (server_id)
				REFERENCES dbo.servers(server_id)
				ON DELETE NO ACTION;
		END

		IF NOT EXISTS (
			SELECT 1
			FROM sys.indexes
			WHERE name = 'IX_server_incidents_server_id'
				AND object_id = OBJECT_ID('dbo.server_incidents')
		)
		BEGIN
			CREATE INDEX IX_server_incidents_server_id ON dbo.server_incidents(server_id);
		END
	END

	/* -----------------------------------------------------
	 * dbo.server_maintenance
	 * ---------------------------------------------------*/
	IF OBJECT_ID('dbo.server_maintenance', 'U') IS NOT NULL
	BEGIN
		-- Ensure core enum columns exist (older installs may be missing these)
		IF COL_LENGTH('dbo.server_maintenance', 'status') IS NULL
		BEGIN
			ALTER TABLE dbo.server_maintenance
				ADD status NVARCHAR(20) NOT NULL
					CONSTRAINT DF_server_maintenance_status DEFAULT ('Scheduled');
		END

		-- Ensure timestamps
		IF COL_LENGTH('dbo.server_maintenance', 'created_at') IS NULL
			ALTER TABLE dbo.server_maintenance
				ADD created_at DATETIME NOT NULL CONSTRAINT DF_server_maintenance_created_at DEFAULT (GETDATE());

		IF COL_LENGTH('dbo.server_maintenance', 'updated_at') IS NULL
			ALTER TABLE dbo.server_maintenance
				ADD updated_at DATETIME NOT NULL CONSTRAINT DF_server_maintenance_updated_at DEFAULT (GETDATE());

		-- Normalize statuses to the canonical enum
		IF COL_LENGTH('dbo.server_maintenance', 'status') IS NOT NULL
		BEGIN
			UPDATE dbo.server_maintenance
			SET status = 'InProgress'
			WHERE status IN ('Active');

			UPDATE dbo.server_maintenance
			SET status = 'Completed'
			WHERE status IN ('Complete');
		END

		-- Enforce status enum
		IF COL_LENGTH('dbo.server_maintenance', 'status') IS NOT NULL
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM dbo.server_maintenance
				WHERE status IS NOT NULL
					AND status NOT IN ('Scheduled','InProgress','Completed','Cancelled')
			)
				RAISERROR('Cannot add CK_server_maintenance_status: invalid dbo.server_maintenance.status values exist. Clean data first.', 16, 1);

			IF NOT EXISTS (
				SELECT 1
				FROM sys.check_constraints
				WHERE name = 'CK_server_maintenance_status'
					AND parent_object_id = OBJECT_ID('dbo.server_maintenance')
			)
			BEGIN
				ALTER TABLE dbo.server_maintenance WITH CHECK
					ADD CONSTRAINT CK_server_maintenance_status
					CHECK (status IN ('Scheduled','InProgress','Completed','Cancelled'));
			END
		END

		-- Ensure FK + index
		IF NOT EXISTS (
			SELECT 1
			FROM sys.foreign_keys
			WHERE name = 'FK_server_maintenance_server'
				AND parent_object_id = OBJECT_ID('dbo.server_maintenance')
		)
		BEGIN
			ALTER TABLE dbo.server_maintenance WITH CHECK
				ADD CONSTRAINT FK_server_maintenance_server
				FOREIGN KEY (server_id)
				REFERENCES dbo.servers(server_id)
				ON DELETE NO ACTION;
		END

		IF NOT EXISTS (
			SELECT 1
			FROM sys.indexes
			WHERE name = 'IX_server_maintenance_server_id'
				AND object_id = OBJECT_ID('dbo.server_maintenance')
		)
		BEGIN
			CREATE INDEX IX_server_maintenance_server_id ON dbo.server_maintenance(server_id);
		END
	END

	COMMIT TRAN;
END TRY
BEGIN CATCH
	IF @@TRANCOUNT > 0 ROLLBACK TRAN;
	THROW;
END CATCH
GO
