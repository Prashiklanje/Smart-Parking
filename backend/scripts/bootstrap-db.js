/**
 * One-shot: apply schema.sql + import seed CSVs (only if users table is empty).
 * Run: npm run db:bootstrap
 */
const path = require('path');
const bcrypt = require('bcryptjs');
const { createPool } = require('../db/pool');
const { initSchema } = require('../db/initSchema');
const { loadCsvFromDirIfPresentPg } = require('../csvImportPg');

const SEED_DATA_DIR = path.join(__dirname, '..', '..', 'data', 'seed');

async function main() {
  const pool = createPool();
  if (!pool) {
    console.error('Set PG_DATABASE in backend/.env');
    process.exit(1);
  }
  try {
    console.log('Applying schema (CREATE IF NOT EXISTS)...');
    await initSchema(pool);
    console.log('Schema ready.');

    const summary = await loadCsvFromDirIfPresentPg(pool, bcrypt, SEED_DATA_DIR);
    if (summary) {
      console.log(
        'Seed import OK:',
        JSON.stringify({
          ownersCreated: summary.ownersCreated,
          areasCreated: summary.areasCreated,
          usersCreated: summary.usersCreated,
          vehiclesCreated: summary.vehiclesCreated,
          bookingsCreated: summary.bookingsCreated,
          warnings: summary.warnings.length,
          errors: summary.errors.length
        })
      );
      if (summary.errors.length) {
        console.error('Seed errors (first 15):', summary.errors.slice(0, 15));
        process.exitCode = 1;
      }
    } else {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
      if (rows[0].c > 0) {
        console.log(
          'Seed skipped: users table already has data (normal after first bootstrap).'
        );
      } else {
        console.warn(
          `No rows imported. Put owners_parking.csv, users_vehicles.csv, bookings.csv in ${SEED_DATA_DIR}`
        );
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
