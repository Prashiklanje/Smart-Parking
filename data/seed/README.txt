AUTO-SEED CSVs (loaded every time the backend starts)
=====================================================

Files (processed in this order):
  1. owners_parking.csv  — parking owners + one row per lot (layouts, prices)
  2. users_vehicles.csv   — parking users + one row per vehicle
  3. bookings.csv       — completed sessions (for analytics: weekends, evenings)

Regenerate all three from the repo root:
  node scripts/generate-seed-csvs.js

Example logins after seed (role must match):
  Parking Owner:  arjun.mehta@seed.local / SeedOwner1!
  Parking User:   driver1@seed.local / UserSeed#2026

All in-memory data is cleared when the server stops; restarting re-runs this seed.
