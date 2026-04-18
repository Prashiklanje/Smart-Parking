const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function createPool() {
  const database = process.env.PG_DATABASE || process.env.PGDATABASE;
  if (!database) {
    return null;
  }
  return new Pool({
    user: process.env.PG_USER || process.env.PGUSER || 'postgres',
    host: process.env.PG_HOST || process.env.PGHOST || 'localhost',
    database,
    password: process.env.PG_PASSWORD || process.env.PGPASSWORD || '',
    port: parseInt(process.env.PG_PORT || process.env.PGPORT || '5432', 10)
  });
}

module.exports = { createPool };
