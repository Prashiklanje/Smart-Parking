const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const {
  normalizeRow,
  normEmail,
  buildSlots,
  parseLayoutRows,
  defaultLayoutMatrix,
  nextId,
  parseWalletBalance
} = require('./csvImport');

async function importOwnersAndParkingPg(pool, bcrypt, csvText, result) {
  const idDb = { __importSeq: 0 };
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  for (const raw of records) {
    const r = normalizeRow(raw);
    try {
      const email = r.owner_email || r.email;
      const password = r.owner_password || r.password;
      const name = r.owner_name || r.name || 'Owner';
      const phone = r.owner_phone || r.phone || '0000000000';
      const areaName = r.parking_area_name || r.area_name || r.parking_name;
      const loc = r.location || r.area_location || '';
      if (!email || !password || !areaName) {
        result.errors.push(`owners_parking: missing owner_email/password or area name — row skipped`);
        continue;
      }

      const emailKey = normEmail(email);
      let ownerRes = await pool.query(
        `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 AND role = 'owner' LIMIT 1`,
        [emailKey]
      );
      let ownerId;
      if (ownerRes.rows.length) {
        ownerId = ownerRes.rows[0].id;
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        ownerId = nextId(idDb);
        await pool.query(
          `INSERT INTO users (id, email, password, role, name, phone, wallet_balance, created_at)
           VALUES ($1,$2,$3,'owner',$4,$5,NULL,NOW())`,
          [ownerId, emailKey, hashedPassword, name, phone]
        );
        result.ownersCreated++;
      }

      const dup = await pool.query(
        `SELECT 1 FROM parking_areas WHERE owner_id = $1 AND LOWER(name) = LOWER($2)`,
        [ownerId, areaName]
      );
      if (dup.rows.length) {
        result.warnings.push(`owners_parking: area "${areaName}" already exists for ${email}, skipped`);
        continue;
      }

      const rowCount = parseInt(r.rows || '3', 10);
      const colCount = parseInt(r.cols || r.columns || '4', 10);
      const entryRow = parseInt(r.entry_row || '0', 10);
      const entryCol = parseInt(r.entry_col || '0', 10);
      const pricePerHour = parseFloat(r.price_per_hour || r.price || '50');

      let layoutMatrix = parseLayoutRows(r.layout_rows, rowCount, colCount, entryRow, entryCol);
      if (!layoutMatrix) {
        layoutMatrix = defaultLayoutMatrix(rowCount, colCount, entryRow, entryCol);
      }

      const vehicleTypes = (r.vehicle_types || 'Car|2-wheeler|SUV|EV')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      const timings = r.timings || '24/7';
      const entryPoint = { row: entryRow, col: entryCol };
      const slots = buildSlots(layoutMatrix, entryPoint);
      const areaId = nextId(idDb);

      await pool.query(
        `INSERT INTO parking_areas (id, owner_id, name, location, layout_matrix, entry_point, slots, total_slots, price_per_hour, vehicle_types, timings, created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb,$11,NOW())`,
        [
          areaId,
          ownerId,
          areaName,
          loc,
          JSON.stringify(layoutMatrix),
          JSON.stringify(entryPoint),
          JSON.stringify(slots),
          slots.length,
          pricePerHour,
          JSON.stringify(vehicleTypes),
          timings
        ]
      );
      result.areasCreated++;
    } catch (e) {
      result.errors.push(`owners_parking: ${e.message}`);
    }
  }
}

async function importUsersAndVehiclesPg(pool, bcrypt, csvText, result) {
  const idDb = { __importSeq: 0 };
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  for (const raw of records) {
    const r = normalizeRow(raw);
    try {
      const email = r.user_email || r.email;
      const password = r.user_password || r.password;
      const name = r.user_name || r.name || 'User';
      const phone = r.user_phone || r.phone || '0000000000';
      const vehicleNumber = (r.vehicle_number || r.vehiclenumber || '').toUpperCase();
      if (!email || !password || !vehicleNumber) {
        result.errors.push(`users_vehicles: missing user_email, password, or vehicle_number — skipped`);
        continue;
      }

      const emailKey = normEmail(email);
      let userRes = await pool.query(
        `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 AND role = 'user' LIMIT 1`,
        [emailKey]
      );
      let userId;
      if (userRes.rows.length) {
        userId = userRes.rows[0].id;
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        userId = nextId(idDb);
        const fromCsv = parseWalletBalance(r);
        const walletBalance = fromCsv != null ? fromCsv : 100 + Math.floor(Math.random() * 900);
        await pool.query(
          `INSERT INTO users (id, email, password, role, name, phone, wallet_balance, created_at)
           VALUES ($1,$2,$3,'user',$4,$5,$6,NOW())`,
          [userId, emailKey, hashedPassword, name, phone, walletBalance]
        );
        result.usersCreated++;
      }

      const vdup = await pool.query(
        `SELECT 1 FROM vehicles WHERE user_id = $1 AND UPPER(vehicle_number) = $2`,
        [userId, vehicleNumber]
      );
      if (vdup.rows.length) {
        result.warnings.push(`users_vehicles: vehicle ${vehicleNumber} already registered for ${email}, skipped`);
        continue;
      }

      const vid = nextId(idDb);
      await pool.query(
        `INSERT INTO vehicles (id, user_id, vehicle_number, vehicle_type, model, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW())`,
        [
          vid,
          userId,
          vehicleNumber,
          r.vehicle_type || r.type || 'Car',
          r.vehicle_model || r.model || ''
        ]
      );
      result.vehiclesCreated++;
    } catch (e) {
      result.errors.push(`users_vehicles: ${e.message}`);
    }
  }
}

async function importBookingsPg(pool, csvText, result) {
  const idDb = { __importSeq: 0 };
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  const areasRes = await pool.query(`SELECT id, name, owner_id, slots FROM parking_areas`);
  const areas = areasRes.rows.map((row) => ({
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    slots: row.slots
  }));

  const vehRes = await pool.query(`SELECT id, user_id, vehicle_number FROM vehicles`);
  const vehiclesByPlate = new Map();
  for (const v of vehRes.rows) {
    vehiclesByPlate.set(v.vehicle_number.toUpperCase(), v);
  }

  for (const raw of records) {
    const r = normalizeRow(raw);
    try {
      const areaName = (r.parking_area || r.area_name || '').replace(/^"|"$/g, '').trim();
      const vehicleNumber = (r.vehicle_number || '').toUpperCase();
      const entryRaw = r.entry_datetime || r.entry_time || r.start_time;
      const exitRaw = r.exit_datetime || r.exit_time || r.end_time;
      if (!areaName || !vehicleNumber || !entryRaw || !exitRaw) {
        result.errors.push(`bookings: missing parking_area, vehicle_number, or times — skipped`);
        continue;
      }

      const ownerEmail = (r.parking_owner_email || r.owner_email || '').toLowerCase();
      let candidates = areas.filter((p) => p.name.toLowerCase() === areaName.toLowerCase());
      if (ownerEmail) {
        const own = await pool.query(
          `SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 AND role = 'owner' LIMIT 1`,
          [ownerEmail]
        );
        if (own.rows.length) {
          const oid = own.rows[0].id;
          candidates = candidates.filter((p) => p.ownerId === oid);
        }
      }
      const area = candidates[0];
      if (!area) {
        result.errors.push(`bookings: parking area "${areaName}" not found — skipped`);
        continue;
      }

      const vehicle = vehiclesByPlate.get(vehicleNumber);
      if (!vehicle) {
        result.errors.push(`bookings: vehicle ${vehicleNumber} not found — skipped`);
        continue;
      }

      const startTime = new Date(entryRaw).toISOString();
      const endTime = new Date(exitRaw).toISOString();
      const startMs = new Date(startTime).getTime();
      const endMs = new Date(endTime).getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
        result.errors.push(`bookings: invalid times for ${vehicleNumber} — skipped`);
        continue;
      }

      const durationMs = endMs - startMs;
      const hours = parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));
      const slotId = area.slots && area.slots.length ? area.slots[0].id : 'A1';

      const totalInr = parseFloat(r.total_inr || r.total || '0');
      const paidStr = (r.payment_status || r.status || 'paid').toLowerCase();
      const isPaid = paidStr === 'paid' || paidStr === '1' || paidStr === 'yes';

      const bookingId = nextId(idDb);
      const importRef = r.booking_id || r.booking_ref || '';

      await pool.query(
        `INSERT INTO bookings (id, user_id, parking_area_id, slot_id, vehicle_id, start_time, end_time, hours, total_price, status,
          payment_status, paid_amount, paid_at, payment_intent_id, imported, import_ref, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'completed',$10,$11,$12,$13,true,$14,$6)`,
        [
          bookingId,
          vehicle.user_id,
          area.id,
          slotId,
          vehicle.id,
          startTime,
          endTime,
          hours,
          totalInr || null,
          isPaid ? 'paid' : 'unpaid',
          isPaid ? totalInr || 0 : null,
          isPaid ? endTime : null,
          isPaid ? `import_${bookingId}` : null,
          importRef
        ]
      );
      result.bookingsCreated++;
    } catch (e) {
      result.errors.push(`bookings: ${e.message}`);
    }
  }
}

async function runThreeFileImportPg(pool, bcrypt, files) {
  const result = {
    ownersCreated: 0,
    areasCreated: 0,
    usersCreated: 0,
    vehiclesCreated: 0,
    bookingsCreated: 0,
    warnings: [],
    errors: []
  };

  if (files.owners_parking) {
    await importOwnersAndParkingPg(pool, bcrypt, files.owners_parking, result);
  }
  if (files.users_vehicles) {
    await importUsersAndVehiclesPg(pool, bcrypt, files.users_vehicles, result);
  }
  if (files.bookings) {
    await importBookingsPg(pool, files.bookings, result);
  }

  return result;
}

async function loadCsvFromDirIfPresentPg(pool, bcrypt, dir, { onlyIfEmpty = true } = {}) {
  if (!dir || !fs.existsSync(dir)) return null;
  if (onlyIfEmpty) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
    if (rows[0].c > 0) {
      return null;
    }
  }

  const files = {};
  const map = [
    ['owners_parking.csv', 'owners_parking'],
    ['users_vehicles.csv', 'users_vehicles'],
    ['bookings.csv', 'bookings']
  ];
  for (const [fname, key] of map) {
    const p = path.join(dir, fname);
    if (fs.existsSync(p)) {
      files[key] = fs.readFileSync(p, 'utf8');
    }
  }
  if (Object.keys(files).length === 0) return null;
  return runThreeFileImportPg(pool, bcrypt, files);
}

module.exports = {
  runThreeFileImportPg,
  loadCsvFromDirIfPresentPg
};
