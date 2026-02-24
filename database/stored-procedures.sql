-- ============================================================
-- STORED PROCEDURES FOR TELCO_ASSET_MGMT
-- ============================================================
USE TELCO_ASSET_MGMT;
GO

-- ============================================================
-- SP: Dashboard Statistics
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GetDashboardStats
    @user_id INT = NULL,
    @role_name NVARCHAR(50) = NULL,
    @department_id INT = NULL,
    @team_id INT = NULL,
    @engineer_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Server counts by status
    SELECT
        COUNT(*) as total_servers,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_servers,
        SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive_servers,
        SUM(CASE WHEN status = 'Under Maintenance' THEN 1 ELSE 0 END) as maintenance_servers,
        SUM(CASE WHEN status = 'Decommissioned' THEN 1 ELSE 0 END) as decommissioned_servers
    FROM servers
    WHERE (@department_id IS NULL OR department_id = @department_id)
      AND (@team_id IS NULL OR team_id = @team_id);

    -- Open incidents by severity
    SELECT
        severity,
        COUNT(*) as count
    FROM incidents
    WHERE status NOT IN ('Closed', 'Resolved')
      AND (@department_id IS NULL OR server_id IN (SELECT server_id FROM servers WHERE department_id = @department_id))
      AND (@team_id IS NULL OR server_id IN (SELECT server_id FROM servers WHERE team_id = @team_id))
    GROUP BY severity;

    -- Upcoming maintenance (when engineer_id provided, show assigned to that engineer)
    SELECT TOP 5
        m.maintenance_id, m.title, m.scheduled_date, m.status, m.priority,
        s.server_code, s.hostname
    FROM maintenance m
    JOIN servers s ON m.server_id = s.server_id
    WHERE m.scheduled_date >= GETDATE()
      AND m.status IN ('Scheduled', 'Pending')
      AND (@department_id IS NULL OR s.department_id = @department_id)
      AND (@team_id IS NULL OR s.team_id = @team_id)
      AND (@engineer_id IS NULL OR m.assigned_engineer_id = @engineer_id)
    ORDER BY m.scheduled_date;

    -- Overdue maintenance
    SELECT COUNT(*) as overdue_count
    FROM maintenance m
    JOIN servers s ON m.server_id = s.server_id
    WHERE m.scheduled_date < GETDATE()
      AND m.status IN ('Scheduled', 'Pending')
      AND (@department_id IS NULL OR s.department_id = @department_id)
      AND (@team_id IS NULL OR s.team_id = @team_id);

    -- Warranty expiring in 90 days
    SELECT COUNT(*) as expiring_warranties
    FROM server_hardware h
    JOIN servers s ON h.server_id = s.server_id
    WHERE h.warranty_expiry BETWEEN GETDATE() AND DATEADD(DAY, 90, GETDATE())
      AND (@department_id IS NULL OR s.department_id = @department_id)
      AND (@team_id IS NULL OR s.team_id = @team_id);

    -- Recent activity
    SELECT TOP 10
        log_id, username, action, entity_type, entity_id, performed_at
    FROM audit_log
    WHERE (@user_id IS NULL OR user_id = @user_id)
    ORDER BY performed_at DESC;
END;
GO

-- ============================================================
-- SP: Get Servers with Filters (Role-scoped)
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GetServers
    @department_id INT = NULL,
    @team_id INT = NULL,
    @engineer_id INT = NULL,
    @status NVARCHAR(50) = NULL,
    @environment NVARCHAR(50) = NULL,
    @location_id INT = NULL,
    @search NVARCHAR(100) = NULL,
    @page INT = 1,
    @page_size INT = 25
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @offset INT = (@page - 1) * @page_size;

    SELECT
        s.server_id, s.server_code, s.hostname, s.server_type,
        s.environment, s.role, s.status, s.power_type,
        s.u_position_start, s.u_position_end, s.install_date,
        l.site_name, l.city,
        r.rack_code, r.rack_name,
        t.team_name,
        d.department_name,
        e.full_name as assigned_engineer,
        h.vendor, h.model, h.serial_number
    FROM servers s
    LEFT JOIN locations l ON s.location_id = l.location_id
    LEFT JOIN racks r ON s.rack_id = r.rack_id
    LEFT JOIN teams t ON s.team_id = t.team_id
    LEFT JOIN departments d ON s.department_id = d.department_id
    LEFT JOIN server_assignments sa ON s.server_id = sa.server_id AND sa.is_primary = 1 AND sa.unassigned_at IS NULL
    LEFT JOIN engineers e ON sa.engineer_id = e.engineer_id
    LEFT JOIN server_hardware h ON s.server_id = h.server_id
    WHERE (@department_id IS NULL OR s.department_id = @department_id)
      AND (@team_id IS NULL OR s.team_id = @team_id)
      AND (@engineer_id IS NULL OR sa.engineer_id = @engineer_id)
      AND (@status IS NULL OR s.status = @status)
      AND (@environment IS NULL OR s.environment = @environment)
      AND (@location_id IS NULL OR s.location_id = @location_id)
      AND (@search IS NULL OR s.server_code LIKE '%' + @search + '%'
           OR s.hostname LIKE '%' + @search + '%'
           OR h.serial_number LIKE '%' + @search + '%')
    ORDER BY s.created_at DESC
    OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY;

    -- Total count for pagination
    SELECT COUNT(*) as total
    FROM servers s
    LEFT JOIN server_assignments sa ON s.server_id = sa.server_id AND sa.is_primary = 1 AND sa.unassigned_at IS NULL
    LEFT JOIN server_hardware h ON s.server_id = h.server_id
    WHERE (@department_id IS NULL OR s.department_id = @department_id)
      AND (@team_id IS NULL OR s.team_id = @team_id)
      AND (@engineer_id IS NULL OR sa.engineer_id = @engineer_id)
      AND (@status IS NULL OR s.status = @status)
      AND (@environment IS NULL OR s.environment = @environment)
      AND (@location_id IS NULL OR s.location_id = @location_id)
      AND (@search IS NULL OR s.server_code LIKE '%' + @search + '%'
           OR s.hostname LIKE '%' + @search + '%'
           OR h.serial_number LIKE '%' + @search + '%');
END;
GO

-- ============================================================
-- SP: Get Server Full Detail (360 view)
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GetServerDetail
    @server_id INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Server base info
    SELECT s.*, l.site_name, l.city, l.country, r.rack_code, r.rack_name,
           t.team_name, d.department_name
    FROM servers s
    LEFT JOIN locations l ON s.location_id = l.location_id
    LEFT JOIN racks r ON s.rack_id = r.rack_id
    LEFT JOIN teams t ON s.team_id = t.team_id
    LEFT JOIN departments d ON s.department_id = d.department_id
    WHERE s.server_id = @server_id;

    -- Hardware
    SELECT * FROM server_hardware WHERE server_id = @server_id;

    -- Network
    SELECT * FROM server_network WHERE server_id = @server_id;

    -- Security
    SELECT * FROM server_security WHERE server_id = @server_id;

    -- Monitoring
    SELECT * FROM server_monitoring WHERE server_id = @server_id;

    -- Applications
    SELECT sa.*, a.app_name, a.app_type, a.version, a.criticality
    FROM server_applications sa
    JOIN applications a ON sa.application_id = a.application_id
    WHERE sa.server_id = @server_id;

    -- Assigned engineers
    SELECT sa.*, e.full_name, e.phone, e.email
    FROM server_assignments sa
    JOIN engineers e ON sa.engineer_id = e.engineer_id
    WHERE sa.server_id = @server_id AND sa.unassigned_at IS NULL;

    -- Maintenance history
    SELECT TOP 20 * FROM maintenance
    WHERE server_id = @server_id ORDER BY scheduled_date DESC;

    -- Incidents
    SELECT TOP 20 * FROM incidents
    WHERE server_id = @server_id ORDER BY reported_at DESC;

    -- Visits
    SELECT v.*, e.full_name as engineer_name
    FROM server_visits v
    JOIN engineers e ON v.engineer_id = e.engineer_id
    WHERE v.server_id = @server_id
    ORDER BY v.visit_date DESC;

    -- Activity log
    SELECT TOP 30 * FROM audit_log
    WHERE entity_type = 'server' AND entity_id = @server_id
    ORDER BY performed_at DESC;
END;
GO

-- ============================================================
-- SP: Get Rack View (Paper replacement)
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GetRackView
    @rack_id INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Rack info
    SELECT r.*, l.site_name, l.city
    FROM racks r
    JOIN locations l ON r.location_id = l.location_id
    WHERE r.rack_id = @rack_id;

    -- Servers in this rack with positions
    SELECT
        s.server_id, s.server_code, s.hostname, s.status, s.power_type,
        s.u_position_start, s.u_position_end,
        h.serial_number, h.vendor, h.model,
        t.team_name, s.notes
    FROM servers s
    LEFT JOIN server_hardware h ON s.server_id = h.server_id
    LEFT JOIN teams t ON s.team_id = t.team_id
    WHERE s.rack_id = @rack_id
    ORDER BY s.u_position_start;
END;
GO

-- ============================================================
-- SP: Engineer Profile
-- ============================================================
CREATE OR ALTER PROCEDURE sp_GetEngineerProfile
    @engineer_id INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Engineer info
    SELECT e.*, t.team_name, d.department_name
    FROM engineers e
    LEFT JOIN teams t ON e.team_id = t.team_id
    LEFT JOIN departments d ON t.department_id = d.department_id
    WHERE e.engineer_id = @engineer_id;

    -- Assigned servers
    SELECT sa.*, s.server_code, s.hostname, s.status
    FROM server_assignments sa
    JOIN servers s ON sa.server_id = s.server_id
    WHERE sa.engineer_id = @engineer_id AND sa.unassigned_at IS NULL;

    -- Incidents handled
    SELECT TOP 20 i.*, s.server_code
    FROM incidents i
    JOIN servers s ON i.server_id = s.server_id
    WHERE i.assigned_to = @engineer_id
    ORDER BY i.reported_at DESC;

    -- Maintenance completed
    SELECT TOP 20 m.*, s.server_code
    FROM maintenance m
    JOIN servers s ON m.server_id = s.server_id
    WHERE m.assigned_engineer_id = @engineer_id
    ORDER BY m.scheduled_date DESC;

    -- Visits
    SELECT TOP 20 v.*, s.server_code
    FROM server_visits v
    JOIN servers s ON v.server_id = s.server_id
    WHERE v.engineer_id = @engineer_id
    ORDER BY v.visit_date DESC;

    -- Performance metrics
    SELECT
        (SELECT COUNT(*) FROM server_assignments WHERE engineer_id = @engineer_id AND unassigned_at IS NULL) as assigned_servers,
        (SELECT COUNT(*) FROM incidents WHERE assigned_to = @engineer_id AND status = 'Resolved') as incidents_resolved,
        (SELECT COUNT(*) FROM incidents WHERE assigned_to = @engineer_id AND status IN ('Open', 'Investigating')) as incidents_open,
        (SELECT COUNT(*) FROM maintenance WHERE assigned_engineer_id = @engineer_id AND status = 'Completed') as maintenance_completed,
        (SELECT COUNT(*) FROM server_visits WHERE engineer_id = @engineer_id) as total_visits;
END;
GO

-- ============================================================
-- SP: Insert Audit Log
-- ============================================================
CREATE OR ALTER PROCEDURE sp_InsertAuditLog
    @user_id INT,
    @username NVARCHAR(100),
    @action NVARCHAR(50),
    @entity_type NVARCHAR(50),
    @entity_id INT = NULL,
    @old_value NVARCHAR(MAX) = NULL,
    @new_value NVARCHAR(MAX) = NULL,
    @ip_address NVARCHAR(50) = NULL,
    @user_agent NVARCHAR(255) = NULL,
    @is_sensitive BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, is_sensitive)
    VALUES (@user_id, @username, @action, @entity_type, @entity_id, @old_value, @new_value, @ip_address, @user_agent, @is_sensitive);
END;
GO

-- ============================================================
-- SP: Reports - Server Inventory
-- ============================================================
CREATE OR ALTER PROCEDURE sp_ReportServerInventory
    @department_id INT = NULL,
    @team_id INT = NULL,
    @status NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        s.server_code, s.hostname, s.server_type, s.environment,
        s.role, s.status, s.power_type, s.install_date,
        l.site_name, l.city, l.country,
        r.rack_code, CONCAT('U', s.u_position_start, '-U', s.u_position_end) as rack_position,
        h.vendor, h.model, h.serial_number, h.asset_tag,
        h.cpu_model, h.cpu_cores, h.ram_gb, h.storage_tb,
        h.warranty_expiry,
        n.ip_address, n.vlan, n.subnet,
        sec.os_name, sec.os_version, sec.hardening_status,
        mon.health_status, mon.uptime_percent,
        t.team_name, d.department_name,
        e.full_name as primary_engineer
    FROM servers s
    LEFT JOIN locations l ON s.location_id = l.location_id
    LEFT JOIN racks r ON s.rack_id = r.rack_id
    LEFT JOIN server_hardware h ON s.server_id = h.server_id
    LEFT JOIN server_network n ON s.server_id = n.server_id
    LEFT JOIN server_security sec ON s.server_id = sec.server_id
    LEFT JOIN server_monitoring mon ON s.server_id = mon.server_id
    LEFT JOIN teams t ON s.team_id = t.team_id
    LEFT JOIN departments d ON s.department_id = d.department_id
    LEFT JOIN server_assignments sa ON s.server_id = sa.server_id AND sa.is_primary = 1 AND sa.unassigned_at IS NULL
    LEFT JOIN engineers e ON sa.engineer_id = e.engineer_id
    WHERE (@department_id IS NULL OR s.department_id = @department_id)
      AND (@team_id IS NULL OR s.team_id = @team_id)
      AND (@status IS NULL OR s.status = @status)
    ORDER BY s.server_code;
END;
GO

-- ============================================================
-- SP: Reports - Incident Summary
-- ============================================================
CREATE OR ALTER PROCEDURE sp_ReportIncidentSummary
    @start_date DATE = NULL,
    @end_date DATE = NULL,
    @department_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @start_date IS NULL SET @start_date = DATEADD(MONTH, -1, GETDATE());
    IF @end_date IS NULL SET @end_date = GETDATE();

    SELECT
        i.incident_id, i.title, i.incident_type, i.severity, i.status,
        i.reported_at, i.resolved_at, i.closed_at,
        DATEDIFF(HOUR, i.reported_at, ISNULL(i.resolved_at, GETDATE())) as resolution_hours,
        s.server_code, s.hostname,
        e.full_name as assigned_engineer,
        t.team_name
    FROM incidents i
    JOIN servers s ON i.server_id = s.server_id
    LEFT JOIN engineers e ON i.assigned_to = e.engineer_id
    LEFT JOIN teams t ON s.team_id = t.team_id
    WHERE i.reported_at BETWEEN @start_date AND @end_date
      AND (@department_id IS NULL OR s.department_id = @department_id)
    ORDER BY i.reported_at DESC;

    -- Summary counts
    SELECT
        i.severity,
        COUNT(*) as total,
        SUM(CASE WHEN i.status = 'Resolved' OR i.status = 'Closed' THEN 1 ELSE 0 END) as resolved,
        AVG(DATEDIFF(HOUR, i.reported_at, ISNULL(i.resolved_at, GETDATE()))) as avg_resolution_hours
    FROM incidents i
    JOIN servers s ON i.server_id = s.server_id
    WHERE i.reported_at BETWEEN @start_date AND @end_date
      AND (@department_id IS NULL OR s.department_id = @department_id)
    GROUP BY i.severity;
END;
GO
