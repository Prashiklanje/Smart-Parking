/**
 * Generates data/seed/owners_parking.csv, users_vehicles.csv, bookings.csv
 * Run from repo root: node scripts/generate-seed-csvs.js
 */
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'data', 'seed');
fs.mkdirSync(outDir, { recursive: true });

function esc(cell) {
  const s = cell == null ? '' : String(cell);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(cells) {
  return cells.map(esc).join(',');
}

// --- 1) Owners + parking (different layouts) ---
const OWNERS = [
  {
    email: 'arjun.mehta@seed.local',
    password: 'SeedOwner1!',
    name: 'Arjun Mehta',
    phone: '9800000001',
    areas: [
      {
        name: 'Phoenix East Wing',
        location: 'Viman Nagar Pune',
        price: 55,
        rows: 3,
        cols: 4,
        er: 0,
        ec: 0,
        layout: '',
        types: 'Car|2-wheeler|SUV|EV'
      },
      {
        name: 'Phoenix West Wing',
        location: 'Viman Nagar Pune',
        price: 52,
        rows: 3,
        cols: 5,
        er: 0,
        ec: 0,
        layout: '0,1,1,1,1|1,1,1,1,1|1,1,1,1,1',
        types: 'Car|2-wheeler|SUV|EV'
      }
    ]
  },
  {
    email: 'priya.kulkarni@seed.local',
    password: 'SeedOwner2!',
    name: 'Priya Kulkarni',
    phone: '9800000002',
    areas: [
      {
        name: 'Riverfront P1',
        location: 'BKC Mumbai',
        price: 68,
        rows: 4,
        cols: 4,
        er: 0,
        ec: 0,
        layout: '0,1,1,1|1,1,1,1|1,1,0,1|1,1,1,1',
        types: 'Car|SUV|EV'
      },
      {
        name: 'Riverfront P2',
        location: 'BKC Mumbai',
        price: 62,
        rows: 3,
        cols: 4,
        er: 0,
        ec: 0,
        layout: '',
        types: 'Car|2-wheeler|SUV'
      }
    ]
  },
  {
    email: 'vikram.reddy@seed.local',
    password: 'SeedOwner3!',
    name: 'Vikram Reddy',
    phone: '9800000003',
    areas: [
      {
        name: 'Tech Park North',
        location: 'Hitech City Hyderabad',
        price: 48,
        rows: 4,
        cols: 5,
        er: 1,
        ec: 0,
        layout: '1,1,1,1,1|0,1,1,1,1|1,1,1,1,1|1,1,1,1,1',
        types: 'Car|SUV|EV|2-wheeler'
      },
      {
        name: 'Tech Park South',
        location: 'Hitech City Hyderabad',
        price: 45,
        rows: 3,
        cols: 6,
        er: 0,
        ec: 2,
        layout: '1,1,0,1,1,1|1,1,1,1,1,1|1,1,1,1,1,1',
        types: 'Car|2-wheeler|SUV|EV'
      }
    ]
  },
  {
    email: 'deepa.nair@seed.local',
    password: 'SeedOwner4!',
    name: 'Deepa Nair',
    phone: '9800000004',
    areas: [
      {
        name: 'Orion Mall Deck',
        location: 'Whitefield Bengaluru',
        price: 58,
        rows: 3,
        cols: 4,
        er: 0,
        ec: 0,
        layout: '',
        types: 'Car|SUV|EV'
      },
      {
        name: 'Orion Mall Basement',
        location: 'Whitefield Bengaluru',
        price: 50,
        rows: 4,
        cols: 4,
        er: 2,
        ec: 2,
        layout: '1,1,1,1|1,1,1,1|1,1,0,1|1,1,1,1',
        types: 'Car|2-wheeler|SUV|EV'
      }
    ]
  },
  {
    email: 'manish.gupta@seed.local',
    password: 'SeedOwner5!',
    name: 'Manish Gupta',
    phone: '9800000005',
    areas: [
      {
        name: 'City Centre Alpha',
        location: 'Connaught Place Delhi',
        price: 72,
        rows: 3,
        cols: 5,
        er: 0,
        ec: 0,
        layout: '0,1,1,1,1|1,1,1,1,1|1,1,1,1,1',
        types: 'Car|SUV|EV'
      },
      {
        name: 'City Centre Beta',
        location: 'Connaught Place Delhi',
        price: 65,
        rows: 5,
        cols: 4,
        er: 0,
        ec: 0,
        layout: '0,1,1,1|1,1,1,1|1,1,1,1|1,1,1,1|1,1,1,1',
        types: 'Car|2-wheeler|SUV|EV'
      }
    ]
  }
];

const ownersLines = [
  row([
    'owner_email',
    'owner_password',
    'owner_name',
    'owner_phone',
    'parking_area_name',
    'location',
    'price_per_hour',
    'rows',
    'cols',
    'entry_row',
    'entry_col',
    'layout_rows',
    'vehicle_types',
    'timings'
  ])
];

const areasMeta = [];

for (const o of OWNERS) {
  for (const a of o.areas) {
    ownersLines.push(
      row([
        o.email,
        o.password,
        o.name,
        o.phone,
        a.name,
        a.location,
        a.price,
        a.rows,
        a.cols,
        a.er,
        a.ec,
        a.layout || '',
        a.types,
        '24/7'
      ])
    );
    areasMeta.push({
      name: a.name,
      ownerEmail: o.email,
      price: a.price
    });
  }
}

fs.writeFileSync(path.join(outDir, 'owners_parking.csv'), ownersLines.join('\n'), 'utf8');

// --- 2) Users + vehicles (some users have 2 vehicles) ---
const USER_PASS = 'UserSeed#2026';
const userRows = [
  row([
    'user_email',
    'user_password',
    'user_name',
    'user_phone',
    'vehicle_number',
    'vehicle_type',
    'vehicle_model',
    'wallet_balance'
  ])
];

const vehiclesList = [];
const prefixes = ['MH12', 'KA03', 'DL8C', 'TS09', 'GJ01', 'TN07', 'KL07'];
let vid = 0;
for (let i = 1; i <= 42; i++) {
  const email = `driver${i}@seed.local`;
  const name = `Driver ${i}`;
  const phone = `98765${String(100000 + i).slice(-6)}`;
  const walletBalance = 100 + ((i * 7919 + 17) % 900);
  const nVeh = i % 8 === 0 ? 2 : 1;
  for (let v = 0; v < nVeh; v++) {
    vid++;
    const p = prefixes[vid % prefixes.length];
    const plate = `${p}SE${String(vid).padStart(3, '0')}`;
    const type = v === 0 ? (i % 5 === 0 ? 'SUV' : i % 7 === 0 ? '2-wheeler' : 'Car') : 'Car';
    const model = type === '2-wheeler' ? 'Activa' : type === 'SUV' ? 'XUV700' : 'City';
    userRows.push(row([email, USER_PASS, name, phone, plate, type, model, String(walletBalance)]));
    vehiclesList.push({ plate, ownerEmail: email, priceHint: 55 });
  }
}

fs.writeFileSync(path.join(outDir, 'users_vehicles.csv'), userRows.join('\n'), 'utf8');

// --- 3) Large bookings (weekend + evening peaks) ---
let seed = 20260328;
function rnd() {
  seed = (seed * 1103515245 + 12345) >>> 0;
  return seed / 4294967296;
}

function pickArea() {
  return areasMeta[Math.floor(rnd() * areasMeta.length)];
}

function pickVehicle() {
  return vehiclesList[Math.floor(rnd() * vehiclesList.length)];
}

function roughTotalInr(minutes, pricePerHour) {
  const h = minutes / 60;
  let mult = 1;
  if (h > 24) mult = 0.8;
  else if (h > 12) mult = 0.9;
  const base = h * pricePerHour * mult;
  const gst = base * 0.18;
  return Math.round((base + gst) * 100) / 100;
}

const bookingHeader = row([
  'booking_id',
  'parking_area',
  'vehicle_number',
  'entry_datetime',
  'exit_datetime',
  'duration_minutes',
  'total_inr',
  'payment_status',
  'parking_owner_email'
]);

const bookingLines = [bookingHeader];

// Jan 1 - Mar 28 2026
const t0 = new Date('2026-01-01T00:00:00.000Z').getTime();
const t1 = new Date('2026-03-28T23:59:59.000Z').getTime();
const span = t1 - t0;

for (let n = 1; n <= 1400; n++) {
  let dayMs = t0 + Math.floor(rnd() * span);
  const d = new Date(dayMs);
  const dow = d.getUTCDay();

  // Bias: ~40% weekend, ~42% weekday evening band, rest scattered
  const roll = rnd();
  let hourUTC;
  if (dow === 0 || dow === 6) {
    if (roll < 0.4) {
      hourUTC = 12 + Math.floor(rnd() * 11);
    } else if (roll < 0.75) {
      hourUTC = 17 + Math.floor(rnd() * 5);
    } else {
      hourUTC = 8 + Math.floor(rnd() * 14);
    }
  } else {
    if (roll < 0.45) {
      hourUTC = 17 + Math.floor(rnd() * 5);
    } else if (roll < 0.65) {
      hourUTC = 8 + Math.floor(rnd() * 4);
    } else {
      hourUTC = 11 + Math.floor(rnd() * 10);
    }
  }

  const min = Math.floor(rnd() * 60);
  const sec = Math.floor(rnd() * 60);
  const entry = new Date(Date.UTC(2026, d.getUTCMonth(), d.getUTCDate(), hourUTC, min, sec));
  const durMin = 25 + Math.floor(rnd() * 280);
  const exit = new Date(entry.getTime() + durMin * 60000);

  const area = pickArea();
  const veh = pickVehicle();
  const total = roughTotalInr(durMin, area.price);

  bookingLines.push(
    row([
      `SB${String(n).padStart(5, '0')}`,
      area.name,
      veh.plate,
      entry.toISOString(),
      exit.toISOString(),
      durMin,
      total,
      'paid',
      area.ownerEmail
    ])
  );
}

fs.writeFileSync(path.join(outDir, 'bookings.csv'), bookingLines.join('\n'), 'utf8');

console.log('Wrote seed CSVs to', outDir);
console.log('  owners_parking.csv:', OWNERS.length, 'owners,', areasMeta.length, 'lots');
console.log('  users_vehicles.csv:', userRows.length - 1, 'vehicle rows');
console.log('  bookings.csv:', bookingLines.length - 1, 'bookings');
