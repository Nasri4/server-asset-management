-- =====================================================
-- RBAC + TEAM SCOPE + AUDIT + ACTIVITY (IDEMPOTENT)
-- Date: 2026-02-09
-- Target: Microsoft SQL Server (MSSQL)
-- Safe to run multiple times. Does NOT delete data.
-- =====================================================

SET NOCOUNT ON;

DECLARE @sql NVARCHAR(MAX) = NULL;

BEGIN TRY
  -- NOTE: Avoid a single explicit transaction for the full migration.
  -- Some optional constraint/index creation failures can mark a transaction uncommittable (3930),
  -- which then causes unrelated later statements to fail. This script is idempotent and safe to rerun.

  -- =========================
  -- 1) TEAMS
  -- =========================
  IF OBJECT_ID('dbo.teams', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.teams (
      team_id   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_teams PRIMARY KEY,
      team_name NVARCHAR(200) NOT NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_teams_created_at DEFAULT SYSUTCDATETIME()
    );

    SET @sql = N'CREATE UNIQUE INDEX UX_teams_team_name ON dbo.teams(team_name);';
    EXEC sys.sp_executesql @sql;
  END;

  -- =========================
  -- 2) ROLES (ONLY Admin/TeamLead/Engineer required)
  -- =========================
  IF OBJECT_ID('dbo.roles', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.roles (
      role_id    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_roles PRIMARY KEY,
      role_name  NVARCHAR(100) NOT NULL,
      description NVARCHAR(500) NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_roles_created_at DEFAULT SYSUTCDATETIME()
    );

    SET @sql = N'CREATE UNIQUE INDEX UX_roles_role_name ON dbo.roles(role_name);';
    EXEC sys.sp_executesql @sql;
  END;

  -- Seed required roles (dynamic to avoid compile-time schema binding errors).
  IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL
     AND COL_LENGTH('dbo.roles', 'role_name') IS NOT NULL
  BEGIN
    SET @sql = N'
      IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE LOWER(LTRIM(RTRIM(role_name))) = ''admin'')
        INSERT INTO dbo.roles(role_name, description) VALUES (''Admin'', ''Global scope: full access across all teams'');

      IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE LOWER(LTRIM(RTRIM(role_name))) = ''teamlead'')
        INSERT INTO dbo.roles(role_name, description) VALUES (''TeamLead'', ''Team scope: manage within own team'');

      IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE LOWER(LTRIM(RTRIM(role_name))) = ''engineer'')
        INSERT INTO dbo.roles(role_name, description) VALUES (''Engineer'', ''Team scope: limited operational actions'');
    ';
    EXEC sys.sp_executesql @sql;
  END;

  -- =========================
  -- 3) USERS: ensure RBAC columns exist + FKs
  -- =========================
  IF OBJECT_ID('dbo.Users', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.Users (
      user_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
      username NVARCHAR(100) NOT NULL,
      email NVARCHAR(320) NULL,
      password_hash NVARCHAR(500) NULL,
      full_name NVARCHAR(200) NULL,
      role_id INT NULL,
      team_id INT NULL,
      is_active BIT NOT NULL CONSTRAINT DF_Users_is_active DEFAULT (1),
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_Users_created_at DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_Users_updated_at DEFAULT SYSUTCDATETIME()
    );

    SET @sql = N'CREATE UNIQUE INDEX UX_Users_username ON dbo.Users(username);';
    EXEC sys.sp_executesql @sql;
  END;

  -- Sanity checks for expected PK columns on existing schemas.
  IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL AND COL_LENGTH('dbo.Users', 'user_id') IS NULL
    RAISERROR('Expected dbo.Users.user_id to exist (INT primary key). Existing dbo.Users schema is incompatible with this migration.', 16, 1);

  IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL AND COL_LENGTH('dbo.Users', 'username') IS NULL
    RAISERROR('Expected dbo.Users.username to exist. Existing dbo.Users schema is incompatible with this migration.', 16, 1);

  IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL AND COL_LENGTH('dbo.roles', 'role_id') IS NULL
    RAISERROR('Expected dbo.roles.role_id to exist. Existing dbo.roles schema is incompatible with this migration.', 16, 1);

  IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL AND COL_LENGTH('dbo.roles', 'role_name') IS NULL
    RAISERROR('Expected dbo.roles.role_name to exist. Existing dbo.roles schema is incompatible with this migration.', 16, 1);

  IF OBJECT_ID('dbo.teams', 'U') IS NOT NULL AND COL_LENGTH('dbo.teams', 'team_id') IS NULL
    RAISERROR('Expected dbo.teams.team_id to exist. Existing dbo.teams schema is incompatible with this migration.', 16, 1);

  IF OBJECT_ID('dbo.teams', 'U') IS NOT NULL AND COL_LENGTH('dbo.teams', 'team_name') IS NULL
    RAISERROR('Expected dbo.teams.team_name to exist. Existing dbo.teams schema is incompatible with this migration.', 16, 1);

  IF COL_LENGTH('dbo.Users', 'role_id') IS NULL
    ALTER TABLE dbo.Users ADD role_id INT NULL;

  IF COL_LENGTH('dbo.Users', 'team_id') IS NULL
    ALTER TABLE dbo.Users ADD team_id INT NULL;

  IF COL_LENGTH('dbo.Users', 'is_active') IS NULL
    ALTER TABLE dbo.Users ADD is_active BIT NOT NULL CONSTRAINT DF_Users_is_active2 DEFAULT (1);

  -- Backfill legacy users missing role_id to Engineer.
  -- Without this, login can succeed (role inferred) but /auth/me fails RBAC reload and the UI appears to "logout".
  IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL
     AND OBJECT_ID('dbo.roles', 'U') IS NOT NULL
     AND COL_LENGTH('dbo.Users', 'role_id') IS NOT NULL
     AND COL_LENGTH('dbo.roles', 'role_id') IS NOT NULL
     AND COL_LENGTH('dbo.roles', 'role_name') IS NOT NULL
  BEGIN
    DECLARE @engineerRoleIdFix INT = NULL;
    SET @sql = N'SELECT @rid = (SELECT TOP 1 role_id FROM dbo.roles WHERE LOWER(LTRIM(RTRIM(role_name))) = ''engineer'');';
    BEGIN TRY
      EXEC sys.sp_executesql @sql, N'@rid INT OUTPUT', @rid = @engineerRoleIdFix OUTPUT;
    END TRY
    BEGIN CATCH
      SET @engineerRoleIdFix = NULL;
    END CATCH;

    IF @engineerRoleIdFix IS NOT NULL
    BEGIN
      SET @sql = N'UPDATE dbo.Users SET role_id = @rid WHERE role_id IS NULL;';
      BEGIN TRY
        EXEC sys.sp_executesql @sql, N'@rid INT', @rid = @engineerRoleIdFix;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not backfill dbo.Users.role_id to Engineer: ', ERROR_MESSAGE());
      END CATCH;
    END
    ELSE
    BEGIN
      PRINT 'WARNING: could not backfill dbo.Users.role_id because Engineer role_id could not be resolved.';
    END
  END;

  -- IMPORTANT: Use dynamic SQL for objects that reference columns added above.
  IF COL_LENGTH('dbo.Users', 'team_id') IS NOT NULL
     AND COL_LENGTH('dbo.Users', 'role_id') IS NOT NULL
     AND COL_LENGTH('dbo.Users', 'is_active') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE object_id = OBJECT_ID('dbo.Users')
         AND LOWER(name) = LOWER('IX_Users_team_role_active')
     )
  BEGIN
    SET @sql = N'CREATE INDEX IX_Users_team_role_active ON dbo.Users(team_id, role_id, is_active);';
    BEGIN TRY
      EXEC sys.sp_executesql @sql;
    END TRY
    BEGIN CATCH
      PRINT CONCAT('WARNING: could not create IX_Users_team_role_active: ', ERROR_MESSAGE());
    END CATCH;
  END;

  IF COL_LENGTH('dbo.Users', 'role_id') IS NOT NULL
     AND COL_LENGTH('dbo.roles', 'role_id') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE parent_object_id = OBJECT_ID('dbo.Users')
         AND LOWER(name) = LOWER('FK_Users_roles')
     )
  BEGIN
    SET @sql = N'ALTER TABLE dbo.Users WITH NOCHECK ADD CONSTRAINT FK_Users_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id);';
    BEGIN TRY
      EXEC sys.sp_executesql @sql;
    END TRY
    BEGIN CATCH
      PRINT CONCAT('WARNING: could not create FK_Users_roles: ', ERROR_MESSAGE());
    END CATCH;
  END;

  IF COL_LENGTH('dbo.Users', 'team_id') IS NOT NULL
     AND COL_LENGTH('dbo.teams', 'team_id') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.foreign_keys
       WHERE parent_object_id = OBJECT_ID('dbo.Users')
         AND LOWER(name) = LOWER('FK_Users_teams')
     )
  BEGIN
    SET @sql = N'ALTER TABLE dbo.Users WITH NOCHECK ADD CONSTRAINT FK_Users_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id);';
    BEGIN TRY
      EXEC sys.sp_executesql @sql;
    END TRY
    BEGIN CATCH
      PRINT CONCAT('WARNING: could not create FK_Users_teams: ', ERROR_MESSAGE());
    END CATCH;
  END;

  -- =========================
  -- 4) PERMISSIONS + ROLE PERMISSIONS
  -- =========================
  IF OBJECT_ID('dbo.permissions', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.permissions (
      permission_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_permissions PRIMARY KEY,
      code NVARCHAR(100) NOT NULL,
      description NVARCHAR(500) NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_permissions_created_at DEFAULT SYSUTCDATETIME()
    );

    SET @sql = N'CREATE UNIQUE INDEX UX_permissions_code ON dbo.permissions(code);';
    EXEC sys.sp_executesql @sql;
  END;

  IF OBJECT_ID('dbo.permissions', 'U') IS NOT NULL AND COL_LENGTH('dbo.permissions', 'permission_id') IS NULL
    RAISERROR('Expected dbo.permissions.permission_id to exist (INT identity primary key). Existing dbo.permissions schema is incompatible with this migration.', 16, 1);

  -- Ensure required columns exist even if dbo.permissions pre-existed.
  IF COL_LENGTH('dbo.permissions', 'code') IS NULL
    ALTER TABLE dbo.permissions ADD code NVARCHAR(100) NULL;

  IF COL_LENGTH('dbo.permissions', 'description') IS NULL
    ALTER TABLE dbo.permissions ADD description NVARCHAR(500) NULL;

  -- Back-compat: if legacy column permission_key exists, mirror into code.
  IF COL_LENGTH('dbo.permissions', 'permission_key') IS NOT NULL
  BEGIN
    SET @sql = N'
      UPDATE dbo.permissions
        SET code = permission_key
      WHERE (code IS NULL OR LTRIM(RTRIM(code)) = '''')
        AND (permission_key IS NOT NULL AND LTRIM(RTRIM(permission_key)) <> '''');
    ';
    EXEC sys.sp_executesql @sql;
  END;

  -- Backfill any remaining NULL/empty codes to a deterministic value.
  SET @sql = N'
    UPDATE dbo.permissions
      SET code = CONCAT(''LEGACY_'', permission_id)
    WHERE (code IS NULL OR LTRIM(RTRIM(code)) = '''');
  ';
  EXEC sys.sp_executesql @sql;

  -- De-duplicate codes if legacy data contains duplicates.
  SET @sql = N'
    ;WITH d AS (
      SELECT permission_id,
             code,
             rn = ROW_NUMBER() OVER (PARTITION BY code ORDER BY permission_id)
      FROM dbo.permissions
      WHERE code IS NOT NULL AND LTRIM(RTRIM(code)) <> ''''
    )
    UPDATE d
      SET code = CONCAT(''LEGACY_'', permission_id)
    WHERE rn > 1;
  ';
  EXEC sys.sp_executesql @sql;

  -- Create unique index on code if missing (dynamic to avoid parse-time column issues).
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.permissions')
      AND LOWER(name) = LOWER('UX_permissions_code')
  )
  BEGIN
    SET @sql = N'CREATE UNIQUE INDEX UX_permissions_code ON dbo.permissions(code);';
    BEGIN TRY
      EXEC sys.sp_executesql @sql;
    END TRY
    BEGIN CATCH
      PRINT CONCAT('WARNING: could not create UX_permissions_code: ', ERROR_MESSAGE());
    END CATCH;
  END;

  IF OBJECT_ID('dbo.role_permissions', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.role_permissions (
      role_permission_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_role_permissions PRIMARY KEY,
      role_id INT NOT NULL,
      permission_id INT NULL,
      permission_key NVARCHAR(100) NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_role_permissions_created_at DEFAULT SYSUTCDATETIME()
    );

    SET @sql = N'CREATE INDEX IX_role_permissions_role ON dbo.role_permissions(role_id);';
    EXEC sys.sp_executesql @sql;
  END;

  IF COL_LENGTH('dbo.role_permissions', 'permission_id') IS NULL
    ALTER TABLE dbo.role_permissions ADD permission_id INT NULL;

  IF COL_LENGTH('dbo.role_permissions', 'permission_key') IS NULL
    ALTER TABLE dbo.role_permissions ADD permission_key NVARCHAR(100) NULL;

  -- Only attempt FKs if the referenced columns are candidate keys (PK/unique).
  DECLARE @rolesRoleIdIsKey BIT = CASE
    WHEN EXISTS (
      SELECT 1
      FROM sys.indexes i
      JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE i.object_id = OBJECT_ID('dbo.roles')
        AND i.is_unique = 1
        AND c.name = 'role_id'
        AND ic.key_ordinal = 1
    ) THEN 1 ELSE 0 END;

  DECLARE @permissionsPermissionIdIsKey BIT = CASE
    WHEN EXISTS (
      SELECT 1
      FROM sys.indexes i
      JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      WHERE i.object_id = OBJECT_ID('dbo.permissions')
        AND i.is_unique = 1
        AND c.name = 'permission_id'
        AND ic.key_ordinal = 1
    ) THEN 1 ELSE 0 END;

  -- Also require type compatibility for FK creation (legacy schemas sometimes use different types).
  DECLARE @roleIdTypeCompatible BIT = CASE
    WHEN EXISTS (
      SELECT 1
      FROM sys.columns rp
      JOIN sys.columns r ON 1=1
      WHERE rp.object_id = OBJECT_ID('dbo.role_permissions') AND rp.name = 'role_id'
        AND r.object_id = OBJECT_ID('dbo.roles') AND r.name = 'role_id'
        AND rp.system_type_id = r.system_type_id
        AND rp.max_length = r.max_length
        AND rp.precision = r.precision
        AND rp.scale = r.scale
    ) THEN 1 ELSE 0 END;

  DECLARE @permissionIdTypeCompatible BIT = CASE
    WHEN EXISTS (
      SELECT 1
      FROM sys.columns rp
      JOIN sys.columns p ON 1=1
      WHERE rp.object_id = OBJECT_ID('dbo.role_permissions') AND rp.name = 'permission_id'
        AND p.object_id = OBJECT_ID('dbo.permissions') AND p.name = 'permission_id'
        AND rp.system_type_id = p.system_type_id
        AND rp.max_length = p.max_length
        AND rp.precision = p.precision
        AND rp.scale = p.scale
    ) THEN 1 ELSE 0 END;

  DECLARE @rpRoleIdType NVARCHAR(128) = NULL;
  DECLARE @rolesRoleIdType NVARCHAR(128) = NULL;
  DECLARE @rpPermissionIdType NVARCHAR(128) = NULL;
  DECLARE @permissionsPermissionIdType NVARCHAR(128) = NULL;

  -- Orphan diagnostics (common reason FK creation fails even when key + types look OK)
  DECLARE @orphanRoleCount BIGINT = 0;
  DECLARE @orphanPermissionCount BIGINT = 0;

  IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL AND OBJECT_ID('dbo.roles', 'U') IS NOT NULL
     AND COL_LENGTH('dbo.role_permissions', 'role_id') IS NOT NULL AND COL_LENGTH('dbo.roles', 'role_id') IS NOT NULL
  BEGIN
    SET @sql = N'
      SELECT @c = COUNT_BIG(*)
      FROM dbo.role_permissions rp
      LEFT JOIN dbo.roles r ON r.role_id = rp.role_id
      WHERE r.role_id IS NULL;
    ';
    BEGIN TRY
      EXEC sys.sp_executesql @sql, N'@c BIGINT OUTPUT', @c = @orphanRoleCount OUTPUT;
    END TRY
    BEGIN CATCH
      -- ignore diagnostics errors
    END CATCH;
  END;

  IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL AND OBJECT_ID('dbo.permissions', 'U') IS NOT NULL
     AND COL_LENGTH('dbo.role_permissions', 'permission_id') IS NOT NULL AND COL_LENGTH('dbo.permissions', 'permission_id') IS NOT NULL
  BEGIN
    SET @sql = N'
      SELECT @c = COUNT_BIG(*)
      FROM dbo.role_permissions rp
      LEFT JOIN dbo.permissions p ON p.permission_id = rp.permission_id
      WHERE rp.permission_id IS NOT NULL
        AND p.permission_id IS NULL;
    ';
    BEGIN TRY
      EXEC sys.sp_executesql @sql, N'@c BIGINT OUTPUT', @c = @orphanPermissionCount OUTPUT;
    END TRY
    BEGIN CATCH
      -- ignore diagnostics errors
    END CATCH;
  END;

  SELECT @rpRoleIdType =
    CONCAT(t.name,
      CASE
        WHEN t.name IN ('varchar','nvarchar','char','nchar') THEN CONCAT('(', CASE WHEN c.max_length = -1 THEN 'max'
          WHEN t.name IN ('nvarchar','nchar') THEN CAST(c.max_length/2 AS NVARCHAR(10))
          ELSE CAST(c.max_length AS NVARCHAR(10)) END, ')')
        WHEN t.name IN ('decimal','numeric') THEN CONCAT('(', CAST(c.precision AS NVARCHAR(10)), ',', CAST(c.scale AS NVARCHAR(10)), ')')
        ELSE ''
      END)
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.role_permissions') AND c.name = 'role_id';

  SELECT @rolesRoleIdType =
    CONCAT(t.name,
      CASE
        WHEN t.name IN ('varchar','nvarchar','char','nchar') THEN CONCAT('(', CASE WHEN c.max_length = -1 THEN 'max'
          WHEN t.name IN ('nvarchar','nchar') THEN CAST(c.max_length/2 AS NVARCHAR(10))
          ELSE CAST(c.max_length AS NVARCHAR(10)) END, ')')
        WHEN t.name IN ('decimal','numeric') THEN CONCAT('(', CAST(c.precision AS NVARCHAR(10)), ',', CAST(c.scale AS NVARCHAR(10)), ')')
        ELSE ''
      END)
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.roles') AND c.name = 'role_id';

  SELECT @rpPermissionIdType =
    CONCAT(t.name,
      CASE
        WHEN t.name IN ('varchar','nvarchar','char','nchar') THEN CONCAT('(', CASE WHEN c.max_length = -1 THEN 'max'
          WHEN t.name IN ('nvarchar','nchar') THEN CAST(c.max_length/2 AS NVARCHAR(10))
          ELSE CAST(c.max_length AS NVARCHAR(10)) END, ')')
        WHEN t.name IN ('decimal','numeric') THEN CONCAT('(', CAST(c.precision AS NVARCHAR(10)), ',', CAST(c.scale AS NVARCHAR(10)), ')')
        ELSE ''
      END)
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.role_permissions') AND c.name = 'permission_id';

  SELECT @permissionsPermissionIdType =
    CONCAT(t.name,
      CASE
        WHEN t.name IN ('varchar','nvarchar','char','nchar') THEN CONCAT('(', CASE WHEN c.max_length = -1 THEN 'max'
          WHEN t.name IN ('nvarchar','nchar') THEN CAST(c.max_length/2 AS NVARCHAR(10))
          ELSE CAST(c.max_length AS NVARCHAR(10)) END, ')')
        WHEN t.name IN ('decimal','numeric') THEN CONCAT('(', CAST(c.precision AS NVARCHAR(10)), ',', CAST(c.scale AS NVARCHAR(10)), ')')
        ELSE ''
      END)
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.permissions') AND c.name = 'permission_id';

  -- Constraints via dynamic SQL (columns may have been added above).
  IF COL_LENGTH('dbo.role_permissions', 'role_id') IS NOT NULL
     AND COL_LENGTH('dbo.roles', 'role_id') IS NOT NULL
      AND @rolesRoleIdIsKey = 1
      AND @roleIdTypeCompatible = 1
      AND @orphanRoleCount = 0
     AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys
       WHERE parent_object_id = OBJECT_ID('dbo.role_permissions')
         AND LOWER(name) = LOWER('FK_role_permissions_roles')
     )
  BEGIN
    -- Keep FK non-cascading for maximum compatibility with legacy schemas.
    SET @sql = N'ALTER TABLE dbo.role_permissions WITH NOCHECK ADD CONSTRAINT FK_role_permissions_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id);';
    BEGIN TRY
      EXEC sys.sp_executesql @sql;
    END TRY
    BEGIN CATCH
      PRINT CONCAT('WARNING: could not create FK_role_permissions_roles (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
    END CATCH;
  END;

  IF @rolesRoleIdIsKey = 0
    PRINT 'WARNING: skipping FK_role_permissions_roles because dbo.roles.role_id is not a PK/unique key in this database.';

  IF @rolesRoleIdIsKey = 1 AND @roleIdTypeCompatible = 0
    PRINT CONCAT('WARNING: skipping FK_role_permissions_roles because role_permissions.role_id type (', ISNULL(@rpRoleIdType,'<unknown>'), ') is not compatible with roles.role_id type (', ISNULL(@rolesRoleIdType,'<unknown>'), ').');

  IF @rolesRoleIdIsKey = 1 AND @roleIdTypeCompatible = 1 AND @orphanRoleCount > 0
    PRINT CONCAT('WARNING: skipping FK_role_permissions_roles because ', @orphanRoleCount, ' dbo.role_permissions rows have role_id with no matching dbo.roles.role_id.');

  IF COL_LENGTH('dbo.role_permissions', 'permission_id') IS NOT NULL
     AND COL_LENGTH('dbo.permissions', 'permission_id') IS NOT NULL
      AND @permissionsPermissionIdIsKey = 1
      AND @permissionIdTypeCompatible = 1
      AND @orphanPermissionCount = 0
     AND NOT EXISTS (
       SELECT 1 FROM sys.foreign_keys
       WHERE parent_object_id = OBJECT_ID('dbo.role_permissions')
         AND LOWER(name) = LOWER('FK_role_permissions_permissions')
     )
  BEGIN
    -- Keep FK non-cascading for maximum compatibility with legacy schemas.
    SET @sql = N'ALTER TABLE dbo.role_permissions WITH NOCHECK ADD CONSTRAINT FK_role_permissions_permissions FOREIGN KEY (permission_id) REFERENCES dbo.permissions(permission_id);';
    BEGIN TRY
      EXEC sys.sp_executesql @sql;
    END TRY
    BEGIN CATCH
      PRINT CONCAT('WARNING: could not create FK_role_permissions_permissions (', ERROR_NUMBER(), '): ', ERROR_MESSAGE());
    END CATCH;
  END;

  IF @permissionsPermissionIdIsKey = 0
    PRINT 'WARNING: skipping FK_role_permissions_permissions because dbo.permissions.permission_id is not a PK/unique key in this database.';

  IF @permissionsPermissionIdIsKey = 1 AND @permissionIdTypeCompatible = 0
    PRINT CONCAT('WARNING: skipping FK_role_permissions_permissions because role_permissions.permission_id type (', ISNULL(@rpPermissionIdType,'<unknown>'), ') is not compatible with permissions.permission_id type (', ISNULL(@permissionsPermissionIdType,'<unknown>'), ').');

  IF @permissionsPermissionIdIsKey = 1 AND @permissionIdTypeCompatible = 1 AND @orphanPermissionCount > 0
    PRINT CONCAT('WARNING: skipping FK_role_permissions_permissions because ', @orphanPermissionCount, ' dbo.role_permissions rows have permission_id with no matching dbo.permissions.permission_id.');

  -- De-duplicate role_permissions so the unique index can be created safely.
  IF COL_LENGTH('dbo.role_permissions', 'role_permission_id') IS NOT NULL
     AND COL_LENGTH('dbo.role_permissions', 'role_id') IS NOT NULL
     AND COL_LENGTH('dbo.role_permissions', 'permission_id') IS NOT NULL
  BEGIN
    SET @sql = N'
      ;WITH d AS (
        SELECT role_permission_id,
               rn = ROW_NUMBER() OVER (PARTITION BY role_id, permission_id ORDER BY role_permission_id)
        FROM dbo.role_permissions
        WHERE permission_id IS NOT NULL
      )
      DELETE FROM d WHERE rn > 1;
    ';
    BEGIN TRY
      EXEC sys.sp_executesql @sql;
    END TRY
    BEGIN CATCH
      PRINT CONCAT('WARNING: could not deduplicate dbo.role_permissions: ', ERROR_MESSAGE());
    END CATCH;
  END;

  -- Unique mapping (role_id + permission_id) where permission_id present
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE LOWER(name) = LOWER('UX_role_permissions_role_permission_id') AND object_id = OBJECT_ID('dbo.role_permissions')
  )
  BEGIN
    SET @sql = N'CREATE UNIQUE INDEX UX_role_permissions_role_permission_id ON dbo.role_permissions(role_id, permission_id) WHERE permission_id IS NOT NULL;';
    BEGIN TRY
      EXEC sys.sp_executesql @sql;
    END TRY
    BEGIN CATCH
      PRINT CONCAT('WARNING: could not create UX_role_permissions_role_permission_id: ', ERROR_MESSAGE());
    END CATCH;
  END;

  -- Backfill permission_id from permission_key/code if needed
  SET @sql = N'
    UPDATE rp
      SET rp.permission_id = p.permission_id
    FROM dbo.role_permissions rp
    JOIN dbo.permissions p
      ON p.code = rp.permission_key
    WHERE rp.permission_id IS NULL
      AND rp.permission_key IS NOT NULL;
  ';
  BEGIN TRY
    EXEC sys.sp_executesql @sql;
  END TRY
  BEGIN CATCH
    PRINT CONCAT('WARNING: could not backfill role_permissions.permission_id: ', ERROR_MESSAGE());
  END CATCH;

  -- =========================
  -- 5) REQUIRED PERMISSION CODES (exact)
  -- =========================
  IF OBJECT_ID('tempdb..#perm', 'U') IS NOT NULL DROP TABLE #perm;
  CREATE TABLE #perm (code NVARCHAR(100) NOT NULL, description NVARCHAR(500) NULL);

  INSERT INTO #perm(code, description) VALUES
    -- SERVERS
    ('SERVER_VIEW', 'View servers'),
    ('SERVER_CREATE', 'Create servers'),
    ('SERVER_UPDATE', 'Update servers'),
    ('SERVER_DELETE', 'Delete servers'),
    ('SERVER_NOTES_UPDATE', 'Update server notes (field-level)'),
    ('SERVER_STATUS_UPDATE', 'Update server status (field-level)'),

    -- MAINTENANCE
    ('MAINTENANCE_VIEW', 'View maintenance'),
    ('MAINTENANCE_CREATE', 'Create maintenance requests'),
    ('MAINTENANCE_UPDATE', 'Update maintenance'),
    ('MAINTENANCE_APPROVE', 'Approve maintenance'),
    ('MAINTENANCE_CLOSE', 'Close maintenance'),

    -- USERS
    ('USER_VIEW', 'View users'),
    ('USER_CREATE_ENGINEER', 'Create engineer users in team'),
    ('USER_UPDATE', 'Update user profile/role/team (as allowed)'),
    ('USER_DISABLE', 'Disable users'),

    -- LOGS
    ('AUDIT_VIEW', 'View audit logs'),
    ('ACTIVITY_VIEW', 'View activity feed');

  -- Legacy permission keys used by the existing app (kept for compatibility)
  INSERT INTO #perm(code, description) VALUES
    ('servers.read', 'Legacy: View servers'),
    ('servers.create', 'Legacy: Create servers'),
    ('servers.update', 'Legacy: Update servers'),
    ('servers.delete', 'Legacy: Delete servers'),
    ('hardware.read', 'Legacy: View hardware'),
    ('hardware.upsert', 'Legacy: Upsert hardware'),
    ('network.read', 'Legacy: View network'),
    ('network.assign_ip', 'Legacy: Assign IP'),
    ('applications.read', 'Legacy: View applications'),
    ('applications.manage', 'Legacy: Manage applications'),
    ('server_applications.manage', 'Legacy: Manage server applications'),
    ('security.read', 'Legacy: View security'),
    ('security.manage', 'Legacy: Manage security'),
    ('monitoring.read', 'Legacy: View monitoring'),
    ('monitoring.update', 'Legacy: Update monitoring'),
    ('maintenance.read', 'Legacy: View maintenance'),
    ('maintenance.manage', 'Legacy: Manage maintenance'),
    ('visits.read', 'Legacy: View visits'),
    ('visits.manage', 'Legacy: Manage visits'),
    ('incidents.read', 'Legacy: View incidents'),
    ('incidents.create', 'Legacy: Create incidents'),
    ('incidents.update', 'Legacy: Update incidents'),
    ('incidents.resolve', 'Legacy: Resolve incidents'),
    ('teams.read', 'Legacy: View teams'),
    ('teams.manage', 'Legacy: Manage teams/users'),
    ('locations.read', 'Legacy: View locations'),
    ('locations.manage', 'Legacy: Manage locations'),
    ('racks.read', 'Legacy: View racks'),
    ('racks.manage', 'Legacy: Manage racks'),
    ('audit.read', 'Legacy: View legacy audit');

  -- Backfill + Seed permissions across legacy schema variants.
  -- Some older databases have extra NOT NULL columns on dbo.permissions (e.g. permission_key, permission_name, category).
  -- Build a dynamic INSERT including those columns when present.
  DECLARE @permCols NVARCHAR(MAX) = N'code, description';
  DECLARE @permSelect NVARCHAR(MAX) = N'p.code, p.description';
  DECLARE @permExists NVARCHAR(MAX) = N'(x.code = p.code)';

  IF COL_LENGTH('dbo.permissions', 'permission_key') IS NOT NULL
  BEGIN
    SET @sql = N'
      UPDATE dbo.permissions
        SET permission_key = code
      WHERE (permission_key IS NULL OR LTRIM(RTRIM(permission_key)) = '''')
        AND (code IS NOT NULL AND LTRIM(RTRIM(code)) <> '''');
    ';
    EXEC sys.sp_executesql @sql;

    SET @permCols += N', permission_key';
    SET @permSelect += N', p.code';
    SET @permExists += N' OR (x.permission_key = p.code)';
  END;

  IF COL_LENGTH('dbo.permissions', 'permission_name') IS NOT NULL
  BEGIN
    SET @sql = N'
      UPDATE dbo.permissions
        SET permission_name = code
      WHERE (permission_name IS NULL OR LTRIM(RTRIM(permission_name)) = '''')
        AND (code IS NOT NULL AND LTRIM(RTRIM(code)) <> '''');
    ';
    EXEC sys.sp_executesql @sql;

    SET @permCols += N', permission_name';
    SET @permSelect += N', p.code';
    SET @permExists += N' OR (x.permission_name = p.code)';
  END;

  IF COL_LENGTH('dbo.permissions', 'category') IS NOT NULL
  BEGIN
    -- Ensure existing rows have a non-null category when the column is present.
    SET @sql = N'
      UPDATE dbo.permissions
        SET category = CASE
          WHEN code LIKE ''SERVER_%'' OR code LIKE ''servers.%'' THEN ''SERVERS''
          WHEN code LIKE ''MAINTENANCE_%'' OR code LIKE ''maintenance.%'' THEN ''MAINTENANCE''
          WHEN code LIKE ''USER_%'' OR code LIKE ''teams.%'' THEN ''USERS''
          WHEN code LIKE ''AUDIT_%'' OR code LIKE ''ACTIVITY_%'' OR code LIKE ''audit.%'' THEN ''LOGS''
          WHEN code LIKE ''hardware.%'' THEN ''HARDWARE''
          WHEN code LIKE ''network.%'' THEN ''NETWORK''
          WHEN code LIKE ''applications.%'' OR code LIKE ''server_applications.%'' THEN ''APPLICATIONS''
          WHEN code LIKE ''security.%'' THEN ''SECURITY''
          WHEN code LIKE ''monitoring.%'' THEN ''MONITORING''
          WHEN code LIKE ''visits.%'' THEN ''VISITS''
          WHEN code LIKE ''incidents.%'' THEN ''INCIDENTS''
          WHEN code LIKE ''locations.%'' THEN ''LOCATIONS''
          WHEN code LIKE ''racks.%'' THEN ''RACKS''
          ELSE ''LEGACY''
        END
      WHERE (category IS NULL OR LTRIM(RTRIM(category)) = '''')
        AND (code IS NOT NULL AND LTRIM(RTRIM(code)) <> '''');
    ';
    EXEC sys.sp_executesql @sql;

    SET @permCols += N', category';
    SET @permSelect += N', CASE
      WHEN p.code LIKE ''SERVER_%'' OR p.code LIKE ''servers.%'' THEN ''SERVERS''
      WHEN p.code LIKE ''MAINTENANCE_%'' OR p.code LIKE ''maintenance.%'' THEN ''MAINTENANCE''
      WHEN p.code LIKE ''USER_%'' OR p.code LIKE ''teams.%'' THEN ''USERS''
      WHEN p.code LIKE ''AUDIT_%'' OR p.code LIKE ''ACTIVITY_%'' OR p.code LIKE ''audit.%'' THEN ''LOGS''
      WHEN p.code LIKE ''hardware.%'' THEN ''HARDWARE''
      WHEN p.code LIKE ''network.%'' THEN ''NETWORK''
      WHEN p.code LIKE ''applications.%'' OR p.code LIKE ''server_applications.%'' THEN ''APPLICATIONS''
      WHEN p.code LIKE ''security.%'' THEN ''SECURITY''
      WHEN p.code LIKE ''monitoring.%'' THEN ''MONITORING''
      WHEN p.code LIKE ''visits.%'' THEN ''VISITS''
      WHEN p.code LIKE ''incidents.%'' THEN ''INCIDENTS''
      WHEN p.code LIKE ''locations.%'' THEN ''LOCATIONS''
      WHEN p.code LIKE ''racks.%'' THEN ''RACKS''
      ELSE ''LEGACY''
    END';
    SET @permExists += N' OR (x.category IS NOT NULL AND x.category <> '''' AND x.code = p.code)';
  END;

  SET @sql = N'
    INSERT INTO dbo.permissions(' + @permCols + N')
    SELECT ' + @permSelect + N'
    FROM #perm p
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.permissions x
      WHERE ' + @permExists + N'
    );
  ';
  EXEC sys.sp_executesql @sql;

  -- =========================
  -- 6) ROLE -> PERMISSION MAPPINGS (exact rules)
  -- =========================
  DECLARE @adminRoleId INT = NULL;
  DECLARE @teamLeadRoleId INT = NULL;
  DECLARE @engineerRoleId INT = NULL;

  IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL
     AND COL_LENGTH('dbo.roles', 'role_id') IS NOT NULL
     AND COL_LENGTH('dbo.roles', 'role_name') IS NOT NULL
  BEGIN
    SET @sql = N'
      SELECT @admin = (SELECT TOP 1 role_id FROM dbo.roles WHERE LOWER(role_name) = ''admin'');
      SELECT @teamlead = (SELECT TOP 1 role_id FROM dbo.roles WHERE LOWER(role_name) = ''teamlead'');
      SELECT @engineer = (SELECT TOP 1 role_id FROM dbo.roles WHERE LOWER(role_name) = ''engineer'');
    ';
    EXEC sys.sp_executesql
      @sql,
      N'@admin INT OUTPUT, @teamlead INT OUTPUT, @engineer INT OUTPUT',
      @admin = @adminRoleId OUTPUT,
      @teamlead = @teamLeadRoleId OUTPUT,
      @engineer = @engineerRoleId OUTPUT;
  END;

  -- Admin: all permissions in dbo.permissions
  SET @sql = N'
    INSERT INTO dbo.role_permissions(role_id, permission_id, permission_key)
    SELECT @roleId, p.permission_id, p.code
    FROM dbo.permissions p
    WHERE @roleId IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM dbo.role_permissions rp
        WHERE rp.role_id = @roleId AND rp.permission_id = p.permission_id
      );
  ';
  EXEC sys.sp_executesql @sql, N'@roleId INT', @roleId = @adminRoleId;

  -- TeamLead: all server + all maintenance + team-only users + team logs view
  SET @sql = N'
    INSERT INTO dbo.role_permissions(role_id, permission_id, permission_key)
    SELECT @roleId, p.permission_id, p.code
    FROM dbo.permissions p
    WHERE @roleId IS NOT NULL
      AND p.code IN (
        ''SERVER_VIEW'',''SERVER_CREATE'',''SERVER_UPDATE'',''SERVER_DELETE'',
        ''MAINTENANCE_VIEW'',''MAINTENANCE_CREATE'',''MAINTENANCE_UPDATE'',''MAINTENANCE_APPROVE'',''MAINTENANCE_CLOSE'',
        ''USER_VIEW'',''USER_CREATE_ENGINEER'',''USER_UPDATE'',''USER_DISABLE'',
        ''AUDIT_VIEW'',''ACTIVITY_VIEW''
      )
      AND NOT EXISTS (
        SELECT 1 FROM dbo.role_permissions rp
        WHERE rp.role_id = @roleId AND rp.permission_id = p.permission_id
      );
  ';
  EXEC sys.sp_executesql @sql, N'@roleId INT', @roleId = @teamLeadRoleId;

  -- Engineer: view + maintenance create/update + limited server updates (notes/status) + activity view
  SET @sql = N'
    INSERT INTO dbo.role_permissions(role_id, permission_id, permission_key)
    SELECT @roleId, p.permission_id, p.code
    FROM dbo.permissions p
    WHERE @roleId IS NOT NULL
      AND p.code IN (
        ''SERVER_VIEW'',
        ''SERVER_NOTES_UPDATE'',''SERVER_STATUS_UPDATE'',
        ''MAINTENANCE_VIEW'',''MAINTENANCE_CREATE'',''MAINTENANCE_UPDATE'',
        ''ACTIVITY_VIEW''
      )
      AND NOT EXISTS (
        SELECT 1 FROM dbo.role_permissions rp
        WHERE rp.role_id = @roleId AND rp.permission_id = p.permission_id
      );
  ';
  EXEC sys.sp_executesql @sql, N'@roleId INT', @roleId = @engineerRoleId;

  -- Legacy mappings for compatibility with existing UI/middleware
  -- TeamLead legacy keys (mirrors backend/src/rbac/permissions.ts)
  SET @sql = N'
    INSERT INTO dbo.role_permissions(role_id, permission_id, permission_key)
    SELECT @roleId, p.permission_id, p.code
    FROM dbo.permissions p
    WHERE @roleId IS NOT NULL
      AND p.code IN (
        ''servers.read'',''servers.create'',''servers.update'',
        ''hardware.read'',''network.read'',''monitoring.read'',
        ''maintenance.read'',''maintenance.manage'',
        ''visits.read'',''visits.manage'',
        ''incidents.read'',''incidents.create'',''incidents.update'',
        ''teams.read'',''teams.manage'',
        ''audit.read''
      )
      AND NOT EXISTS (
        SELECT 1 FROM dbo.role_permissions rp
        WHERE rp.role_id = @roleId AND rp.permission_id = p.permission_id
      );
  ';
  EXEC sys.sp_executesql @sql, N'@roleId INT', @roleId = @teamLeadRoleId;

  -- Engineer legacy keys
  SET @sql = N'
    INSERT INTO dbo.role_permissions(role_id, permission_id, permission_key)
    SELECT @roleId, p.permission_id, p.code
    FROM dbo.permissions p
    WHERE @roleId IS NOT NULL
      AND p.code IN (
        ''servers.read'',
        ''hardware.read'',
        ''network.read'',
        ''monitoring.read'',
        ''maintenance.read'',
        ''visits.read'',''visits.manage'',
        ''incidents.read'',''incidents.create''
      )
      AND NOT EXISTS (
        SELECT 1 FROM dbo.role_permissions rp
        WHERE rp.role_id = @roleId AND rp.permission_id = p.permission_id
      );
  ';
  EXEC sys.sp_executesql @sql, N'@roleId INT', @roleId = @engineerRoleId;

  -- =========================
  -- 7) SERVERS: ensure team ownership
  -- =========================
  IF OBJECT_ID('dbo.servers', 'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.servers', 'team_id') IS NULL
      ALTER TABLE dbo.servers ADD team_id INT NULL;

    IF COL_LENGTH('dbo.servers', 'team_id') IS NOT NULL
       AND COL_LENGTH('dbo.servers', 'server_id') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM sys.indexes
         WHERE object_id = OBJECT_ID('dbo.servers')
           AND LOWER(name) = LOWER('IX_servers_team_id')
       )
    BEGIN
      SET @sql = N'CREATE INDEX IX_servers_team_id ON dbo.servers(team_id, server_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create IX_servers_team_id: ', ERROR_MESSAGE());
      END CATCH;
    END;

    IF COL_LENGTH('dbo.servers', 'team_id') IS NOT NULL
       AND COL_LENGTH('dbo.teams', 'team_id') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM sys.foreign_keys
         WHERE parent_object_id = OBJECT_ID('dbo.servers')
           AND LOWER(name) = LOWER('FK_servers_teams')
       )
    BEGIN
      SET @sql = N'ALTER TABLE dbo.servers WITH NOCHECK ADD CONSTRAINT FK_servers_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create FK_servers_teams: ', ERROR_MESSAGE());
      END CATCH;
    END;

    -- Optional: server notes
    IF COL_LENGTH('dbo.servers', 'notes') IS NULL
      ALTER TABLE dbo.servers ADD notes NVARCHAR(MAX) NULL;

    -- status_override referenced by V2 status engine
    IF COL_LENGTH('dbo.servers', 'status_override') IS NULL
      ALTER TABLE dbo.servers ADD status_override NVARCHAR(50) NULL;
  END;

  -- =========================
  -- 8) MAINTENANCE: ensure team_id on maintenance
  -- =========================
  IF OBJECT_ID('dbo.server_maintenance', 'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.server_maintenance', 'team_id') IS NULL
      ALTER TABLE dbo.server_maintenance ADD team_id INT NULL;

    IF COL_LENGTH('dbo.server_maintenance', 'created_by_user_id') IS NULL
      ALTER TABLE dbo.server_maintenance ADD created_by_user_id INT NULL;

    IF COL_LENGTH('dbo.server_maintenance', 'assigned_to_user_id') IS NULL
      ALTER TABLE dbo.server_maintenance ADD assigned_to_user_id INT NULL;

    IF COL_LENGTH('dbo.server_maintenance', 'approved_by_user_id') IS NULL
      ALTER TABLE dbo.server_maintenance ADD approved_by_user_id INT NULL;

    IF COL_LENGTH('dbo.server_maintenance', 'approved_at') IS NULL
      ALTER TABLE dbo.server_maintenance ADD approved_at DATETIME2(0) NULL;

    IF COL_LENGTH('dbo.server_maintenance', 'closed_by_user_id') IS NULL
      ALTER TABLE dbo.server_maintenance ADD closed_by_user_id INT NULL;

    IF COL_LENGTH('dbo.server_maintenance', 'closed_at') IS NULL
      ALTER TABLE dbo.server_maintenance ADD closed_at DATETIME2(0) NULL;

    -- Backfill from servers ownership (only if join columns exist)
    IF COL_LENGTH('dbo.server_maintenance', 'team_id') IS NOT NULL
       AND COL_LENGTH('dbo.server_maintenance', 'server_id') IS NOT NULL
       AND COL_LENGTH('dbo.servers', 'server_id') IS NOT NULL
       AND COL_LENGTH('dbo.servers', 'team_id') IS NOT NULL
    BEGIN
      SET @sql = N'
        UPDATE m
          SET m.team_id = s.team_id
        FROM dbo.server_maintenance m
        JOIN dbo.servers s ON s.server_id = m.server_id
        WHERE m.team_id IS NULL;
      ';
      EXEC sys.sp_executesql @sql;
    END;

    IF COL_LENGTH('dbo.server_maintenance', 'team_id') IS NOT NULL
       AND COL_LENGTH('dbo.server_maintenance', 'server_id') IS NOT NULL
       AND COL_LENGTH('dbo.server_maintenance', 'maintenance_id') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM sys.indexes
         WHERE object_id = OBJECT_ID('dbo.server_maintenance')
           AND LOWER(name) = LOWER('IX_server_maintenance_team_server')
       )
    BEGIN
      SET @sql = N'CREATE INDEX IX_server_maintenance_team_server ON dbo.server_maintenance(team_id, server_id, maintenance_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create IX_server_maintenance_team_server: ', ERROR_MESSAGE());
      END CATCH;
    END;

    IF COL_LENGTH('dbo.server_maintenance', 'team_id') IS NOT NULL
       AND COL_LENGTH('dbo.teams', 'team_id') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM sys.foreign_keys
         WHERE parent_object_id = OBJECT_ID('dbo.server_maintenance')
           AND LOWER(name) = LOWER('FK_server_maintenance_teams')
       )
    BEGIN
      SET @sql = N'ALTER TABLE dbo.server_maintenance WITH NOCHECK ADD CONSTRAINT FK_server_maintenance_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create FK_server_maintenance_teams: ', ERROR_MESSAGE());
      END CATCH;
    END;

    IF COL_LENGTH('dbo.server_maintenance', 'created_by_user_id') IS NOT NULL
       AND COL_LENGTH('dbo.Users', 'user_id') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM sys.foreign_keys
         WHERE parent_object_id = OBJECT_ID('dbo.server_maintenance')
           AND LOWER(name) = LOWER('FK_server_maintenance_created_by')
       )
    BEGIN
      SET @sql = N'ALTER TABLE dbo.server_maintenance WITH NOCHECK ADD CONSTRAINT FK_server_maintenance_created_by FOREIGN KEY (created_by_user_id) REFERENCES dbo.Users(user_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create FK_server_maintenance_created_by: ', ERROR_MESSAGE());
      END CATCH;
    END;

    IF COL_LENGTH('dbo.server_maintenance', 'assigned_to_user_id') IS NOT NULL
       AND COL_LENGTH('dbo.Users', 'user_id') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM sys.foreign_keys
         WHERE parent_object_id = OBJECT_ID('dbo.server_maintenance')
           AND LOWER(name) = LOWER('FK_server_maintenance_assigned_to')
       )
    BEGIN
      SET @sql = N'ALTER TABLE dbo.server_maintenance WITH NOCHECK ADD CONSTRAINT FK_server_maintenance_assigned_to FOREIGN KEY (assigned_to_user_id) REFERENCES dbo.Users(user_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create FK_server_maintenance_assigned_to: ', ERROR_MESSAGE());
      END CATCH;
    END;

    IF COL_LENGTH('dbo.server_maintenance', 'approved_by_user_id') IS NOT NULL
       AND COL_LENGTH('dbo.Users', 'user_id') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM sys.foreign_keys
         WHERE parent_object_id = OBJECT_ID('dbo.server_maintenance')
           AND LOWER(name) = LOWER('FK_server_maintenance_approved_by')
       )
    BEGIN
      SET @sql = N'ALTER TABLE dbo.server_maintenance WITH NOCHECK ADD CONSTRAINT FK_server_maintenance_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES dbo.Users(user_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create FK_server_maintenance_approved_by: ', ERROR_MESSAGE());
      END CATCH;
    END;

    IF COL_LENGTH('dbo.server_maintenance', 'closed_by_user_id') IS NOT NULL
       AND COL_LENGTH('dbo.Users', 'user_id') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM sys.foreign_keys
         WHERE parent_object_id = OBJECT_ID('dbo.server_maintenance')
           AND LOWER(name) = LOWER('FK_server_maintenance_closed_by')
       )
    BEGIN
      SET @sql = N'ALTER TABLE dbo.server_maintenance WITH NOCHECK ADD CONSTRAINT FK_server_maintenance_closed_by FOREIGN KEY (closed_by_user_id) REFERENCES dbo.Users(user_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create FK_server_maintenance_closed_by: ', ERROR_MESSAGE());
      END CATCH;
    END;
  END;

  -- =========================
  -- 9) AUDIT LOGS (formal, immutable)
  -- =========================
  IF OBJECT_ID('dbo.AuditLogs', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.AuditLogs (
      audit_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AuditLogs PRIMARY KEY,
      actor_user_id INT NOT NULL,
      action NVARCHAR(100) NOT NULL,
      entity_type NVARCHAR(50) NOT NULL,
      entity_id NVARCHAR(100) NOT NULL,
      team_id INT NULL,
      before_json NVARCHAR(MAX) NULL,
      after_json NVARCHAR(MAX) NULL,
      ip_address NVARCHAR(50) NULL,
      user_agent NVARCHAR(500) NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_AuditLogs_created_at DEFAULT SYSUTCDATETIME()
    );

    SET @sql = N'CREATE INDEX IX_AuditLogs_entity ON dbo.AuditLogs(entity_type, entity_id, created_at DESC);';
    EXEC sys.sp_executesql @sql;
    SET @sql = N'CREATE INDEX IX_AuditLogs_team_created ON dbo.AuditLogs(team_id, created_at DESC);';
    EXEC sys.sp_executesql @sql;
    SET @sql = N'CREATE INDEX IX_AuditLogs_actor_created ON dbo.AuditLogs(actor_user_id, created_at DESC);';
    EXEC sys.sp_executesql @sql;

    IF COL_LENGTH('dbo.Users', 'user_id') IS NOT NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.AuditLogs ADD CONSTRAINT FK_AuditLogs_actor FOREIGN KEY (actor_user_id) REFERENCES dbo.Users(user_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create FK_AuditLogs_actor: ', ERROR_MESSAGE());
      END CATCH;
    END;

    IF COL_LENGTH('dbo.teams', 'team_id') IS NOT NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.AuditLogs ADD CONSTRAINT FK_AuditLogs_team FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create FK_AuditLogs_team: ', ERROR_MESSAGE());
      END CATCH;
    END;
  END;

  -- =========================
  -- 10) ACTIVITIES (UI feed)
  -- =========================
  IF OBJECT_ID('dbo.Activities', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.Activities (
      activity_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Activities PRIMARY KEY,
      team_id INT NULL,
      actor_user_id INT NULL,
      message NVARCHAR(500) NOT NULL,
      entity_type NVARCHAR(50) NOT NULL,
      entity_id NVARCHAR(100) NOT NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_Activities_created_at DEFAULT SYSUTCDATETIME()
    );

    SET @sql = N'CREATE INDEX IX_Activities_entity ON dbo.Activities(entity_type, entity_id, created_at DESC);';
    EXEC sys.sp_executesql @sql;
    SET @sql = N'CREATE INDEX IX_Activities_team_created ON dbo.Activities(team_id, created_at DESC);';
    EXEC sys.sp_executesql @sql;

    IF COL_LENGTH('dbo.teams', 'team_id') IS NOT NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.Activities ADD CONSTRAINT FK_Activities_team FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create FK_Activities_team: ', ERROR_MESSAGE());
      END CATCH;
    END;

    IF COL_LENGTH('dbo.Users', 'user_id') IS NOT NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.Activities ADD CONSTRAINT FK_Activities_actor FOREIGN KEY (actor_user_id) REFERENCES dbo.Users(user_id);';
      BEGIN TRY
        EXEC sys.sp_executesql @sql;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not create FK_Activities_actor: ', ERROR_MESSAGE());
      END CATCH;
    END;
  END;

  -- Ensure newer columns exist for richer server activity UI.
  IF OBJECT_ID('dbo.Activities', 'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH('dbo.Activities', 'server_id') IS NULL
    BEGIN
      BEGIN TRY
        ALTER TABLE dbo.Activities ADD server_id INT NULL;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not add Activities.server_id: ', ERROR_MESSAGE());
      END CATCH;
    END;

    IF COL_LENGTH('dbo.Activities', 'action') IS NULL
    BEGIN
      BEGIN TRY
        ALTER TABLE dbo.Activities ADD action NVARCHAR(50) NULL;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not add Activities.action: ', ERROR_MESSAGE());
      END CATCH;
    END;

    IF COL_LENGTH('dbo.Activities', 'meta_json') IS NULL
    BEGIN
      BEGIN TRY
        ALTER TABLE dbo.Activities ADD meta_json NVARCHAR(MAX) NULL;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not add Activities.meta_json: ', ERROR_MESSAGE());
      END CATCH;
    END;

    -- Backfill server_id for existing activities when possible.
    IF COL_LENGTH('dbo.Activities', 'server_id') IS NOT NULL
    BEGIN
      BEGIN TRY
        UPDATE dbo.Activities
        SET server_id = TRY_CONVERT(INT, entity_id)
        WHERE server_id IS NULL
          AND entity_type = 'Server'
          AND TRY_CONVERT(INT, entity_id) IS NOT NULL;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not backfill Activities.server_id for Server: ', ERROR_MESSAGE());
      END CATCH;

      BEGIN TRY
        IF OBJECT_ID('dbo.server_maintenance', 'U') IS NOT NULL
        BEGIN
          UPDATE a
          SET a.server_id = m.server_id
          FROM dbo.Activities a
          JOIN dbo.server_maintenance m
            ON a.entity_type = 'Maintenance'
            AND TRY_CONVERT(INT, a.entity_id) = m.maintenance_id
          WHERE a.server_id IS NULL;
        END;
      END TRY
      BEGIN CATCH
        PRINT CONCAT('WARNING: could not backfill Activities.server_id for Maintenance: ', ERROR_MESSAGE());
      END CATCH;
    END;
  END;

  -- End of migration
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;

  DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
  DECLARE @line INT = ERROR_LINE();
  DECLARE @proc NVARCHAR(200) = ERROR_PROCEDURE();
  DECLARE @procName NVARCHAR(200) = ISNULL(@proc, '<batch>');

  IF @sql IS NOT NULL AND LTRIM(RTRIM(@sql)) <> ''
    PRINT CONCAT('Last dynamic SQL: ', @sql);

  -- NOTE: RAISERROR argument placeholders require variables/constants (no expressions)
  RAISERROR('RBAC/Audit/Activity migration failed at line %d in %s: %s', 16, 1, @line, @procName, @msg);
END CATCH;
