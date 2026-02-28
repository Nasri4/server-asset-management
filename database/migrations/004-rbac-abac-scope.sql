IF OBJECT_ID('dbo.roles_permissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.roles_permissions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        role_id INT NOT NULL,
        module NVARCHAR(100) NOT NULL,
        can_create BIT NOT NULL CONSTRAINT DF_roles_permissions_can_create DEFAULT 0,
        can_read BIT NOT NULL CONSTRAINT DF_roles_permissions_can_read DEFAULT 0,
        can_update BIT NOT NULL CONSTRAINT DF_roles_permissions_can_update DEFAULT 0,
        can_delete BIT NOT NULL CONSTRAINT DF_roles_permissions_can_delete DEFAULT 0,
        CONSTRAINT UQ_roles_permissions_role_module UNIQUE (role_id, module),
        CONSTRAINT FK_roles_permissions_role FOREIGN KEY (role_id) REFERENCES dbo.roles(role_id)
    );
END;
GO

IF COL_LENGTH('dbo.users', 'role_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD role_id INT NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'department_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD department_id INT NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'section_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD section_id INT NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'team_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD team_id INT NULL;
END;
GO

IF COL_LENGTH('dbo.servers', 'department_id') IS NULL
BEGIN
    ALTER TABLE dbo.servers ADD department_id INT NULL;
END;
GO

IF COL_LENGTH('dbo.servers', 'section_id') IS NULL
BEGIN
    ALTER TABLE dbo.servers ADD section_id INT NULL;
END;
GO

IF COL_LENGTH('dbo.servers', 'team_id') IS NULL
BEGIN
    ALTER TABLE dbo.servers ADD team_id INT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.users')
      AND name = 'IX_users_role_department_team'
)
BEGIN
    CREATE INDEX IX_users_role_department_team
    ON dbo.users(role_id, department_id, team_id);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.servers')
      AND name = 'IX_servers_department_team'
)
BEGIN
    CREATE INDEX IX_servers_department_team
    ON dbo.servers(department_id, team_id);
END;
GO
