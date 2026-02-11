-- Creates a secure credentials table for storing per-server login username + encrypted password.
-- Run this once on the SERVER_ASSET_MANAGEMENT database.

IF OBJECT_ID('dbo.server_credentials', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.server_credentials (
    server_id INT NOT NULL,
    login_username NVARCHAR(200) NULL,
    password_enc NVARCHAR(MAX) NULL,
    created_at DATETIME NOT NULL CONSTRAINT DF_server_credentials_created_at DEFAULT (GETDATE()),
    updated_at DATETIME NOT NULL CONSTRAINT DF_server_credentials_updated_at DEFAULT (GETDATE()),
    CONSTRAINT PK_server_credentials PRIMARY KEY (server_id),
    CONSTRAINT FK_server_credentials_server FOREIGN KEY (server_id)
      REFERENCES dbo.servers(server_id)
      ON DELETE CASCADE
  );
END
GO

-- Optional: if you want to ensure updated_at changes automatically, you can use an UPDATE trigger.
-- (Not required because the API updates updated_at explicitly.)
