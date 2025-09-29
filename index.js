require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 20
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('frontend')); // Sirve los archivos del frontend

// Normaliza fechas aceptando 'YYYY-MM-DD' o 'DD/MM/YYYY' (devuelve 'YYYY-MM-DD' o null)
function normalizeDateParam(str) {
  if (!str) return null;
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m}-${d}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

// parseRange usa normalizeDateParam y devuelve start,end,tipo (start/end en ISO YYYY-MM-DD o null)
function parseRange(req) {
  const startRaw = req.query.start || null;
  const endRaw = req.query.end || null;
  let start = normalizeDateParam(startRaw);
  let end = normalizeDateParam(endRaw);
  const tipo = req.query.tipo || null;

  // Si start > end, intercambiar para evitar consulta vacía
  if (start && end && start > end) {
    const temp = start;
    start = end;
    end = temp;
  }

  return { start, end, tipo };
}

/* ... Resto de endpoints sin cambios ... */

/* 6) Endpoint para datos crudos (para cross-filtering) */
app.get('/api/data', async (req, res) => {
  const { start, end } = parseRange(req);
  console.log("API /api/data - start:", start, "end:", end); // Log para depuración

  const params = [];
  const conditions = [];

  if (start) {
    params.push(start);
    conditions.push(`fecha::date >= $${params.length}::date`);
  }
  if (end) {
    params.push(end);
    conditions.push(`fecha::date <= $${params.length}::date`);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const sql = `
    SELECT fecha, tipo_busqueda, criterio_texto
    FROM busquedas_clasificadas_v2
    ${where}
    ORDER BY fecha DESC;
  `;

  try {
    const { rows } = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('Error en la consulta /api/data:', err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));

