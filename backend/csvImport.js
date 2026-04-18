const { parse } = require('csv-parse/sync');

function normEmail(e) {
  return String(e || '')
    .trim()
    .toLowerCase();
}

function normalizeRow(row) {
  const o = {};
  for (const k of Object.keys(row)) {
    const nk = k.trim().toLowerCase().replace(/\s+/g, '_');
    const v = row[k];
    o[nk] = v == null ? '' : String(v).trim();
  }
  return o;
}

function nextId(db) {
  db.__importSeq = (db.__importSeq || 0) + 1;
  return `${Date.now()}_${db.__importSeq}`;
}

function calculateShortestPaths(layoutMatrix, entryPoint) {
  const rows = layoutMatrix.length;
  const cols = layoutMatrix[0].length;
  const distances = Array(rows)
    .fill()
    .map(() => Array(cols).fill(Infinity));
  const queue = [];
  distances[entryPoint.row][entryPoint.col] = 0;
  queue.push({ row: entryPoint.row, col: entryPoint.col, dist: 0 });
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const [dr, dc] of directions) {
      const newRow = current.row + dr;
      const newCol = current.col + dc;
      if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
        if (
          (layoutMatrix[newRow][newCol] === 0 || layoutMatrix[newRow][newCol] === 1) &&
          distances[newRow][newCol] === Infinity
        ) {
          distances[newRow][newCol] = current.dist + 1;
          queue.push({ row: newRow, col: newCol, dist: current.dist + 1 });
        }
      }
    }
  }
  return distances;
}

function buildSlots(layoutMatrix, entryPoint) {
  const distances = calculateShortestPaths(layoutMatrix, entryPoint);
  const slots = [];
  const rows = layoutMatrix.length;
  const cols = layoutMatrix[0].length;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (layoutMatrix[i][j] === 1) {
        slots.push({
          id: `${String.fromCharCode(65 + i)}${j + 1}`,
          row: i,
          col: j,
          status: 'available',
          distance: distances[i][j],
          bookings: []
        });
      }
    }
  }
  slots.sort((a, b) => a.distance - b.distance);
  return slots;
}

function parseLayoutRows(layoutRowsStr, rows, cols, entryRow, entryCol) {
  if (!layoutRowsStr) return null;
  const lineRows = layoutRowsStr.split('|').map((r) => r.trim());
  if (lineRows.length !== rows) {
    throw new Error(`layout_rows has ${lineRows.length} rows but rows=${rows}`);
  }
  const matrix = [];
  for (let i = 0; i < rows; i++) {
    const cells = lineRows[i].split(',').map((c) => parseInt(c.trim(), 10));
    if (cells.length !== cols) {
      throw new Error(`layout_rows row ${i} expected ${cols} cells`);
    }
    for (const c of cells) {
      if (c !== 0 && c !== 1) throw new Error('layout must use 0 (path) or 1 (slot)');
    }
    matrix.push(cells);
  }
  if (matrix[entryRow][entryCol] !== 0) {
    throw new Error('Entry cell must be 0 (path) in layout_rows');
  }
  return matrix;
}

function defaultLayoutMatrix(rows, cols, entryRow, entryCol) {
  const m = Array(rows)
    .fill()
    .map(() => Array(cols).fill(1));
  m[entryRow][entryCol] = 0;
  return m;
}

/**
 * File 2: owners + parking structure (one row per parking area).
 * Columns: owner_email, owner_password, owner_name, owner_phone, parking_area_name, location,
 *          price_per_hour, rows, cols, entry_row, entry_col, layout_rows (optional), vehicle_types (optional pipe|sep), timings (optional)
 */
async function importOwnersAndParking(db, bcrypt, csvText, result) {
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
      const location = r.location || r.area_location || '';
      if (!email || !password || !areaName) {
        result.errors.push(`owners_parking: missing owner_email/password or area name — row skipped`);
        continue;
      }

      const emailKey = normEmail(email);
      let owner = db.users.find((u) => normEmail(u.email) === emailKey && u.role === 'owner');
      if (!owner) {
        const hashedPassword = await bcrypt.hash(password, 10);
        owner = {
          id: nextId(db),
          email: emailKey,
          password: hashedPassword,
          role: 'owner',
          name,
          phone,
          createdAt: new Date()
        };
        db.users.push(owner);
        result.ownersCreated++;
      }

      const exists = db.parkingAreas.find(
        (p) => p.ownerId === owner.id && p.name.toLowerCase() === areaName.toLowerCase()
      );
      if (exists) {
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

      const parkingArea = {
        id: nextId(db),
        ownerId: owner.id,
        name: areaName,
        location,
        layoutMatrix,
        entryPoint,
        slots,
        totalSlots: slots.length,
        pricePerHour,
        vehicleTypes,
        timings,
        createdAt: new Date()
      };
      db.parkingAreas.push(parkingArea);
      result.areasCreated++;
    } catch (e) {
      result.errors.push(`owners_parking: ${e.message}`);
    }
  }
}

function parseWalletBalance(r) {
  const raw =
    r.wallet_balance ??
    r.user_wallet ??
    r.wallet_inr ??
    r.wallet ??
    '';
  const n = parseFloat(String(raw).replace(/,/g, '').trim());
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(999, Math.max(100, Math.round(n)));
  return clamped;
}

/**
 * File 1: users + vehicles (one row per vehicle).
 * Columns: user_email, user_password, user_name, user_phone, vehicle_number, vehicle_type, vehicle_model (optional),
 *          wallet_balance (optional, INR whole number; if missing, random 100–999 at first import for that user)
 */
async function importUsersAndVehicles(db, bcrypt, csvText, result) {
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
      let user = db.users.find((u) => normEmail(u.email) === emailKey && u.role === 'user');
      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const fromCsv = parseWalletBalance(r);
        const walletBalance =
          fromCsv != null
            ? fromCsv
            : 100 + Math.floor(Math.random() * 900);
        user = {
          id: nextId(db),
          email: emailKey,
          password: hashedPassword,
          role: 'user',
          name,
          phone,
          walletBalance,
          createdAt: new Date()
        };
        db.users.push(user);
        result.usersCreated++;
      }

      const exists = db.vehicles.find(
        (v) => v.vehicleNumber === vehicleNumber && v.userId === user.id
      );
      if (exists) {
        result.warnings.push(`users_vehicles: vehicle ${vehicleNumber} already registered for ${email}, skipped`);
        continue;
      }

      const vehicle = {
        id: nextId(db),
        userId: user.id,
        vehicleNumber,
        vehicleType: r.vehicle_type || r.type || 'Car',
        model: r.vehicle_model || r.model || '',
        createdAt: new Date()
      };
      db.vehicles.push(vehicle);
      result.vehiclesCreated++;
    } catch (e) {
      result.errors.push(`users_vehicles: ${e.message}`);
    }
  }
}

/**
 * File 3: booking / session history (analytics style).
 * Columns: booking_id (optional), parking_area, vehicle_number, entry_datetime, exit_datetime,
 *          parking_owner_email (optional), user_email (optional), total_inr, base_fare_inr (optional), gst_18pct_inr (optional),
 *          payment_status (optional: paid|unpaid), duration_minutes (optional)
 */
function importBookings(db, csvText, result) {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

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
      let candidates = db.parkingAreas.filter((p) => p.name.toLowerCase() === areaName.toLowerCase());
      if (ownerEmail) {
        const owner = db.users.find(
          (u) => u.email.toLowerCase() === ownerEmail && u.role === 'owner'
        );
        if (owner) {
          candidates = candidates.filter((p) => p.ownerId === owner.id);
        }
      }
      const area = candidates[0];
      if (!area) {
        result.errors.push(`bookings: parking area "${areaName}" not found — skipped`);
        continue;
      }

      const vehicle = db.vehicles.find((v) => v.vehicleNumber === vehicleNumber);
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
      const slotId = area.slots.length ? area.slots[0].id : 'A1';

      const totalInr = parseFloat(r.total_inr || r.total || '0');
      const paidStr = (r.payment_status || r.status || 'paid').toLowerCase();
      const isPaid = paidStr === 'paid' || paidStr === '1' || paidStr === 'yes';

      const bookingId = nextId(db);
      const booking = {
        id: bookingId,
        userId: vehicle.userId,
        parkingAreaId: area.id,
        slotId,
        vehicleId: vehicle.id,
        startTime,
        endTime,
        hours,
        totalPrice: totalInr || null,
        status: 'completed',
        paymentStatus: isPaid ? 'paid' : 'unpaid',
        paidAmount: isPaid ? totalInr || 0 : undefined,
        paidAt: isPaid ? endTime : undefined,
        paymentIntentId: isPaid ? `import_${bookingId}` : undefined,
        imported: true,
        importRef: r.booking_id || r.booking_ref || '',
        createdAt: new Date(startTime)
      };
      db.bookings.push(booking);
      result.bookingsCreated++;
    } catch (e) {
      result.errors.push(`bookings: ${e.message}`);
    }
  }
}

async function runThreeFileImport(db, bcrypt, files) {
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
    await importOwnersAndParking(db, bcrypt, files.owners_parking, result);
  }
  if (files.users_vehicles) {
    await importUsersAndVehicles(db, bcrypt, files.users_vehicles, result);
  }
  if (files.bookings) {
    importBookings(db, files.bookings, result);
  }

  return result;
}

async function loadCsvFromDirIfPresent(db, bcrypt, dir) {
  const fs = require('fs');
  const path = require('path');
  if (!dir || !fs.existsSync(dir)) return null;
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
  return runThreeFileImport(db, bcrypt, files);
}

module.exports = {
  runThreeFileImport,
  loadCsvFromDirIfPresent,
  normalizeRow,
  normEmail,
  calculateShortestPaths,
  buildSlots,
  parseLayoutRows,
  defaultLayoutMatrix,
  nextId,
  parseWalletBalance
};
