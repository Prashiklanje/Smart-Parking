function rowToUser(r) {
  if (!r) return null;
  const u = {
    id: r.id,
    email: r.email,
    password: r.password,
    role: r.role,
    name: r.name,
    phone: r.phone,
    createdAt: r.created_at
  };
  if (r.wallet_balance != null) u.walletBalance = parseFloat(r.wallet_balance);
  return u;
}

function rowToArea(r) {
  if (!r) return null;
  return {
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    location: r.location,
    layoutMatrix: r.layout_matrix,
    entryPoint: r.entry_point,
    slots: r.slots,
    totalSlots: r.total_slots,
    pricePerHour: parseFloat(r.price_per_hour),
    vehicleTypes: r.vehicle_types,
    timings: r.timings,
    createdAt: r.created_at
  };
}

function rowToVehicle(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    vehicleNumber: r.vehicle_number,
    vehicleType: r.vehicle_type,
    model: r.model,
    createdAt: r.created_at
  };
}

function rowToBooking(r) {
  if (!r) return null;
  const b = {
    id: r.id,
    userId: r.user_id,
    parkingAreaId: r.parking_area_id,
    slotId: r.slot_id,
    vehicleId: r.vehicle_id,
    startTime: r.start_time ? new Date(r.start_time).toISOString() : null,
    endTime: r.end_time ? new Date(r.end_time).toISOString() : null,
    hours: r.hours != null ? parseFloat(r.hours) : null,
    totalPrice: r.total_price != null ? parseFloat(r.total_price) : null,
    status: r.status,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : null
  };
  if (r.punch_in_time) b.punchInTime = new Date(r.punch_in_time).toISOString();
  if (r.punch_out_time) b.punchOutTime = new Date(r.punch_out_time).toISOString();
  if (r.punch_type) b.punchType = r.punch_type;
  if (r.payment_status) b.paymentStatus = r.payment_status;
  if (r.payment_intent_id) b.paymentIntentId = r.payment_intent_id;
  if (r.paid_amount != null) b.paidAmount = parseFloat(r.paid_amount);
  if (r.paid_at) b.paidAt = new Date(r.paid_at).toISOString();
  if (r.imported) b.imported = r.imported;
  if (r.import_ref) b.importRef = r.import_ref;
  return b;
}

function createRepository(pool) {
  return {
    async getUserByEmailNorm(emailNorm) {
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1',
        [emailNorm]
      );
      return rowToUser(rows[0]);
    },

    async getUserByEmailAndRole(emailNorm, role) {
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE LOWER(TRIM(email)) = $1 AND role = $2 LIMIT 1',
        [emailNorm, role]
      );
      return rowToUser(rows[0]);
    },

    async getUserById(id) {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return rowToUser(rows[0]);
    },

    async insertUser(user) {
      await pool.query(
        `INSERT INTO users (id, email, password, role, name, phone, wallet_balance, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          user.id,
          user.email,
          user.password,
          user.role,
          user.name,
          user.phone,
          user.role === 'user' ? user.walletBalance ?? 0 : null,
          user.createdAt || new Date()
        ]
      );
    },

    async updateUserWallet(userId, balance) {
      await pool.query('UPDATE users SET wallet_balance = $2 WHERE id = $1', [
        userId,
        balance
      ]);
    },

    async countUsers() {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
      return rows[0].c;
    },

    async listParkingAreas() {
      const { rows } = await pool.query('SELECT * FROM parking_areas ORDER BY created_at');
      return rows.map(rowToArea);
    },

    async getParkingArea(id) {
      const { rows } = await pool.query('SELECT * FROM parking_areas WHERE id = $1', [id]);
      return rowToArea(rows[0]);
    },

    async listParkingAreasByOwner(ownerId) {
      const { rows } = await pool.query(
        'SELECT * FROM parking_areas WHERE owner_id = $1 ORDER BY created_at',
        [ownerId]
      );
      return rows.map(rowToArea);
    },

    async insertParkingArea(area) {
      await pool.query(
        `INSERT INTO parking_areas (id, owner_id, name, location, layout_matrix, entry_point, slots, total_slots, price_per_hour, vehicle_types, timings, created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb,$11,$12)`,
        [
          area.id,
          area.ownerId,
          area.name,
          area.location,
          JSON.stringify(area.layoutMatrix),
          JSON.stringify(area.entryPoint),
          JSON.stringify(area.slots),
          area.totalSlots,
          area.pricePerHour,
          JSON.stringify(area.vehicleTypes || []),
          area.timings || null,
          area.createdAt || new Date()
        ]
      );
    },

    async updateParkingAreaSlots(areaId, slots) {
      await pool.query(
        'UPDATE parking_areas SET slots = $2::jsonb, total_slots = $3 WHERE id = $1',
        [areaId, JSON.stringify(slots), slots.length]
      );
    },

    async insertVehicle(v) {
      await pool.query(
        `INSERT INTO vehicles (id, user_id, vehicle_number, vehicle_type, model, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          v.id,
          v.userId,
          v.vehicleNumber,
          v.vehicleType,
          v.model || '',
          v.createdAt || new Date()
        ]
      );
    },

    async listVehiclesByUser(userId) {
      const { rows } = await pool.query(
        'SELECT * FROM vehicles WHERE user_id = $1 ORDER BY created_at',
        [userId]
      );
      return rows.map(rowToVehicle);
    },

    async getVehicleForUser(vehicleId, userId) {
      const { rows } = await pool.query(
        'SELECT * FROM vehicles WHERE id = $1 AND user_id = $2',
        [vehicleId, userId]
      );
      return rowToVehicle(rows[0]);
    },

    async getVehicleByNumberUpper(vehicleNumber) {
      const { rows } = await pool.query(
        'SELECT * FROM vehicles WHERE UPPER(vehicle_number) = $1 LIMIT 1',
        [vehicleNumber.toUpperCase()]
      );
      return rowToVehicle(rows[0]);
    },

    async getVehicleById(id) {
      const { rows } = await pool.query('SELECT * FROM vehicles WHERE id = $1', [id]);
      return rowToVehicle(rows[0]);
    },

    async insertBooking(b) {
      await pool.query(
        `INSERT INTO bookings (id, user_id, parking_area_id, slot_id, vehicle_id, start_time, end_time, hours, total_price, status,
          punch_in_time, punch_out_time, punch_type, payment_status, payment_intent_id, paid_amount, paid_at, imported, import_ref, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          b.id,
          b.userId,
          b.parkingAreaId,
          b.slotId,
          b.vehicleId,
          b.startTime || null,
          b.endTime || null,
          b.hours ?? null,
          b.totalPrice ?? null,
          b.status,
          b.punchInTime || null,
          b.punchOutTime || null,
          b.punchType || null,
          b.paymentStatus || null,
          b.paymentIntentId || null,
          b.paidAmount ?? null,
          b.paidAt || null,
          !!b.imported,
          b.importRef || null,
          b.createdAt || new Date()
        ]
      );
    },

    async getBooking(id) {
      const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
      return rowToBooking(rows[0]);
    },

    async updateBooking(id, patch) {
      const keys = [];
      const vals = [];
      let i = 1;
      const map = {
        endTime: 'end_time',
        punchOutTime: 'punch_out_time',
        hours: 'hours',
        totalPrice: 'total_price',
        status: 'status',
        paymentStatus: 'payment_status',
        paymentIntentId: 'payment_intent_id',
        paidAmount: 'paid_amount',
        paidAt: 'paid_at',
        startTime: 'start_time'
      };
      for (const [js, col] of Object.entries(map)) {
        if (patch[js] !== undefined) {
          keys.push(`${col} = $${i++}`);
          vals.push(patch[js]);
        }
      }
      if (!keys.length) return;
      vals.push(id);
      await pool.query(`UPDATE bookings SET ${keys.join(', ')} WHERE id = $${i}`, vals);
    },

    async listBookingsByUser(userId) {
      const { rows } = await pool.query(
        'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return rows.map(rowToBooking);
    },

    async listBookingsForAreaIds(areaIds) {
      if (!areaIds.length) return [];
      const { rows } = await pool.query(
        `SELECT * FROM bookings WHERE parking_area_id = ANY($1::text[]) ORDER BY created_at DESC`,
        [areaIds]
      );
      return rows.map(rowToBooking);
    },

    async listBookingsForArea(areaId, startDate, endDate) {
      let q = 'SELECT * FROM bookings WHERE parking_area_id = $1';
      const p = [areaId];
      let i = 2;
      if (startDate) {
        q += ` AND start_time >= $${i++}`;
        p.push(startDate);
      }
      if (endDate) {
        q += ` AND start_time <= $${i++}`;
        p.push(endDate);
      }
      const { rows } = await pool.query(q, p);
      return rows.map(rowToBooking);
    },

    async findActiveBookingVehicleArea(vehicleId, parkingAreaId) {
      const { rows } = await pool.query(
        `SELECT * FROM bookings WHERE vehicle_id = $1 AND parking_area_id = $2 AND status = 'active' LIMIT 1`,
        [vehicleId, parkingAreaId]
      );
      return rowToBooking(rows[0]);
    },

    async findActiveBookingByVehicleId(vehicleId) {
      const { rows } = await pool.query(
        `SELECT * FROM bookings WHERE vehicle_id = $1 AND status = 'active' LIMIT 1`,
        [vehicleId]
      );
      return rowToBooking(rows[0]);
    },

    async listPaidBookingsByUser(userId) {
      const { rows } = await pool.query(
        `SELECT * FROM bookings WHERE user_id = $1 AND payment_status = 'paid' ORDER BY paid_at DESC NULLS LAST`,
        [userId]
      );
      return rows.map(rowToBooking);
    },

    async insertPaymentIntent(pi) {
      await pool.query(
        `INSERT INTO payment_intents (id, amount_paise, currency, status, client_secret, created_ms, booking_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [pi.id, pi.amount, pi.currency || 'inr', pi.status, pi.client_secret, pi.created, pi.bookingId]
      );
    },

    async getPaymentIntent(id) {
      const { rows } = await pool.query('SELECT * FROM payment_intents WHERE id = $1', [id]);
      return rows[0]
        ? {
            id: rows[0].id,
            amount: rows[0].amount_paise,
            currency: rows[0].currency,
            status: rows[0].status,
            client_secret: rows[0].client_secret,
            created: rows[0].created_ms,
            bookingId: rows[0].booking_id,
            payment_method: rows[0].payment_method_id,
            paid_at: rows[0].paid_at
          }
        : null;
    },

    async updatePaymentIntent(id, status, paymentMethodId, paidAt) {
      await pool.query(
        `UPDATE payment_intents SET status = $2, payment_method_id = $3, paid_at = $4 WHERE id = $1`,
        [id, status, paymentMethodId || null, paidAt || null]
      );
    },

    pool
  };
}

module.exports = { createRepository, rowToArea, rowToUser, rowToVehicle, rowToBooking };
