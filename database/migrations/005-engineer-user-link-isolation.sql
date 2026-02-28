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

IF COL_LENGTH('dbo.users', 'engineer_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD engineer_id INT NULL;
END;
GO

IF COL_LENGTH('dbo.engineers', 'department_id') IS NULL
BEGIN
    ALTER TABLE dbo.engineers ADD department_id INT NULL;
END;
GO

IF COL_LENGTH('dbo.engineers', 'team_id') IS NULL
BEGIN
    ALTER TABLE dbo.engineers ADD team_id INT NULL;
END;
GO

UPDATE e
SET e.department_id = t.department_id
FROM dbo.engineers e
JOIN dbo.teams t ON t.team_id = e.team_id
WHERE e.department_id IS NULL;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_users_engineer_id'
)
BEGIN
    ALTER TABLE dbo.users
    ADD CONSTRAINT FK_users_engineer_id
    FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_engineers_department_id'
)
BEGIN
    ALTER TABLE dbo.engineers
    ADD CONSTRAINT FK_engineers_department_id
    FOREIGN KEY (department_id) REFERENCES dbo.departments(department_id);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_engineers_team_id'
)
BEGIN
    ALTER TABLE dbo.engineers
    ADD CONSTRAINT FK_engineers_team_id
    FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.users')
      AND name = 'UX_users_engineer_id_not_null'
)
BEGIN
    CREATE UNIQUE INDEX UX_users_engineer_id_not_null
    ON dbo.users(engineer_id)
    WHERE engineer_id IS NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.users')
      AND name = 'IX_users_department_team_role'
)
BEGIN
    CREATE INDEX IX_users_department_team_role
    ON dbo.users(department_id, team_id, role_id);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.engineers')
      AND name = 'IX_engineers_department_team'
)
BEGIN
    CREATE INDEX IX_engineers_department_team
    ON dbo.engineers(department_id, team_id);
END;
GO