/*
  2026-01-29 Enhanced Network Management
  - Expand server_network table with comprehensive network fields
  - Add support for multiple IPs per server
  - Secondary IP, IPv6, VLAN, Gateway, DNS, Bandwidth, Firewall, NAT
  - Create/update stored procedures
  
  Notes:
  - Idempotent: safe to run multiple times
  - One server can have multiple network records (multiple IPs)
*/

SET XACT_ABORT ON;

BEGIN TRAN;

  -- Create server_network table if it doesn't exist
  IF OBJECT_ID('dbo.server_network', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.server_network (
      network_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_server_network PRIMARY KEY,
      server_id INT NOT NULL,
      ip_address NVARCHAR(50) NOT NULL,
      secondary_ip NVARCHAR(50) NULL,
      ipv6 NVARCHAR(100) NULL,
      subnet NVARCHAR(50) NOT NULL,
      vlan NVARCHAR(50) NULL,
      gateway NVARCHAR(50) NULL,
      dns_type NVARCHAR(50) NULL,
      network_type NVARCHAR(50) NOT NULL,
      bandwidth NVARCHAR(50) NULL,
      firewall_enabled BIT NOT NULL CONSTRAINT DF_server_network_firewall_enabled DEFAULT (0),
      nat_enabled BIT NOT NULL CONSTRAINT DF_server_network_nat_enabled DEFAULT (0),
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_server_network_created_at DEFAULT (SYSUTCDATETIME()),
      updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_server_network_updated_at DEFAULT (SYSUTCDATETIME()),
      
      CONSTRAINT FK_server_network_server FOREIGN KEY (server_id) 
        REFERENCES dbo.servers(server_id) ON DELETE CASCADE
    );
    
    -- Index for fast lookups by server
    CREATE NONCLUSTERED INDEX IX_server_network_server_id 
      ON dbo.server_network(server_id);
    
    -- Index for IP address lookups
    CREATE NONCLUSTERED INDEX IX_server_network_ip_address 
      ON dbo.server_network(ip_address);
  END
  ELSE
  BEGIN
    -- Add new columns if table already exists
    IF COL_LENGTH('dbo.server_network', 'secondary_ip') IS NULL
      ALTER TABLE dbo.server_network ADD secondary_ip NVARCHAR(50) NULL;
    
    IF COL_LENGTH('dbo.server_network', 'ipv6') IS NULL
      ALTER TABLE dbo.server_network ADD ipv6 NVARCHAR(100) NULL;
    
    IF COL_LENGTH('dbo.server_network', 'vlan') IS NULL
      ALTER TABLE dbo.server_network ADD vlan NVARCHAR(50) NULL;
    
    IF COL_LENGTH('dbo.server_network', 'gateway') IS NULL
      ALTER TABLE dbo.server_network ADD gateway NVARCHAR(50) NULL;
    
    IF COL_LENGTH('dbo.server_network', 'dns_type') IS NULL
      ALTER TABLE dbo.server_network ADD dns_type NVARCHAR(50) NULL;
    
    IF COL_LENGTH('dbo.server_network', 'bandwidth') IS NULL
      ALTER TABLE dbo.server_network ADD bandwidth NVARCHAR(50) NULL;
    
    IF COL_LENGTH('dbo.server_network', 'firewall_enabled') IS NULL
      ALTER TABLE dbo.server_network ADD firewall_enabled BIT NOT NULL 
        CONSTRAINT DF_server_network_firewall_enabled DEFAULT (0);
    
    IF COL_LENGTH('dbo.server_network', 'nat_enabled') IS NULL
      ALTER TABLE dbo.server_network ADD nat_enabled BIT NOT NULL 
        CONSTRAINT DF_server_network_nat_enabled DEFAULT (0);
    
    -- Ensure foreign key exists
    IF NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys 
      WHERE name = 'FK_server_network_server' 
        AND parent_object_id = OBJECT_ID('dbo.server_network')
    )
    BEGIN
      ALTER TABLE dbo.server_network 
        ADD CONSTRAINT FK_server_network_server FOREIGN KEY (server_id) 
        REFERENCES dbo.servers(server_id) ON DELETE CASCADE;
    END
    
    -- Ensure indexes exist
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes 
      WHERE name = 'IX_server_network_server_id' 
        AND object_id = OBJECT_ID('dbo.server_network')
    )
    BEGIN
      CREATE NONCLUSTERED INDEX IX_server_network_server_id 
        ON dbo.server_network(server_id);
    END
    
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes 
      WHERE name = 'IX_server_network_ip_address' 
        AND object_id = OBJECT_ID('dbo.server_network')
    )
    BEGIN
      CREATE NONCLUSTERED INDEX IX_server_network_ip_address 
        ON dbo.server_network(ip_address);
    END
  END

  -- Create/update stored procedure for assigning IP
  IF OBJECT_ID('dbo.sp_assign_ip', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_assign_ip;
  GO

CREATE PROCEDURE dbo.sp_assign_ip
  @server_id INT,
  @ip_address NVARCHAR(50),
  @secondary_ip NVARCHAR(50) = NULL,
  @ipv6 NVARCHAR(100) = NULL,
  @subnet NVARCHAR(50),
  @vlan NVARCHAR(50) = NULL,
  @gateway NVARCHAR(50) = NULL,
  @dns_type NVARCHAR(50) = NULL,
  @network_type NVARCHAR(50),
  @bandwidth NVARCHAR(50) = NULL,
  @firewall_enabled BIT = 0,
  @nat_enabled BIT = 0
AS
BEGIN
  SET NOCOUNT ON;
  
  DECLARE @network_id INT;
  
  -- Validate server exists
  IF NOT EXISTS (SELECT 1 FROM dbo.servers WHERE server_id = @server_id)
  BEGIN
    THROW 50001, 'Server not found', 1;
  END
  
  -- Insert new network record
  INSERT INTO dbo.server_network (
    server_id,
    ip_address,
    secondary_ip,
    ipv6,
    subnet,
    vlan,
    gateway,
    dns_type,
    network_type,
    bandwidth,
    firewall_enabled,
    nat_enabled,
    created_at,
    updated_at
  )
  VALUES (
    @server_id,
    @ip_address,
    @secondary_ip,
    @ipv6,
    @subnet,
    @vlan,
    @gateway,
    @dns_type,
    @network_type,
    @bandwidth,
    @firewall_enabled,
    @nat_enabled,
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
  );
  
  SET @network_id = SCOPE_IDENTITY();
  
  SELECT @network_id AS network_id;
END
GO

BEGIN TRAN;

  -- Create/update stored procedure for updating network
  IF OBJECT_ID('dbo.sp_update_network', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_update_network;
  GO

CREATE PROCEDURE dbo.sp_update_network
  @network_id INT,
  @server_id INT,
  @ip_address NVARCHAR(50),
  @secondary_ip NVARCHAR(50) = NULL,
  @ipv6 NVARCHAR(100) = NULL,
  @subnet NVARCHAR(50),
  @vlan NVARCHAR(50) = NULL,
  @gateway NVARCHAR(50) = NULL,
  @dns_type NVARCHAR(50) = NULL,
  @network_type NVARCHAR(50),
  @bandwidth NVARCHAR(50) = NULL,
  @firewall_enabled BIT = 0,
  @nat_enabled BIT = 0
AS
BEGIN
  SET NOCOUNT ON;
  
  -- Validate network record exists
  IF NOT EXISTS (SELECT 1 FROM dbo.server_network WHERE network_id = @network_id)
  BEGIN
    THROW 50002, 'Network record not found', 1;
  END
  
  -- Validate server exists
  IF NOT EXISTS (SELECT 1 FROM dbo.servers WHERE server_id = @server_id)
  BEGIN
    THROW 50001, 'Server not found', 1;
  END
  
  -- Update network record
  UPDATE dbo.server_network
  SET
    server_id = @server_id,
    ip_address = @ip_address,
    secondary_ip = @secondary_ip,
    ipv6 = @ipv6,
    subnet = @subnet,
    vlan = @vlan,
    gateway = @gateway,
    dns_type = @dns_type,
    network_type = @network_type,
    bandwidth = @bandwidth,
    firewall_enabled = @firewall_enabled,
    nat_enabled = @nat_enabled,
    updated_at = SYSUTCDATETIME()
  WHERE network_id = @network_id;
  
  SELECT @network_id AS network_id;
END
GO

COMMIT TRAN;

PRINT 'Enhanced server_network table migration completed successfully';
