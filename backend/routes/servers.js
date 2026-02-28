const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission, scopeFilter } = require('../middleware/rbac');
const { auditMiddleware, logAudit } = require('../middleware/audit');
const { buildScope } = require('../middleware/scope.middleware');
const { verifyOTP } = require('../utils/otp');

// GET /api/servers - List with search and pagination
router.get('/', authenticate, requirePermission('servers.read'), buildScope('servers'), async (req, res) => {
  try {
    const scope = req.scope || { conditions: [], params: {} };
    const { search, page = 1, page_size = 25 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(page_size, 10) || 25));
    const offset = (p - 1) * ps;
    let where = ' WHERE 1=1';
    const params = { ...(scope.params || {}) };
    if (Array.isArray(scope.conditions) && scope.conditions.length) {
      where += ' AND ' + scope.conditions.join(' AND ');
    }
    if (search && String(search).trim()) { where += ' AND (s.server_code LIKE @search OR s.hostname LIKE @search)'; params.search = '%' + String(search).trim() + '%'; }

    const countResult = await query('SELECT COUNT(*) AS total FROM servers s LEFT JOIN departments d ON s.department_id = d.department_id' + where, params);
    const total = countResult.recordset[0]?.total ?? 0;

    const sql = `SELECT s.server_id, s.server_code, s.hostname, s.server_type, s.status, s.environment, s.updated_at,
      (SELECT TOP 1 ip_address FROM server_network n WHERE n.server_id = s.server_id) AS ip_address,
      (SELECT TOP 1 os_name FROM server_security sec WHERE sec.server_id = s.server_id) AS os_name,
      (SELECT TOP 1 os_version FROM server_security sec WHERE sec.server_id = s.server_id) AS os_version,
      d.department_name,
      (SELECT TOP 1 e.full_name FROM server_assignments sa JOIN engineers e ON e.engineer_id = sa.engineer_id WHERE sa.server_id = s.server_id AND sa.unassigned_at IS NULL) AS primary_engineer
    FROM servers s LEFT JOIN departments d ON s.department_id = d.department_id ${where}
    ORDER BY s.server_code OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY`;
    params.offset = offset;
    params.page_size = ps;
    const result = await query(sql, params);
    res.json({ servers: result.recordset || [], total: Number(total), page: p, page_size: ps });
  } catch (err) {
    console.error('Servers list error:', err);
    res.status(500).json({ error: 'Failed to fetch servers.' });
  }
});

// GET /api/servers/:id - Full server detail
router.get('/:id', authenticate, requirePermission('servers.read'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid server ID.' });
    const scope = scopeFilter(req);

    const serverResult = await query(
      `SELECT s.*, l.site_name, l.city, r.rack_code, r.rack_name, d.department_name, t.team_name
       FROM servers s LEFT JOIN locations l ON s.location_id = l.location_id LEFT JOIN racks r ON s.rack_id = r.rack_id
       LEFT JOIN departments d ON s.department_id = d.department_id LEFT JOIN teams t ON s.team_id = t.team_id
       WHERE s.server_id = @id`,
      { id }
    );
    if (!serverResult.recordset.length) return res.status(404).json({ error: 'Server not found.' });
    const server = serverResult.recordset[0];
    if (scope.department_id && server.department_id !== scope.department_id) return res.status(404).json({ error: 'Server not found.' });
    if (scope.team_id && server.team_id !== scope.team_id) return res.status(404).json({ error: 'Server not found.' });

    const [hwRows, netRows, secRows, monRows, appRows, assignRows, maintRows, incRows, visitRows, activityRows, credRows] = await Promise.all([
      query('SELECT * FROM server_hardware WHERE server_id = @id', { id }),
      query('SELECT TOP 1 * FROM server_network WHERE server_id = @id ORDER BY network_id', { id }),
      query('SELECT * FROM server_security WHERE server_id = @id', { id }),
      query('SELECT * FROM server_monitoring WHERE server_id = @id', { id }),
      query('SELECT sa.*, a.app_name, a.app_type FROM server_applications sa JOIN applications a ON a.application_id = sa.application_id WHERE sa.server_id = @id', { id }),
      query('SELECT sa.*, e.full_name FROM server_assignments sa JOIN engineers e ON e.engineer_id = sa.engineer_id WHERE sa.server_id = @id AND sa.unassigned_at IS NULL', { id }),
      query('SELECT m.*, e.full_name AS engineer_name FROM maintenance m LEFT JOIN engineers e ON e.engineer_id = m.assigned_engineer_id WHERE m.server_id = @id ORDER BY m.scheduled_date DESC', { id }),
      query('SELECT i.*, e.full_name AS assigned_engineer FROM incidents i LEFT JOIN engineers e ON e.engineer_id = i.assigned_to WHERE i.server_id = @id ORDER BY i.reported_at DESC', { id }),
      query('SELECT v.*, e.full_name AS engineer_name FROM server_visits v JOIN engineers e ON e.engineer_id = v.engineer_id WHERE v.server_id = @id ORDER BY v.visit_date DESC', { id }),
      query("SELECT TOP 50 * FROM audit_log WHERE entity_type = 'server' AND entity_id = @id ORDER BY performed_at DESC", { id }),
      query('SELECT * FROM server_credentials WHERE server_id = @id', { id }).catch(() => ({ recordset: [] })),
    ]);

    res.json({
      server,
      hardware: hwRows.recordset[0] || null,
      network: netRows.recordset[0] || null,
      security: secRows.recordset[0] || null,
      monitoring: monRows.recordset[0] || null,
      applications: appRows.recordset || [],
      assignments: assignRows.recordset || [],
      maintenance: maintRows.recordset || [],
      incidents: incRows.recordset || [],
      visits: visitRows.recordset || [],
      activity: activityRows.recordset || [],
      credentials: credRows.recordset || [],
    });
  } catch (err) {
    console.error('Server detail error:', err);
    res.status(500).json({ error: 'Failed to fetch server.' });
  }
});

// PUT /api/servers/:id/hardware - Upsert (must be before PUT /:id)
router.put('/:id/hardware', authenticate, requirePermission('servers.update'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid server ID.' });
    const body = req.body;
    const exists = await query('SELECT 1 FROM server_hardware WHERE server_id = @id', { id });
    const f = {
      vendor: body.vendor, model: body.model, serial_number: body.serial_number, asset_tag: body.asset_tag,
      cpu_model: body.cpu_model, cpu_cores: body.cpu_cores != null ? parseInt(body.cpu_cores, 10) : null,
      ram_gb: body.ram_gb != null ? parseInt(body.ram_gb, 10) : null, storage_tb: body.storage_tb != null ? parseFloat(body.storage_tb) : null,
      raid_level: body.raid_level, nic_count: body.nic_count != null ? parseInt(body.nic_count, 10) : null,
      power_supply: body.power_supply, warranty_start: body.warranty_start || null, warranty_expiry: body.warranty_expiry || null,
    };
    if (exists.recordset.length) {
      await query(
        `UPDATE server_hardware SET vendor=@vendor, model=@model, serial_number=@serial_number, asset_tag=@asset_tag,
         cpu_model=@cpu_model, cpu_cores=@cpu_cores, ram_gb=@ram_gb, storage_tb=@storage_tb, raid_level=@raid_level,
         nic_count=@nic_count, power_supply=@power_supply, warranty_start=@warranty_start, warranty_expiry=@warranty_expiry WHERE server_id=@id`,
        { id, ...f }
      );
    } else {
      await query(
        `INSERT INTO server_hardware (server_id, vendor, model, serial_number, asset_tag, cpu_model, cpu_cores, ram_gb, storage_tb, raid_level, nic_count, power_supply, warranty_start, warranty_expiry)
         VALUES (@id, @vendor, @model, @serial_number, @asset_tag, @cpu_model, @cpu_cores, @ram_gb, @storage_tb, @raid_level, @nic_count, @power_supply, @warranty_start, @warranty_expiry)`,
        { id, ...f }
      );
    }
    if (req.user) await logAudit(req.user.user_id, req.user.username, 'HARDWARE_UPDATED', 'server', id, null, body, req.user.ip, req.user.userAgent, false);
    res.json({ message: 'Hardware saved.' });
  } catch (err) {
    console.error('Hardware upsert error:', err);
    res.status(500).json({ error: 'Failed to save hardware.' });
  }
});

// PUT /api/servers/:id/network - Upsert (must be before PUT /:id)
router.put('/:id/network', authenticate, requirePermission('servers.update'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid server ID.' });
    const body = req.body;
    const netRows = await query('SELECT TOP 1 network_id FROM server_network WHERE server_id = @id', { id });
    const f = {
      ip_address: body.ip_address || null, secondary_ip: body.secondary_ip || null, ipv6: body.ipv6 || null,
      subnet: body.subnet || null, vlan: body.vlan || null, gateway: body.gateway || null,
      dns_primary: body.dns_primary || null, dns_secondary: body.dns_secondary || null,
      network_type: body.network_type || null, bandwidth: body.bandwidth || null,
      firewall_enabled: body.firewall_enabled ? 1 : 0, nat_enabled: body.nat_enabled ? 1 : 0,
    };
    if (netRows.recordset.length) {
      await query(
        `UPDATE server_network SET ip_address=@ip_address, secondary_ip=@secondary_ip, ipv6=@ipv6, subnet=@subnet, vlan=@vlan, gateway=@gateway,
         dns_primary=@dns_primary, dns_secondary=@dns_secondary, network_type=@network_type, bandwidth=@bandwidth, firewall_enabled=@firewall_enabled, nat_enabled=@nat_enabled WHERE server_id=@id`,
        { id, ...f }
      );
    } else {
      await query(
        `INSERT INTO server_network (server_id, ip_address, secondary_ip, ipv6, subnet, vlan, gateway, dns_primary, dns_secondary, network_type, bandwidth, firewall_enabled, nat_enabled)
         VALUES (@id, @ip_address, @secondary_ip, @ipv6, @subnet, @vlan, @gateway, @dns_primary, @dns_secondary, @network_type, @bandwidth, @firewall_enabled, @nat_enabled)`,
        { id, ...f }
      );
    }
    if (req.user) await logAudit(req.user.user_id, req.user.username, 'NETWORK_UPDATED', 'server', id, null, body, req.user.ip, req.user.userAgent, false);
    res.json({ message: 'Network saved.' });
  } catch (err) {
    console.error('Network upsert error:', err);
    res.status(500).json({ error: 'Failed to save network.' });
  }
});

// PUT /api/servers/:id - Update server
router.put('/:id', authenticate, requirePermission('servers.update'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid server ID.' });
    const body = req.body;
    const allowed = ['hostname', 'server_type', 'environment', 'role', 'status', 'power_type', 'team_id', 'department_id', 'location_id', 'rack_id', 'u_position_start', 'u_position_end', 'install_date', 'notes'];
    const updates = [];
    const params = { id };
    for (const field of allowed) {
      if (body[field] === undefined) continue;
      updates.push(`${field} = @${field}`);
      if (['team_id', 'department_id', 'location_id', 'rack_id', 'u_position_start', 'u_position_end'].includes(field))
        params[field] = body[field] != null && body[field] !== '' ? parseInt(body[field], 10) : null;
      else if (field === 'install_date') params[field] = body[field] || null;
      else params[field] = body[field];
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update.' });
    updates.push('updated_at = GETDATE()');
    await query(`UPDATE servers SET ${updates.join(', ')} WHERE server_id = @id`, params);
    if (req.user) await logAudit(req.user.user_id, req.user.username, 'SERVER_UPDATED', 'server', id, null, body, req.user.ip, req.user.userAgent, false);
    res.json({ message: 'Server updated.' });
  } catch (err) {
    console.error('Server update error:', err);
    res.status(500).json({ error: 'Failed to update server.' });
  }
});

// POST /api/servers - Register new server
router.post('/', authenticate, requirePermission('servers.create'), auditMiddleware('CREATE', 'server'), async (req, res) => {
  try {
    const body = req.body;
    const server_code = body.server_code && String(body.server_code).trim();
    if (!server_code) return res.status(400).json({ error: 'Server code is required.' });
    const existing = await query('SELECT 1 FROM servers WHERE LOWER(TRIM(server_code)) = LOWER(TRIM(@code))', { code: server_code });
    if (existing.recordset.length) return res.status(409).json({ error: 'A server with this code already exists.' });

    const result = await query(
      `INSERT INTO servers (server_code, hostname, server_type, environment, role, status, power_type, team_id, department_id, location_id, rack_id, u_position_start, u_position_end, install_date, notes)
       OUTPUT INSERTED.server_id
       VALUES (@code, @hostname, @server_type, @environment, @role, @status, @power_type, @team_id, @dept_id, @location_id, @rack_id, @u_start, @u_end, @install_date, @notes)`,
      {
        code: server_code, hostname: body.hostname || null, server_type: body.server_type || 'Physical', environment: body.environment || 'Production',
        role: body.role || null, status: body.status || 'Active', power_type: body.power_type || null,
        team_id: body.team_id ? parseInt(body.team_id, 10) : null, dept_id: body.department_id ? parseInt(body.department_id, 10) : null,
        location_id: body.location_id ? parseInt(body.location_id, 10) : null, rack_id: body.rack_id ? parseInt(body.rack_id, 10) : null,
        u_start: body.u_position_start != null && body.u_position_start !== '' ? parseInt(body.u_position_start, 10) : null,
        u_end: body.u_position_end != null && body.u_position_end !== '' ? parseInt(body.u_position_end, 10) : null,
        install_date: body.install_date || null, notes: body.notes || null,
      }
    );
    const serverId = result.recordset[0].server_id;
    const hw = body.hardware;
    if (hw && (hw.vendor || hw.model || hw.serial_number || hw.cpu_model)) {
      await query(
        `INSERT INTO server_hardware (server_id, vendor, model, serial_number, asset_tag, cpu_model, cpu_cores, ram_gb, storage_tb, raid_level, nic_count, power_supply, warranty_start, warranty_expiry)
         VALUES (@id, @vendor, @model, @serial_number, @asset_tag, @cpu_model, @cpu_cores, @ram_gb, @storage_tb, @raid_level, @nic_count, @power_supply, @warranty_start, @warranty_expiry)`,
        { id: serverId, vendor: hw.vendor || null, model: hw.model || null, serial_number: hw.serial_number || null, asset_tag: hw.asset_tag || null, cpu_model: hw.cpu_model || null, cpu_cores: hw.cpu_cores != null ? parseInt(hw.cpu_cores, 10) : null, ram_gb: hw.ram_gb != null ? parseInt(hw.ram_gb, 10) : null, storage_tb: hw.storage_tb != null ? parseFloat(hw.storage_tb) : null, raid_level: hw.raid_level || null, nic_count: hw.nic_count != null ? parseInt(hw.nic_count, 10) : null, power_supply: hw.power_supply || null, warranty_start: hw.warranty_start || null, warranty_expiry: hw.warranty_expiry || null }
      ).catch(() => {});
    }
    const net = body.network;
    if (net && (net.ip_address || net.gateway || net.network_type)) {
      await query(
        `INSERT INTO server_network (server_id, ip_address, secondary_ip, ipv6, subnet, vlan, gateway, dns_primary, dns_secondary, network_type, bandwidth, firewall_enabled, nat_enabled)
         VALUES (@id, @ip_address, @secondary_ip, @ipv6, @subnet, @vlan, @gateway, @dns_primary, @dns_secondary, @network_type, @bandwidth, @firewall_enabled, @nat_enabled)`,
        { id: serverId, ip_address: net.ip_address || null, secondary_ip: net.secondary_ip || null, ipv6: net.ipv6 || null, subnet: net.subnet || null, vlan: net.vlan || null, gateway: net.gateway || null, dns_primary: net.dns_primary || null, dns_secondary: net.dns_secondary || null, network_type: net.network_type || null, bandwidth: net.bandwidth || null, firewall_enabled: net.firewall_enabled ? 1 : 0, nat_enabled: net.nat_enabled ? 1 : 0 }
      ).catch(() => {});
    }
    const sec = body.security;
    if (sec && (sec.os_name || sec.os_version || sec.hardening_status)) {
      await query(
        `INSERT INTO server_security (server_id, os_name, os_version, hardening_status, ssh_key_only, antivirus_installed, backup_enabled, backup_frequency, log_retention_days) VALUES (@id, @os_name, @os_version, @hardening, @ssh, @av, @backup, @freq, @retention)`,
        { id: serverId, os_name: sec.os_name || null, os_version: sec.os_version || null, hardening: sec.hardening_status || 'Pending', ssh: sec.ssh_key_only ? 1 : 0, av: sec.antivirus_installed ? 1 : 0, backup: sec.backup_enabled ? 1 : 0, freq: sec.backup_frequency || null, retention: sec.log_retention_days != null ? parseInt(sec.log_retention_days, 10) : 90 }
      ).catch(() => {});
    }
    // Assign engineer if provided
    const engineer_id = body.engineer_id ? parseInt(body.engineer_id, 10) : null;
    if (engineer_id && !isNaN(engineer_id)) {
      await query(
        `INSERT INTO server_assignments (server_id, engineer_id, assigned_at) VALUES (@server_id, @engineer_id, GETDATE())`,
        { server_id: serverId, engineer_id }
      ).catch(() => {});
      if (req.user) await logAudit(req.user.user_id, req.user.username, 'ENGINEER_ASSIGNED', 'server', serverId, null, { engineer_id }, req.user.ip, req.user.userAgent, false);
    }
    // Store credentials if provided
    const cred = body.credentials;
    if (cred && (cred.username || cred.credential_type)) {
      await query(
        `INSERT INTO server_credentials (server_id, credential_type, username, password_encrypted, port, notes)
         VALUES (@id, @type, @username, @password, @port, @notes)`,
        { id: serverId, type: cred.credential_type || 'SSH', username: cred.username || null, password: cred.password || null, port: cred.port ? parseInt(cred.port, 10) : null, notes: cred.notes || null }
      ).catch(() => {});
    }
    res.status(201).json({ id: serverId, message: 'Server registered.' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Server code already exists.' });
    console.error('Register server error:', err);
    res.status(500).json({ error: err.message || 'Failed to register server.' });
  }
});

// DELETE /api/servers/:id - Decommission (soft-delete) a server
router.delete('/:id', authenticate, requirePermission('servers.update'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid server ID.' });
    const exists = await query('SELECT server_code, hostname, status FROM servers WHERE server_id = @id', { id });
    if (!exists.recordset.length) return res.status(404).json({ error: 'Server not found.' });
    const oldStatus = exists.recordset[0];
    await query('UPDATE servers SET status = @status, updated_at = GETDATE() WHERE server_id = @id', { id, status: 'Decommissioned' });
    if (req.user) await logAudit(req.user.user_id, req.user.username, 'SERVER_DELETED', 'server', id, oldStatus, { status: 'Decommissioned' }, req.user.ip, req.user.userAgent, false);
    res.json({ message: 'Server decommissioned.' });
  } catch (err) {
    console.error('Delete server error:', err);
    res.status(500).json({ error: 'Failed to delete server.' });
  }
});

// POST /api/servers/:id/credentials/unlock - Verify OTP then return credentials
router.post('/:id/credentials/unlock', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid server ID.' });
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'OTP is required.' });
    const purpose = 'credentials_' + id;
    const otpResult = await verifyOTP(req.user.user_id, String(otp).trim(), purpose);
    if (!otpResult.success) return res.status(400).json({ error: otpResult.error });
    const credResult = await query('SELECT * FROM server_credentials WHERE server_id = @id', { id });
    if (req.user) {
      await logAudit(req.user.user_id, req.user.username, 'CREDENTIALS_ACCESSED', 'server', id, null, { server_id: id, accessed_by: req.user.username }, req.user.ip, req.user.userAgent, true);
    }
    res.json({ credentials: credResult.recordset || [] });
  } catch (err) {
    console.error('Credentials unlock error:', err);
    res.status(500).json({ error: 'Failed to unlock credentials.' });
  }
});

module.exports = router;
