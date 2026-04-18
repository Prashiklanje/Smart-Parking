const fs = require('fs');
const path = require('path');

const cities = [
  { city: 'Mumbai', mall: 'Palladium Mall Lower Parel' },
  { city: 'Pune', mall: 'Phoenix Marketcity Pune' },
  { city: 'Bangalore', mall: 'Orion Mall Rajajinagar' }
];

const anchors = [
  10, 9, 8, 7, 8, 9, 12, 16, 24, 28, 33, 45, 52, 56, 58, 62, 65, 78, 92, 99, 98, 82, 76, 12
];

function smooth(a) {
  const o = [];
  for (let h = 0; h < 24; h++) {
    const p = a[(h + 23) % 24];
    const c = a[h];
    const n = a[(h + 1) % 24];
    o.push((p + c + n) / 3);
  }
  return o;
}

const base = smooth(anchors);

function dowMult(d) {
  if (d >= 1 && d <= 4) return 0.75;
  if (d === 5) return 0.9;
  if (d === 6) return 1.2;
  return 1.1;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const rows = [];
const dayAgg = [];

for (let di = 0; di < 7; di++) {
  const t = Date.UTC(2026, 2, 23 + di, 12, 0, 0);
  const d = new Date(t);
  const dow = d.getUTCDay();
  const iso = d.toISOString().slice(0, 10);

  for (const c of cities) {
    let maxV = 0;
    for (let h = 0; h < 24; h++) {
      const seed = di * 10000 + h * 100 + c.city.charCodeAt(0) * 7 + c.city.length * 13;
      const rng = mulberry32(seed);
      const r1 = rng();
      const r2 = rng();
      const noiseAmp = 5 + r1 * 5;
      const noise = (r2 - 0.5) * 2 * noiseAmp;
      let v = base[h] * dowMult(dow);
      if (c.city === 'Mumbai') v += 5;
      if (c.city === 'Bangalore') {
        if (h >= 19 && h <= 22) v += 6;
        if (h >= 17 && h <= 18) v -= 1;
      }
      if (c.city === 'Pune' && h >= 11 && h <= 16) v += 6;
      v += noise;
      const night = h >= 23 || h <= 7;
      if (night) {
        const cap = dow === 6 || dow === 0 ? 15 + r1 * 4 : 12 + r1 * 3;
        v = Math.min(v, cap);
      }
      v = Math.max(0, Math.min(100, Math.round(v * 10) / 10));
      maxV = Math.max(maxV, v);
      rows.push({ c, iso, dowName: days[dow], dow, h, v });
    }
    dayAgg.push({ key: `${c.city}|${iso}`, maxV, dow });
  }
}

const peakDayMap = {};
for (const p of dayAgg) {
  peakDayMap[p.key] = p.dow === 6 || (p.dow === 0 && p.maxV >= 88);
}

function esc(s) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const lines = [
  'city,mall_name,date,day_of_week,hour_ist,occupancy_pct,is_peak_hour,is_peak_day'
];
for (const r of rows) {
  const key = `${r.c.city}|${r.iso}`;
  const isPeakDay = peakDayMap[key];
  const isPeakHr = r.v >= 85;
  lines.push(
    [
      r.c.city,
      esc(r.c.mall),
      r.iso,
      r.dowName,
      r.h,
      r.v.toFixed(1),
      isPeakHr ? 'TRUE' : 'FALSE',
      isPeakDay ? 'TRUE' : 'FALSE'
    ].join(',')
  );
}

const outPath = path.join(__dirname, '..', 'data', 'mall-parking-occupancy-metros.csv');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
