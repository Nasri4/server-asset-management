const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { auditMiddleware } = require('../middleware/audit');

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT l.*,
        (SELECT COUNT(*) FROM racks WHERE location_id = l.location_id) as rack_count,
        (SELECT COUNT(*) FROM servers WHERE location_id = l.location_id) as server_count
       FROM locations l WHERE l.is_active = 1 ORDER BY l.site_name`
    );
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch locations.' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT l.*,
        (SELECT COUNT(*) FROM racks WHERE location_id = l.location_id) as rack_count,
        (SELECT COUNT(*) FROM servers WHERE location_id = l.location_id) as server_count
       FROM locations l WHERE l.location_id = @id`,
      { id: parseInt(req.params.id) }
    );
    if (!result.recordset.length) return res.status(404).json({ error: 'Location not found.' });

    const racks = await query(
      `SELECT r.*,
        (SELECT COUNT(*) FROM servers WHERE rack_id = r.rack_id) as server_count
       FROM racks r WHERE r.location_id = @id AND r.is_active = 1`,
      { id: parseInt(req.params.id) }
    );

    res.json({ location: result.recordset[0], racks: racks.recordset });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch location.' });
  }
});

router.post('/', authenticate, requirePermission('servers.create'),
  auditMiddleware('CREATE', 'location'),
  async (req, res) => {
    try {
      const { country, city, site_name, site_type, address, latitude, longitude,
              power_source, cooling_type, contact_name, contact_phone } = req.body;
      if (!site_name || typeof site_name !== 'string' || !site_name.trim()) {
        return res.status(400).json({ error: 'Site name is required.' });
      }
      const existing = await query(
        `SELECT 1 FROM locations WHERE LOWER(TRIM(site_name)) = LOWER(TRIM(@site_name)) AND is_active = 1`,
        { site_name }
      );
      if (existing.recordset.length) {
        return res.status(409).json({ error: 'A location with this site name already exists.' });
      }
      const toNull = (v) => (v && String(v).trim() ? v.trim() : null);
      const result = await query(
        `INSERT INTO locations (country, city, site_name, site_type, address, latitude, longitude,
         power_source, cooling_type, contact_name, contact_phone)
         OUTPUT INSERTED.location_id
         VALUES (@country, @city, @site_name, @site_type, @address, @lat, @lng,
         @power_source, @cooling_type, @contact_name, @contact_phone)`,
        {
          country: toNull(country),
          city: toNull(city),
          site_name: (site_name || '').trim(),
          site_type: toNull(site_type),
          address: toNull(address),
          lat: latitude ?? null,
          lng: longitude ?? null,
          power_source: toNull(power_source),
          cooling_type: toNull(cooling_type),
          contact_name: toNull(contact_name),
          contact_phone: toNull(contact_phone),
        }
      );
      res.status(201).json({ id: result.recordset[0].location_id, message: 'Location created.' });
    } catch (err) {
      console.error('Create location error:', err);
      res.status(500).json({ error: 'Failed to create location.' });
    }
  }
);

router.put('/:id', authenticate, requirePermission('servers.update'),
  auditMiddleware('UPDATE', 'location'),
  async (req, res) => {
    try {
      const fields = req.body;
      const allowed = ['country', 'city', 'site_name', 'site_type', 'address', 'latitude', 'longitude',
                        'power_source', 'cooling_type', 'contact_name', 'contact_phone'];
      const updateFields = [];
      const params = { id: parseInt(req.params.id) };
      for (const f of allowed) {
        if (fields[f] !== undefined) { updateFields.push(`${f} = @${f}`); params[f] = fields[f]; }
      }
      if (!updateFields.length) return res.status(400).json({ error: 'No fields to update.' });
      if (fields.site_name) {
        const dup = await query(
          `SELECT 1 FROM locations WHERE LOWER(TRIM(site_name)) = LOWER(TRIM(@site_name)) AND location_id != @id AND is_active = 1`,
          { site_name: fields.site_name, id: parseInt(req.params.id) }
        );
        if (dup.recordset.length) return res.status(409).json({ error: 'A location with this site name already exists.' });
      }
      updateFields.push('updated_at = GETDATE()');
      await query(`UPDATE locations SET ${updateFields.join(', ')} WHERE location_id = @id`, params);
      res.json({ message: 'Location updated.' });
    } catch (err) {
      console.error('Update location error:', err);
      res.status(500).json({ error: 'Failed to update location.' });
    }
  }
);

module.exports = router;
