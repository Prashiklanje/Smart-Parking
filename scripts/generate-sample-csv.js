const fs = require('fs');
const path = require('path');

const areas = [
  'Phoenix Mall Pune',
  'Orion Mall Bengaluru',
  'High Street Mumbai',
  'City Centre Delhi',
  'Inorbit Hyderabad'
];
const vehicles = [
  'MH12AB1234',
  'KA03MN4455',
  'DL8CAX9012',
  'TS09GH7788',
  'GJ01KL3344',
  'MH14PQ2211',
  'KA01RS8899',
  'DL2CAW5566'
];
const bands = {
  morning: [8, 9, 10, 11],
  midday: [12, 13, 14],
  evening: [17, 18, 19, 20, 21],
  night: [22, 23]
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

const rows = [];
rows.push(
  [
    'booking_id',
    'parking_area',
    'vehicle_number',
    'user_type',
    'entry_datetime',
    'exit_datetime',
    'duration_minutes',
    'day_of_week',
    'entry_hour',
    'is_weekend',
    'traffic_profile',
    'base_fare_inr',
    'gst_18pct_inr',
    'total_inr'
  ].join(',')
);

let id = 1;
for (let d = 1; d <= 14; d++) {
  const date = new Date(2026, 2, d);
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const n = weekend ? randInt(18, 28) : randInt(8, 16);

  for (let k = 0; k < n; k++) {
    let hourPool;
    let profile;
    if (weekend) {
      hourPool = [
        ...bands.morning,
        ...bands.midday,
        ...bands.evening,
        15,
        16,
        12
      ];
      profile = pick(['weekend_high', 'weekend_shopping', 'weekend_peak']);
    } else {
      const r = Math.random();
      if (r < 0.45) {
        hourPool = bands.evening;
        profile = 'weekday_evening_peak';
      } else if (r < 0.7) {
        hourPool = bands.morning;
        profile = 'weekday_morning';
      } else {
        hourPool = bands.midday;
        profile = 'weekday_midday';
      }
    }
    const eh = pick(hourPool);
    const em = randInt(0, 59);
    const entry = new Date(2026, 2, d, eh, em, randInt(0, 59));
    const dur = randInt(25, 220);
    const exit = new Date(entry.getTime() + dur * 60000);
    const rate = 50;
    const base = (dur / 60) * rate;
    const mult = dur / 60 > 24 ? 0.8 : dur / 60 > 12 ? 0.9 : 1;
    const afterDisc = base * mult;
    const gst = afterDisc * 0.18;
    const total = +(afterDisc + gst).toFixed(2);

    rows.push(
      [
        `BK${String(id++).padStart(5, '0')}`,
        `"${pick(areas)}"`,
        pick(vehicles),
        pick(['regular', 'office_commuter', 'visitor']),
        entry.toISOString(),
        exit.toISOString(),
        dur,
        dow,
        eh,
        weekend ? 'yes' : 'no',
        profile,
        +base.toFixed(2),
        +gst.toFixed(2),
        total
      ].join(',')
    );
  }
}

const out = path.join(__dirname, '..', 'data', 'sample-parking-analytics-dataset.csv');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, rows.join('\n'), 'utf8');
console.log('Wrote', rows.length - 1, 'rows to', out);
