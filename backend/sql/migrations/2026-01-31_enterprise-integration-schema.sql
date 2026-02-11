/*
  Migration: Enterprise Integration - Connect All Modules
  Date: 2026-01-31
  
  PURPOSE: Transform the system into a fully integrated enterprise platform
  where ALL modules are relationally connected through proper foreign keys.
  
  CORE PRINCIPLE: SERVERS is the central entity. Everything connects to it.
  
  This migration ensures:
  1. All operational tables link to servers (server_id FK)
  2. All personnel tables link to teams/engineers
  3. All location tables are properly hierarchical
  4. Proper cascading and data integrity
*/

BEGIN TRY
  BEGIN TRAN;

  PRINT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  PRINT '🏗️  ENTERPRISE INTEGRATION SCHEMA MIGRATION';
  PRINT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 1️⃣ SERVERS TABLE - Ensure Core Relationships
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  IF OBJECT_ID('dbo.servers') IS NOT NULL
  BEGIN
    PRINT '📦 Enhancing SERVERS table...';
    
    -- Add location_id if missing
    IF COL_LENGTH('dbo.servers', 'location_id') IS NULL
    BEGIN
      ALTER TABLE dbo.servers ADD location_id INT NULL;
      PRINT '  ✓ Added location_id to servers';
    END
    
    -- Add rack_id if missing
    IF COL_LENGTH('dbo.servers', 'rack_id') IS NULL
    BEGIN
      ALTER TABLE dbo.servers ADD rack_id INT NULL;
      PRINT '  ✓ Added rack_id to servers';
    END
    
    -- Add engineer_id if missing (assigned engineer)
    IF COL_LENGTH('dbo.servers', 'engineer_id') IS NULL
    BEGIN
      ALTER TABLE dbo.servers ADD engineer_id INT NULL;
      PRINT '  ✓ Added engineer_id to servers';
    END
    
    -- Add team_id if missing (owning team)
    IF COL_LENGTH('dbo.servers', 'team_id') IS NULL
    BEGIN
      ALTER TABLE dbo.servers ADD team_id INT NULL;
      PRINT '  ✓ Added team_id to servers';
    END
  END

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 2️⃣ MAINTENANCE TABLE - Link to Servers
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  IF OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
  BEGIN
    PRINT '🔧 Enhancing MAINTENANCE_SCHEDULES table...';
    
    -- Ensure server_id exists
    IF COL_LENGTH('dbo.maintenance_schedules', 'server_id') IS NULL
    BEGIN
      ALTER TABLE dbo.maintenance_schedules ADD server_id INT NULL;
      PRINT '  ✓ Added server_id to maintenance_schedules';
    END
    
    -- Ensure engineer_id exists
    IF COL_LENGTH('dbo.maintenance_schedules', 'engineer_id') IS NULL
    BEGIN
      ALTER TABLE dbo.maintenance_schedules ADD engineer_id INT NULL;
      PRINT '  ✓ Added engineer_id to maintenance_schedules';
    END
    
    -- Ensure team_id exists
    IF COL_LENGTH('dbo.maintenance_schedules', 'team_id') IS NULL
    BEGIN
      ALTER TABLE dbo.maintenance_schedules ADD team_id INT NULL;
      PRINT '  ✓ Added team_id to maintenance_schedules';
    END
  END

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 3️⃣ INCIDENTS TABLE - Link to Servers
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  IF OBJECT_ID('dbo.incidents') IS NOT NULL
  BEGIN
    PRINT '🚨 Enhancing INCIDENTS table...';
    
    -- Ensure server_id exists
    IF COL_LENGTH('dbo.incidents', 'server_id') IS NULL
    BEGIN
      ALTER TABLE dbo.incidents ADD server_id INT NULL;
      PRINT '  ✓ Added server_id to incidents';
    END
    
    -- Ensure assigned_to (engineer_id) exists
    IF COL_LENGTH('dbo.incidents', 'assigned_to') IS NULL
    BEGIN
      ALTER TABLE dbo.incidents ADD assigned_to INT NULL;
      PRINT '  ✓ Added assigned_to to incidents';
    END
  END

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 4️⃣ MONITORING TABLE - Link to Servers
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  IF OBJECT_ID('dbo.server_monitoring') IS NOT NULL
  BEGIN
    PRINT '📊 Enhancing SERVER_MONITORING table...';
    
    -- Ensure server_id exists
    IF COL_LENGTH('dbo.server_monitoring', 'server_id') IS NULL
    BEGIN
      ALTER TABLE dbo.server_monitoring ADD server_id INT NULL;
      PRINT '  ✓ Added server_id to server_monitoring';
    END
  END

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 5️⃣ SECURITY TABLE - Link to Servers
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  IF OBJECT_ID('dbo.security') IS NOT NULL
  BEGIN
    PRINT '🔒 Enhancing SECURITY table...';
    
    -- Ensure server_id exists
    IF COL_LENGTH('dbo.security', 'server_id') IS NULL
    BEGIN
      ALTER TABLE dbo.security ADD server_id INT NULL;
      PRINT '  ✓ Added server_id to security';
    END
  END

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 6️⃣ VISITS TABLE - Link to Servers & Engineers
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  IF OBJECT_ID('dbo.server_visits') IS NOT NULL
  BEGIN
    PRINT '👷 Enhancing SERVER_VISITS table...';
    
    -- Ensure server_id exists
    IF COL_LENGTH('dbo.server_visits', 'server_id') IS NULL
    BEGIN
      ALTER TABLE dbo.server_visits ADD server_id INT NULL;
      PRINT '  ✓ Added server_id to server_visits';
    END
    
    -- Ensure engineer_id exists
    IF COL_LENGTH('dbo.server_visits', 'engineer_id') IS NULL
    BEGIN
      ALTER TABLE dbo.server_visits ADD engineer_id INT NULL;
      PRINT '  ✓ Added engineer_id to server_visits';
    END
  END

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 7️⃣ RACKS TABLE - Link to Locations
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  IF OBJECT_ID('dbo.racks') IS NOT NULL
  BEGIN
    PRINT '📦 Enhancing RACKS table...';
    
    -- Ensure location_id exists
    IF COL_LENGTH('dbo.racks', 'location_id') IS NULL
    BEGIN
      ALTER TABLE dbo.racks ADD location_id INT NULL;
      PRINT '  ✓ Added location_id to racks';
    END
  END

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 8️⃣ ENGINEERS TABLE - Link to Teams
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  IF OBJECT_ID('dbo.engineers') IS NOT NULL
  BEGIN
    PRINT '👨‍💼 Enhancing ENGINEERS table...';
    
    -- Ensure team_id exists
    IF COL_LENGTH('dbo.engineers', 'team_id') IS NULL
    BEGIN
      ALTER TABLE dbo.engineers ADD team_id INT NULL;
      PRINT '  ✓ Added team_id to engineers';
    END
  END

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 🔗 FOREIGN KEY CONSTRAINTS
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  PRINT '';
  PRINT '🔗 Creating Foreign Key Constraints...';

  -- Servers → Locations
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_servers_locations')
     AND OBJECT_ID('dbo.servers') IS NOT NULL
     AND OBJECT_ID('dbo.locations') IS NOT NULL
     AND COL_LENGTH('dbo.servers', 'location_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.servers WITH CHECK
      ADD CONSTRAINT FK_servers_locations
      FOREIGN KEY (location_id) REFERENCES dbo.locations(location_id);
    PRINT '  ✓ FK: servers → locations';
  END

  -- Servers → Racks
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_servers_racks')
     AND OBJECT_ID('dbo.servers') IS NOT NULL
     AND OBJECT_ID('dbo.racks') IS NOT NULL
     AND COL_LENGTH('dbo.servers', 'rack_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.servers WITH CHECK
      ADD CONSTRAINT FK_servers_racks
      FOREIGN KEY (rack_id) REFERENCES dbo.racks(rack_id);
    PRINT '  ✓ FK: servers → racks';
  END

  -- Servers → Engineers
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_servers_engineers')
     AND OBJECT_ID('dbo.servers') IS NOT NULL
     AND OBJECT_ID('dbo.engineers') IS NOT NULL
     AND COL_LENGTH('dbo.servers', 'engineer_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.servers WITH CHECK
      ADD CONSTRAINT FK_servers_engineers
      FOREIGN KEY (engineer_id) REFERENCES dbo.engineers(engineer_id);
    PRINT '  ✓ FK: servers → engineers';
  END

  -- Servers → Teams
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_servers_teams')
     AND OBJECT_ID('dbo.servers') IS NOT NULL
     AND OBJECT_ID('dbo.teams') IS NOT NULL
     AND COL_LENGTH('dbo.servers', 'team_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.servers WITH CHECK
      ADD CONSTRAINT FK_servers_teams
      FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id);
    PRINT '  ✓ FK: servers → teams';
  END

  -- Maintenance → Servers
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_maintenance_schedules_servers')
     AND OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
     AND OBJECT_ID('dbo.servers') IS NOT NULL
     AND COL_LENGTH('dbo.maintenance_schedules', 'server_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.maintenance_schedules WITH CHECK
      ADD CONSTRAINT FK_maintenance_schedules_servers
      FOREIGN KEY (server_id) REFERENCES dbo.servers(server_id);
    PRINT '  ✓ FK: maintenance_schedules → servers';
  END

  -- Incidents → Servers
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_incidents_servers')
     AND OBJECT_ID('dbo.incidents') IS NOT NULL
     AND OBJECT_ID('dbo.servers') IS NOT NULL
     AND COL_LENGTH('dbo.incidents', 'server_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.incidents WITH CHECK
      ADD CONSTRAINT FK_incidents_servers
      FOREIGN KEY (server_id) REFERENCES dbo.servers(server_id);
    PRINT '  ✓ FK: incidents → servers';
  END

  -- Monitoring → Servers
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_server_monitoring_servers')
     AND OBJECT_ID('dbo.server_monitoring') IS NOT NULL
     AND OBJECT_ID('dbo.servers') IS NOT NULL
     AND COL_LENGTH('dbo.server_monitoring', 'server_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.server_monitoring WITH CHECK
      ADD CONSTRAINT FK_server_monitoring_servers
      FOREIGN KEY (server_id) REFERENCES dbo.servers(server_id);
    PRINT '  ✓ FK: server_monitoring → servers';
  END

  -- Security → Servers
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_security_servers')
     AND OBJECT_ID('dbo.security') IS NOT NULL
     AND OBJECT_ID('dbo.servers') IS NOT NULL
     AND COL_LENGTH('dbo.security', 'server_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.security WITH CHECK
      ADD CONSTRAINT FK_security_servers
      FOREIGN KEY (server_id) REFERENCES dbo.servers(server_id);
    PRINT '  ✓ FK: security → servers';
  END

  -- Visits → Servers
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_server_visits_servers')
     AND OBJECT_ID('dbo.server_visits') IS NOT NULL
     AND OBJECT_ID('dbo.servers') IS NOT NULL
     AND COL_LENGTH('dbo.server_visits', 'server_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.server_visits WITH CHECK
      ADD CONSTRAINT FK_server_visits_servers
      FOREIGN KEY (server_id) REFERENCES dbo.servers(server_id);
    PRINT '  ✓ FK: server_visits → servers';
  END

  -- Racks → Locations
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_racks_locations')
     AND OBJECT_ID('dbo.racks') IS NOT NULL
     AND OBJECT_ID('dbo.locations') IS NOT NULL
     AND COL_LENGTH('dbo.racks', 'location_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.racks WITH CHECK
      ADD CONSTRAINT FK_racks_locations
      FOREIGN KEY (location_id) REFERENCES dbo.locations(location_id);
    PRINT '  ✓ FK: racks → locations';
  END

  -- Engineers → Teams
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_engineers_teams')
     AND OBJECT_ID('dbo.engineers') IS NOT NULL
     AND OBJECT_ID('dbo.teams') IS NOT NULL
     AND COL_LENGTH('dbo.engineers', 'team_id') IS NOT NULL
  BEGIN
    ALTER TABLE dbo.engineers WITH CHECK
      ADD CONSTRAINT FK_engineers_teams
      FOREIGN KEY (team_id) REFERENCES dbo.teams(team_id);
    PRINT '  ✓ FK: engineers → teams';
  END

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- 📊 CREATE USEFUL INDEXES
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  PRINT '';
  PRINT '📊 Creating Performance Indexes...';

  -- Index on server_id in all related tables
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_maintenance_schedules_server_id')
     AND OBJECT_ID('dbo.maintenance_schedules') IS NOT NULL
  BEGIN
    CREATE NONCLUSTERED INDEX IX_maintenance_schedules_server_id
    ON dbo.maintenance_schedules(server_id);
    PRINT '  ✓ Index: maintenance_schedules(server_id)';
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_incidents_server_id')
     AND OBJECT_ID('dbo.incidents') IS NOT NULL
  BEGIN
    CREATE NONCLUSTERED INDEX IX_incidents_server_id
    ON dbo.incidents(server_id);
    PRINT '  ✓ Index: incidents(server_id)';
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_server_monitoring_server_id')
     AND OBJECT_ID('dbo.server_monitoring') IS NOT NULL
  BEGIN
    CREATE NONCLUSTERED INDEX IX_server_monitoring_server_id
    ON dbo.server_monitoring(server_id);
    PRINT '  ✓ Index: server_monitoring(server_id)';
  END

  PRINT '';
  PRINT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  PRINT '✅ ENTERPRISE INTEGRATION COMPLETE';
  PRINT '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  
  DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
  PRINT '';
  PRINT '❌ Migration failed: ' + @ErrorMessage;
  THROW;
END CATCH;
