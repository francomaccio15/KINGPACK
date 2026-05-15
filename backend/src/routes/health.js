const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    res.json({
      status: 'ok',
      db: r.rows[0].ok === 1 ? 'up' : 'unknown',
      uptime_s: Math.round(process.uptime()),
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', error: err.message });
  }
});

module.exports = router;
