const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createAndSendOTP, verifyOTP } = require('../utils/otp');

router.post('/request', authenticate, async (req, res) => {
  try {
    const { purpose, method } = req.body; // method: 'sms' | 'email' (optional; auto-selects)
    if (!purpose) return res.status(400).json({ error: 'Purpose is required.' });

    const phone = req.user.phone || null;
    const email = req.user.email || null;
    if (!phone && !email) {
      return res.status(400).json({ error: 'No phone or email on file for OTP delivery.' });
    }

    const delivery = method === 'email' ? { email } : method === 'sms' ? { phone } : { phone, email };
    const result = await createAndSendOTP(req.user.user_id, delivery, purpose);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ message: result.message, method: result.method });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP.' });
  }
});

router.post('/verify', authenticate, async (req, res) => {
  try {
    const { otp, purpose } = req.body;
    if (!otp || !purpose) return res.status(400).json({ error: 'OTP and purpose are required.' });

    const result = await verifyOTP(req.user.user_id, otp, purpose);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json({ message: result.message, verified: true });
  } catch (err) {
    res.status(500).json({ error: 'OTP verification failed.' });
  }
});

module.exports = router;
