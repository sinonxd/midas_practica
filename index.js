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
  const start = normalizeDateParam(startRaw);
  const end = normalizeDateParam(endRaw);
  const tipo = req.query.tipo || null;
  return { start, end, tipo };
}

/* 1) Monthly + promedio */
app.get('/api/monthly', async (req, res) => {
  const { start, end, tipo } = parseRange(req);
  const params = [];
  let where = 'WHERE 1=1';
  if (start) { params.push(start); where += ` AND fecha::date >= $${params.length}::date`; }
  if (end)   { params.push(end);   where += ` AND fecha::date <= $${params.length}::date`; }
  if (tipo)  { params.push(tipo);  where += ` AND tipo_busqueda = $${params.length}`; }

  const sql = `
    WITH resumen AS (
      SELECT date_trunc('month', fecha::timestamp) AS mes, COUNT(*) AS total
      FROM busquedas_clasificadas_v2
      ${where}
      GROUP BY 1
    )
    SELECT to_char(mes,'YYYY-MM') AS mes, EXTRACT(YEAR FROM mes)::int AS anio,
           EXTRACT(MONTH FROM mes)::int AS mes_num, total
    FROM resumen
    ORDER BY mes;
  `;
  try {
    const { rows } = await pool.query(sql, params);

    const avgSql = `
      SELECT ROUND(AVG(total))::int AS promedio FROM (
        SELECT COUNT(*) AS total
        FROM busquedas_clasificadas_v2
        ${where}
        GROUP BY date_trunc('month', fecha::timestamp)
      ) s;
    `;
    const avgRes = await pool.query(avgSql, params);
    const promedio = (avgRes.rows[0] && avgRes.rows[0].promedio) || 0;

    res.json({ data: rows, promedio });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* 2) Hourly */
app.get('/api/hourly', async (req, res) => {
  const { start, end, tipo } = parseRange(req);
  const params = []; let where = 'WHERE 1=1';
  if (start) { params.push(start); where += ` AND fecha::date >= $${params.length}::date`; }
  if (end)   { params.push(end);   where += ` AND fecha::date <= $${params.length}::date`; }
  if (tipo)  { params.push(tipo);  where += ` AND tipo_busqueda = $${params.length}`; }

  const sql = `
    SELECT EXTRACT(HOUR FROM fecha::timestamp)::int AS hour, COUNT(*) AS total
    FROM busquedas_clasificadas_v2
    ${where}
    GROUP BY 1
    ORDER BY 1;
  `;
  try {
    const { rows } = await pool.query(sql, params);
    const all = Array.from({length:24}, (_,i)=>({hour:i,total:0}));
    rows.forEach(r => { all[parseInt(r.hour,10)].total = parseInt(r.total,10); });
    res.json({ data: all });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

/* 3) Day of week */
app.get('/api/dow', async (req, res) => {
  const { start, end, tipo } = parseRange(req);
  const params = []; let where = 'WHERE 1=1';
  if (start) { params.push(start); where += ` AND fecha::date >= $${params.length}::date`; }
  if (end)   { params.push(end);   where += ` AND fecha::date <= $${params.length}::date`; }
  if (tipo)  { params.push(tipo);  where += ` AND tipo_busqueda = $${params.length}`; }

  const sql = `
    SELECT EXTRACT(DOW FROM fecha::timestamp)::int AS dow, COUNT(*) AS total
    FROM busquedas_clasificadas_v2
    ${where}
    GROUP BY 1
    ORDER BY 1;
  `;
  try {
    const { rows } = await pool.query(sql, params);
    const names = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const out = rows.map(r => ({ dow: r.dow, dia: names[r.dow], total: parseInt(r.total,10) }));
    const order = [1,2,3,4,5,6,0];
    const result = order.map(i => {
      const f = out.find(x=>x.dow==i);
      return f ? f : { dow: i, dia: names[i], total: 0 };
    });
    res.json({ data: result });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

/* 4) Types */
app.get('/api/types', async (req, res) => {
  const { start, end } = parseRange(req);
  const params = []; let where = 'WHERE 1=1';
  if (start) { params.push(start); where += ` AND fecha::date >= $${params.length}::date`; }
  if (end)   { params.push(end);   where += ` AND fecha::date <= $${params.length}::date`; }

  const sql = `
    SELECT COALESCE(tipo_busqueda,'sin informacion') AS tipo_busqueda, COUNT(*)::int AS total
    FROM busquedas_clasificadas_v2
    ${where}
    GROUP BY tipo_busqueda
    ORDER BY total DESC;
  `;
  try {
    const { rows } = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

/* 5) Sample rows */
app.get('/api/sample', async (req, res) => {
  const { start, end, tipo } = parseRange(req);
  const limit = parseInt(req.query.limit || '200', 10);
  const params = []; let where = 'WHERE 1=1';
  if (start) { params.push(start); where += ` AND fecha::date >= $${params.length}::date`; }
  if (end)   { params.push(end);   where += ` AND fecha::date <= $${params.length}::date`; }
  if (tipo)  { params.push(tipo);  where += ` AND tipo_busqueda = $${params.length}`; }

  const sql = `
    SELECT id, fecha, tipo_busqueda, criterio_texto
    FROM busquedas_clasificadas_v2
    ${where}
    ORDER BY fecha::timestamp DESC
    LIMIT ${limit};
  `;
  try {
    const { rows } = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

/* 6) Endpoint para datos crudos (para cross-filtering) */
app.get('/api/data', async (req, res) => {
  const { start, end } = parseRange(req);
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
    SELECT fecha, tipo_busqueda
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

