const express = require('express');
const router = express.Router();
const { query, execute } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditMiddleware } = require('../middleware/audit');

router.get('/', authenticate, async (req, res) => {
  try {
    const { location_id } = req.query;
    let sql = `SELECT r.*, l.site_name, l.city,
      (SELECT COUNT(*) FROM servers WHERE rack_id = r.rack_id) as server_count
     FROM racks r JOIN locations l ON r.location_id = l.location_id WHERE r.is_active = 1`;
    const params = {};
    if (location_id) { sql += ' AND r.location_id = @location_id'; params.location_id = parseInt(location_id); }
    sql += ' ORDER BY l.site_name, r.rack_code';
    const result = await query(sql, params);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch racks.' });
  }
});

// GET /api/racks/:id/view - Full rack view (paper replacement)
router.get('/:id/view', authenticate, async (req, res) => {
  try {
    const result = await execute('sp_GetRackView', { rack_id: parseInt(req.params.id) });
    if (!result.recordsets[0].length) return res.status(404).json({ error: 'Rack not found.' });
    res.json({ rack: result.recordsets[0][0], servers: result.recordsets[1] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rack view.' });
  }
});

router.post('/', authenticate, requirePermission('servers.create'),
  auditMiddleware('CREATE', 'rack'),
  async (req, res) => {
    try {
      const { location_id, rack_code, rack_name, total_u, power_circuit_a, power_circuit_b, description } = req.body;
      if (!location_id) return res.status(400).json({ error: 'Location is required.' });
      if (!rack_code || typeof rack_code !== 'string' || !rack_code.trim()) {
        return res.status(400).json({ error: 'Rack code is required.' });
      }
      const existing = await query(
        `SELECT 1 FROM racks WHERE LOWER(TRIM(rack_code)) = LOWER(TRIM(@rack_code)) AND location_id = @location_id AND is_active = 1`,
        { rack_code, location_id }
      );
      if (existing.recordset.length) {
        return res.status(409).json({ error: 'A rack with this code already exists in this location.' });
      }
      const result = await query(
        `INSERT INTO racks (location_id, rack_code, rack_name, total_u, power_circuit_a, power_circuit_b, description)
         OUTPUT INSERTED.rack_id
         VALUES (@location_id, @rack_code, @rack_name, @total_u, @pca, @pcb, @description)`,
        { location_id, rack_code, rack_name, total_u: total_u || 42,
          pca: power_circuit_a, pcb: power_circuit_b, description }
      );
      res.status(201).json({ id: result.recordset[0].rack_id, message: 'Rack created.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create rack.' });
    }
  }
);

router.put('/:id', authenticate, requirePermission('servers.update'),
  auditMiddleware('UPDATE', 'rack'),
  async (req, res) => {
    try {
      const fields = req.body;
      const allowed = ['rack_code', 'rack_name', 'total_u', 'power_circuit_a', 'power_circuit_b', 'description'];
      const updateFields = [];
      const params = { id: parseInt(req.params.id) };
      for (const f of allowed) {
        if (fields[f] !== undefined) { updateFields.push(`${f} = @${f}`); params[f] = fields[f]; }
      }
      if (!updateFields.length) return res.status(400).json({ error: 'No fields to update.' });
      if (fields.rack_code !== undefined) {
        const rack = (await query('SELECT location_id FROM racks WHERE rack_id = @id', { id: parseInt(req.params.id) })).recordset[0];
        const dup = await query(
          `SELECT 1 FROM racks WHERE LOWER(TRIM(rack_code)) = LOWER(TRIM(@rack_code)) AND location_id = @location_id AND rack_id != @id AND is_active = 1`,
          { rack_code: fields.rack_code, location_id: rack?.location_id, id: parseInt(req.params.id) }
        );
        if (dup.recordset.length) return res.status(409).json({ error: 'A rack with this code already exists in this location.' });
      }
      updateFields.push('updated_at = GETDATE()');
      await query(`UPDATE racks SET ${updateFields.join(', ')} WHERE rack_id = @id`, params);
      res.json({ message: 'Rack updated.' });
    } catch (err) {
      console.error('Update rack error:', err);
      res.status(500).json({ error: 'Failed to update rack.' });
    }
  }
);

module.exports = router;
