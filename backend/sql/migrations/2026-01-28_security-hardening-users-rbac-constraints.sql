/*
  2026-01-28 Security hardening
  - Users (username + bcrypt password_hash)
  - Roles (Admin/Engineer) + user_roles mapping
  - Key constraints/indexes/checks for stability + uniqueness

  Notes:
  - This script is written to be idempotent.
  - If dbo.Users already exists, missing columns/constraints are added.
  - password_hash is created as NULLable to avoid breaking legacy rows; backend login rejects NULL/blank hashes.
*/

SET XACT_ABORT ON;

BEGIN TRAN;

  /* USERS */
  IF OBJECT_ID('dbo.Users', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.Users (
      user_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
      username NVARCHAR(100) NOT NULL,
      password_hash NVARCHAR(200) NULL,
      full_name NVARCHAR(200) NULL,
      team_id INT NOT NULL,
      is_active BIT NOT NULL CONSTRAINT DF_Users_is_active DEFAULT (1),
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_Users_created_at DEFAULT (SYSUTCDATETIME())
    );
  END
  ELSE
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.Users')
        AND name = 'user_id'
    )
    BEGIN
      -- Add a new IDENTITY user_id column; SQL Server will populate values for existing rows.
      EXEC('ALTER TABLE dbo.Users ADD user_id INT IDENTITY(1,1) NOT NULL');

      IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'UQ_Users_user_id'
          AND object_id = OBJECT_ID('dbo.Users')
      )
      BEGIN
        EXEC('CREATE UNIQUE INDEX UQ_Users_user_id ON dbo.Users(user_id)');
      END
    END

    IF COL_LENGTH('dbo.Users', 'username') IS NULL
    BEGIN
      EXEC('ALTER TABLE dbo.Users ADD username NVARCHAR(100) NULL');
    END

    IF COL_LENGTH('dbo.Users', 'password_hash') IS NULL
      ALTER TABLE dbo.Users ADD password_hash NVARCHAR(200) NULL;

    IF COL_LENGTH('dbo.Users', 'full_name') IS NULL
      ALTER TABLE dbo.Users ADD full_name NVARCHAR(200) NULL;

    IF COL_LENGTH('dbo.Users', 'team_id') IS NULL
      ALTER TABLE dbo.Users ADD team_id INT NULL;

    IF COL_LENGTH('dbo.Users', 'is_active') IS NULL
      ALTER TABLE dbo.Users ADD is_active BIT NOT NULL CONSTRAINT DF_Users_is_active DEFAULT (1);

    IF COL_LENGTH('dbo.Users', 'created_at') IS NULL
      ALTER TABLE dbo.Users ADD created_at DATETIME2(0) NOT NULL CONSTRAINT DF_Users_created_at DEFAULT (SYSUTCDATETIME());

    -- Backfill username from legacy email column when present.
    IF COL_LENGTH('dbo.Users', 'email') IS NOT NULL
    BEGIN
      IF COL_LENGTH('dbo.Users', 'username') IS NOT NULL
      BEGIN
        EXEC('UPDATE dbo.Users SET username = COALESCE(username, LOWER(LTRIM(RTRIM(email)))) WHERE username IS NULL');
      END
    END

    -- Backfill created_at if legacy created_at exists, otherwise set now.
    IF COL_LENGTH('dbo.Users', 'created_at') IS NOT NULL
    BEGIN
      EXEC('UPDATE dbo.Users SET created_at = COALESCE(created_at, SYSUTCDATETIME()) WHERE created_at IS NULL');
    END

    -- Default is_active to 1 for NULLs
    IF COL_LENGTH('dbo.Users', 'is_active') IS NOT NULL
    BEGIN
      EXEC('UPDATE dbo.Users SET is_active = 1 WHERE is_active IS NULL');
    END
  END

  -- Unique username (allows multiple NULL usernames by keying NULLs to user_id).
  IF COL_LENGTH('dbo.Users', 'username_uq') IS NULL
  BEGIN
    IF COL_LENGTH('dbo.Users', 'user_id') IS NOT NULL AND COL_LENGTH('dbo.Users', 'username') IS NOT NULL
    BEGIN
      EXEC('ALTER TABLE dbo.Users ADD username_uq AS (CASE WHEN username IS NULL THEN ''##NULL##'' + RIGHT(''0000000000'' + CAST(user_id AS VARCHAR(10)), 10) ELSE username END) PERSISTED');
    END
  END

  IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UQ_Users_username_uq'
      AND object_id = OBJECT_ID('dbo.Users')
  )
  BEGIN
    EXEC('CREATE UNIQUE INDEX UQ_Users_username_uq ON dbo.Users(username_uq)');
  END

  /* FK: Users.team_id -> teams.team_id (if teams table exists) */
  IF OBJECT_ID('dbo.teams', 'U') IS NOT NULL
     AND COL_LENGTH('dbo.Users', 'team_id') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.Users WHERE team_id IS NULL)
     AND NOT EXISTS (
        SELECT 1
        FROM sys.foreign_keys
        WHERE name = 'FK_Users_teams'
          AND parent_object_id = OBJECT_ID('dbo.Users')
     )
  BEGIN
    ALTER TABLE dbo.Users WITH CHECK
      ADD CONSTRAINT FK_Users_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id);
  END

  /* ROLES */
  IF OBJECT_ID('dbo.roles', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.roles (
      role_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_roles PRIMARY KEY,
      role_name NVARCHAR(50) NOT NULL
    );
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_roles_role_name' AND object_id = OBJECT_ID('dbo.roles'))
  BEGIN
    EXEC('CREATE UNIQUE INDEX UQ_roles_role_name ON dbo.roles(role_name)');
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE LOWER(role_name) = 'admin')
    INSERT INTO dbo.roles(role_name) VALUES ('Admin');

  IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE LOWER(role_name) = 'engineer')
    INSERT INTO dbo.roles(role_name) VALUES ('Engineer');

  /* USER_ROLES */
  IF OBJECT_ID('dbo.user_roles', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.user_roles (
      user_id INT NOT NULL,
      role_id INT NOT NULL,
      CONSTRAINT PK_user_roles PRIMARY KEY (user_id, role_id)
    );
  END

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_user_roles_users'
      AND parent_object_id = OBJECT_ID('dbo.user_roles')
  )
    ALTER TABLE dbo.user_roles WITH CHECK
      ADD CONSTRAINT FK_user_roles_users FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id);

  IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_user_roles_roles'
      AND parent_object_id = OBJECT_ID('dbo.user_roles')
  )
    ALTER TABLE dbo.user_roles WITH CHECK
      ADD CONSTRAINT FK_user_roles_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id);

  /* UNIQUE + FILTERED UNIQUES */
  IF OBJECT_ID('dbo.servers', 'U') IS NOT NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_servers_server_code' AND object_id = OBJECT_ID('dbo.servers'))
    BEGIN
      EXEC('CREATE UNIQUE INDEX UQ_servers_server_code ON dbo.servers(server_code)');
    END

    IF COL_LENGTH('dbo.servers', 'hostname') IS NOT NULL AND COL_LENGTH('dbo.servers', 'server_id') IS NOT NULL
    BEGIN
      IF COL_LENGTH('dbo.servers', 'hostname_uq') IS NULL
      BEGIN
        EXEC('ALTER TABLE dbo.servers ADD hostname_uq AS (CASE WHEN hostname IS NULL THEN ''##NULL##'' + RIGHT(''0000000000'' + CAST(server_id AS VARCHAR(10)), 10) ELSE hostname END) PERSISTED');
      END

      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_servers_hostname_uq' AND object_id = OBJECT_ID('dbo.servers'))
      BEGIN
        IF COL_LENGTH('dbo.servers', 'team_id') IS NOT NULL
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM (
              SELECT team_id, hostname
              FROM dbo.servers
              WHERE hostname IS NOT NULL
              GROUP BY team_id, hostname
              HAVING COUNT(*) > 1
            ) d
          )
          BEGIN
            RAISERROR('Skipping UQ_servers_hostname_uq (unique) due to duplicate hostnames within a team. Clean duplicates then re-run migration.', 10, 1);
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_team_hostname_uq' AND object_id = OBJECT_ID('dbo.servers'))
              EXEC('CREATE INDEX IX_servers_team_hostname_uq ON dbo.servers(team_id, hostname_uq)');
          END
          ELSE
          BEGIN
            EXEC('CREATE UNIQUE INDEX UQ_servers_hostname_uq ON dbo.servers(team_id, hostname_uq)');
          END
        END
        ELSE
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM (
              SELECT hostname
              FROM dbo.servers
              WHERE hostname IS NOT NULL
              GROUP BY hostname
              HAVING COUNT(*) > 1
            ) d
          )
          BEGIN
            RAISERROR('Skipping UQ_servers_hostname_uq (unique) due to duplicate hostnames. Clean duplicates then re-run migration.', 10, 1);
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_hostname_uq' AND object_id = OBJECT_ID('dbo.servers'))
              EXEC('CREATE INDEX IX_servers_hostname_uq ON dbo.servers(hostname_uq)');
          END
          ELSE
          BEGIN
            EXEC('CREATE UNIQUE INDEX UQ_servers_hostname_uq ON dbo.servers(hostname_uq)');
          END
        END
      END
    END

    IF COL_LENGTH('dbo.servers', 'team_id') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servers_team_id' AND object_id = OBJECT_ID('dbo.servers'))
    BEGIN
      EXEC('CREATE INDEX IX_servers_team_id ON dbo.servers(team_id)');
    END
  END

  IF OBJECT_ID('dbo.server_network', 'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.server_network', 'ip_address') IS NOT NULL AND COL_LENGTH('dbo.server_network', 'network_id') IS NOT NULL
    BEGIN
      IF COL_LENGTH('dbo.server_network', 'ip_address_uq') IS NULL
      BEGIN
        EXEC('ALTER TABLE dbo.server_network ADD ip_address_uq AS (CASE WHEN ip_address IS NULL THEN ''##NULL##'' + RIGHT(''0000000000'' + CAST(network_id AS VARCHAR(10)), 10) ELSE ip_address END) PERSISTED');
      END

      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_server_network_ip_uq' AND object_id = OBJECT_ID('dbo.server_network'))
      BEGIN
        EXEC('CREATE UNIQUE INDEX UQ_server_network_ip_uq ON dbo.server_network(ip_address_uq)');
      END
    END

    IF COL_LENGTH('dbo.server_network', 'server_id') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_server_network_server_id' AND object_id = OBJECT_ID('dbo.server_network'))
    BEGIN
      EXEC('CREATE INDEX IX_server_network_server_id ON dbo.server_network(server_id)');
    END
  END

  /* CHECK CONSTRAINTS (0..100) */
  IF OBJECT_ID('dbo.server_monitoring', 'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.server_monitoring', 'uptime_percent') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_server_monitoring_uptime_percent')
    BEGIN
      IF EXISTS (SELECT 1 FROM dbo.server_monitoring WHERE uptime_percent IS NOT NULL AND (uptime_percent < 0 OR uptime_percent > 100))
        RAISERROR('Cannot add CK_server_monitoring_uptime_percent: existing data is out of range', 16, 1);

      ALTER TABLE dbo.server_monitoring WITH CHECK
        ADD CONSTRAINT CK_server_monitoring_uptime_percent CHECK (uptime_percent IS NULL OR (uptime_percent >= 0 AND uptime_percent <= 100));
    END

    IF COL_LENGTH('dbo.server_monitoring', 'cpu_threshold') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_server_monitoring_cpu_threshold')
    BEGIN
      IF EXISTS (SELECT 1 FROM dbo.server_monitoring WHERE cpu_threshold IS NOT NULL AND (cpu_threshold < 0 OR cpu_threshold > 100))
        RAISERROR('Cannot add CK_server_monitoring_cpu_threshold: existing data is out of range', 16, 1);

      ALTER TABLE dbo.server_monitoring WITH CHECK
        ADD CONSTRAINT CK_server_monitoring_cpu_threshold CHECK (cpu_threshold IS NULL OR (cpu_threshold >= 0 AND cpu_threshold <= 100));
    END

    IF COL_LENGTH('dbo.server_monitoring', 'ram_threshold') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_server_monitoring_ram_threshold')
    BEGIN
      IF EXISTS (SELECT 1 FROM dbo.server_monitoring WHERE ram_threshold IS NOT NULL AND (ram_threshold < 0 OR ram_threshold > 100))
        RAISERROR('Cannot add CK_server_monitoring_ram_threshold: existing data is out of range', 16, 1);

      ALTER TABLE dbo.server_monitoring WITH CHECK
        ADD CONSTRAINT CK_server_monitoring_ram_threshold CHECK (ram_threshold IS NULL OR (ram_threshold >= 0 AND ram_threshold <= 100));
    END

    IF COL_LENGTH('dbo.server_monitoring', 'disk_threshold') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_server_monitoring_disk_threshold')
    BEGIN
      IF EXISTS (SELECT 1 FROM dbo.server_monitoring WHERE disk_threshold IS NOT NULL AND (disk_threshold < 0 OR disk_threshold > 100))
        RAISERROR('Cannot add CK_server_monitoring_disk_threshold: existing data is out of range', 16, 1);

      ALTER TABLE dbo.server_monitoring WITH CHECK
        ADD CONSTRAINT CK_server_monitoring_disk_threshold CHECK (disk_threshold IS NULL OR (disk_threshold >= 0 AND disk_threshold <= 100));
    END
  END

COMMIT TRAN
