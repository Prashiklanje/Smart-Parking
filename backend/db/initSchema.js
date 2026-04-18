const fs = require('fs');
const path = require('path');

async function initSchema(pool) {
  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
}

module.exports = { initSchema };
