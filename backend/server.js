const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createPool } = require('./db/pool');
const { initSchema } = require('./db/initSchema');
const { createRepository } = require('./db/repository');
const { loadCsvFromDirIfPresentPg } = require('./csvImportPg');

/** Auto-loaded on server start when the users table is empty (owners → users → bookings CSVs) */
const SEED_DATA_DIR = path.join(__dirname, '..', 'data', 'seed');

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

/** @type {ReturnType<typeof createRepository>} */
let repo;

// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Role validation middleware
const requireRole = (role) => (req, res, next) => {
  // Allow camera role for punch in/out
  if (role === 'camera' && (req.user.role === 'camera-in' || req.user.role === 'camera-out')) {
    return next();
  }
  
  if (req.user.role !== role) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// ============ AUTH ROUTES ============

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, role, name, phone } = req.body;
    const emailNorm = normalizeEmail(email);

    if (!emailNorm) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const existingUser = await repo.getUserByEmailNorm(emailNorm);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      id: Date.now().toString(),
      email: emailNorm,
      password: hashedPassword,
      role,
      name,
      phone,
      walletBalance: role === 'user' ? 0 : undefined,
      createdAt: new Date()
    };

    await repo.insertUser(user);
    
    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    const userPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };
    if (user.role === 'user') {
      userPayload.walletBalance = user.walletBalance ?? 0;
    }
    res.json({ token, user: userPayload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const emailNorm = normalizeEmail(email);

    if (!emailNorm || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await repo.getUserByEmailAndRole(emailNorm, role);
    if (!user) {
      const anyRole = await repo.getUserByEmailNorm(emailNorm);
      if (anyRole && anyRole.role !== role) {
        const label =
          anyRole.role === 'owner'
            ? 'Parking Owner'
            : anyRole.role === 'user'
              ? 'Parking User'
              : anyRole.role === 'camera-in'
                ? 'Punch In Camera'
                : anyRole.role === 'camera-out'
                  ? 'Punch Out Camera'
                  : anyRole.role;
        return res.status(401).json({
          error: `This email is registered for role "${label}". Choose that role in the Role dropdown and try again.`
        });
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    const userPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };
    if (user.role === 'user') {
      userPayload.walletBalance = user.walletBalance ?? 0;
    }
    res.json({ token, user: userPayload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Kiosk: punch in/out without operator email/password (terminal picks lot + role only)
app.post('/api/auth/camera-kiosk', async (req, res) => {
  try {
    const { role, parkingAreaId } = req.body;
    if (role !== 'camera-in' && role !== 'camera-out') {
      return res.status(400).json({ error: 'Invalid role for kiosk' });
    }
    if (!parkingAreaId || typeof parkingAreaId !== 'string') {
      return res.status(400).json({ error: 'Parking area is required' });
    }
    const area = await repo.getParkingArea(parkingAreaId);
    if (!area) {
      return res.status(404).json({ error: 'Parking area not found' });
    }
    const id = `kiosk:${parkingAreaId}:${role}`;
    const token = jwt.sign(
      { id, email: 'kiosk@terminal', role, kiosk: true },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    const userPayload = {
      id,
      email: '',
      role,
      name: role === 'camera-in' ? 'Punch In (terminal)' : 'Punch Out (terminal)'
    };
    res.json({ token, user: userPayload });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PARKING AREA ROUTES (Owner) ============

// Helper function to calculate shortest path from entry using BFS
const calculateShortestPaths = (layoutMatrix, entryPoint) => {
  const rows = layoutMatrix.length;
  const cols = layoutMatrix[0].length;
  const distances = Array(rows).fill().map(() => Array(cols).fill(Infinity));
  const queue = [];
  
  // Start from entry point
  distances[entryPoint.row][entryPoint.col] = 0;
  queue.push({ row: entryPoint.row, col: entryPoint.col, dist: 0 });
  
  // Directions: up, down, left, right
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  while (queue.length > 0) {
    const current = queue.shift();
    
    for (const [dr, dc] of directions) {
      const newRow = current.row + dr;
      const newCol = current.col + dc;
      
      // Check bounds
      if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
        // Can move through paths (0) and parking slots (1)
        if ((layoutMatrix[newRow][newCol] === 0 || layoutMatrix[newRow][newCol] === 1) &&
            distances[newRow][newCol] === Infinity) {
          distances[newRow][newCol] = current.dist + 1;
          queue.push({ row: newRow, col: newCol, dist: current.dist + 1 });
        }
      }
    }
  }
  
  return distances;
};

// Create parking area
app.post('/api/parking-areas', authenticate, requireRole('owner'), async (req, res) => {
  try {
    const {
      name,
      location,
      layoutMatrix,
      entryPoint,
      pricePerHour,
      vehicleTypes,
      timings
    } = req.body;
    
    // Calculate distances from entry point
    const distances = calculateShortestPaths(layoutMatrix, entryPoint);
    
    // Generate slot IDs from matrix
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
            status: 'available', // available, booked, disabled
            distance: distances[i][j], // Distance from entry
            bookings: []
          });
        }
      }
    }
    
    // Sort slots by distance for easier nearest slot allocation
    slots.sort((a, b) => a.distance - b.distance);
    
    const parkingArea = {
      id: Date.now().toString(),
      ownerId: req.user.id,
      name,
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
    
    await repo.insertParkingArea(parkingArea);
    res.json(parkingArea);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get owner's parking areas
app.get('/api/parking-areas/owner', authenticate, requireRole('owner'), async (req, res) => {
  const areas = await repo.listParkingAreasByOwner(req.user.id);
  res.json(areas);
});

// Kiosk / login screen: list lots without auth (avoids matching /parking-areas/:id)
app.get('/api/kiosk/parking-areas', async (req, res) => {
  try {
    const areas = await repo.listParkingAreas();
    const list = areas.map((a) => ({
      id: a.id,
      name: a.name,
      location: a.location,
      availableSlots: a.slots.filter((s) => s.status === 'available').length
    }));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public list for camera login (id, name, location, availability) — must be before /:id
app.get('/api/parking-areas/public-list', async (req, res) => {
  try {
    const areas = await repo.listParkingAreas();
    const list = areas.map((area) => ({
      id: area.id,
      name: area.name,
      location: area.location,
      availableSlots: area.slots.filter((s) => s.status === 'available').length
    }));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get parking area details
app.get('/api/parking-areas/:id', authenticate, async (req, res) => {
  const area = await repo.getParkingArea(req.params.id);
  if (!area) {
    return res.status(404).json({ error: 'Parking area not found' });
  }
  res.json(area);
});

// Search parking areas
app.get('/api/parking-areas', authenticate, async (req, res) => {
  const { location, vehicleType, date } = req.query;
  
  let areas = await repo.listParkingAreas();
  
  if (location) {
    areas = areas.filter(p => 
      p.location.toLowerCase().includes(location.toLowerCase())
    );
  }
  
  if (vehicleType) {
    areas = areas.filter(p => p.vehicleTypes.includes(vehicleType));
  }
  
  // Calculate availability for each area
  areas = areas.map(area => {
    const availableSlots = area.slots.filter(s => s.status === 'available').length;
    return { ...area, availableSlots };
  });
  
  res.json(areas);
});

// Get nearest available slot
app.get('/api/parking-areas/:id/nearest-slot', authenticate, async (req, res) => {
  const area = await repo.getParkingArea(req.params.id);
  
  if (!area) {
    return res.status(404).json({ error: 'Parking area not found' });
  }
  
  // Find nearest available slot (already sorted by distance)
  const nearestSlot = area.slots.find(s => s.status === 'available');
  
  if (!nearestSlot) {
    return res.status(404).json({ error: 'No available slots' });
  }
  
  res.json(nearestSlot);
});

// Update slot status (Owner)
app.patch('/api/parking-areas/:id/slots/:slotId', authenticate, requireRole('owner'), async (req, res) => {
  const { status } = req.body;
  const area = await repo.getParkingArea(req.params.id);
  if (!area || area.ownerId !== req.user.id) {
    return res.status(404).json({ error: 'Parking area not found' });
  }
  const slot = area.slots.find(s => s.id === req.params.slotId);
  if (!slot) {
    return res.status(404).json({ error: 'Slot not found' });
  }
  slot.status = status;
  await repo.updateParkingAreaSlots(area.id, area.slots);
  res.json(slot);
});

// ============ VEHICLE ROUTES (User) ============

// Register vehicle
app.post('/api/vehicles', authenticate, requireRole('user'), async (req, res) => {
  try {
    const { vehicleNumber, vehicleType, model } = req.body;
    
    const vehicle = {
      id: Date.now().toString(),
      userId: req.user.id,
      vehicleNumber: vehicleNumber.toUpperCase(),
      vehicleType,
      model,
      createdAt: new Date()
    };
    
    await repo.insertVehicle(vehicle);
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's vehicles
app.get('/api/vehicles', authenticate, requireRole('user'), async (req, res) => {
  const vehicles = await repo.listVehiclesByUser(req.user.id);
  res.json(vehicles);
});

// ============ PRICING (per-minute: pricePerHour/60 × minutes elapsed) ============

function computeParkingPricingFromDurationMs(durationMs, pricePerHour) {
  const elapsedMinutes = durationMs / (1000 * 60);
  const ratePerMinute = pricePerHour / 60;
  const subtotalFull = ratePerMinute * elapsedMinutes;
  const elapsedHours = elapsedMinutes / 60;
  let multiplier = 1.0;
  if (elapsedHours > 24) {
    multiplier = 0.8;
  } else if (elapsedHours > 12) {
    multiplier = 0.9;
  }
  const discountAmount = subtotalFull * (1 - multiplier);
  const afterDiscount = subtotalFull * multiplier;
  const gstRate = 0.18; // 18% GST
  const tax = afterDiscount * gstRate;
  const total = afterDiscount + tax;
  return {
    elapsedMinutes,
    ratePerMinute,
    subtotalBeforeDiscount: parseFloat(subtotalFull.toFixed(2)),
    discount: parseFloat(discountAmount.toFixed(2)),
    discountPercent: Math.round((1 - multiplier) * 100),
    tax: parseFloat(tax.toFixed(2)),
    gstPercent: 18,
    total: parseFloat(total.toFixed(2))
  };
}

// ============ BOOKING ROUTES ============

// Create booking
app.post('/api/bookings', authenticate, requireRole('user'), async (req, res) => {
  try {
    const { parkingAreaId, slotId, vehicleId, startTime, endTime } = req.body;
    
    const area = await repo.getParkingArea(parkingAreaId);
    if (!area) {
      return res.status(404).json({ error: 'Parking area not found' });
    }
    
    const slot = area.slots.find(s => s.id === slotId);
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    
    if (slot.status !== 'available') {
      return res.status(400).json({ error: 'Slot not available' });
    }
    
    const vehicle = await repo.getVehicleForUser(vehicleId, req.user.id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid start or end time' });
    }
    if (end <= start) {
      return res.status(400).json({
        error: 'End time must be after start time. Check date and time on both fields (e.g. if you park overnight, set end date to the next day).'
      });
    }
    const durationMs = end - start;
    const pricing = computeParkingPricingFromDurationMs(durationMs, area.pricePerHour);
    const hours = parseFloat((pricing.elapsedMinutes / 60).toFixed(2));
    const totalPrice = pricing.total;
    
    const booking = {
      id: Date.now().toString(),
      userId: req.user.id,
      parkingAreaId,
      slotId,
      vehicleId,
      startTime,
      endTime,
      hours,
      totalPrice,
      status: 'active', // active, completed, cancelled
      createdAt: new Date()
    };
    
    await repo.insertBooking(booking);
    
    slot.status = 'booked';
    if (!slot.bookings) slot.bookings = [];
    slot.bookings.push(booking.id);
    await repo.updateParkingAreaSlots(area.id, area.slots);
    
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user bookings
app.get('/api/bookings/user', authenticate, requireRole('user'), async (req, res) => {
  const list = await repo.listBookingsByUser(req.user.id);
  const out = [];
  for (const booking of list) {
    const area = await repo.getParkingArea(booking.parkingAreaId);
    const vehicle = await repo.getVehicleById(booking.vehicleId);
    out.push({ ...booking, parkingArea: area, vehicle });
  }
  res.json(out);
});

// Get owner bookings
app.get('/api/bookings/owner', authenticate, requireRole('owner'), async (req, res) => {
  const ownerAreas = await repo.listParkingAreasByOwner(req.user.id);
  const ownerAreaIds = ownerAreas.map(a => a.id);
  const list = await repo.listBookingsForAreaIds(ownerAreaIds);
  const out = [];
  for (const booking of list) {
    const area = await repo.getParkingArea(booking.parkingAreaId);
    const vehicle = await repo.getVehicleById(booking.vehicleId);
    const u = await repo.getUserById(booking.userId);
    const user = u
      ? { id: u.id, email: u.email, name: u.name, role: u.role, phone: u.phone }
      : null;
    out.push({ ...booking, parkingArea: area, vehicle, user });
  }
  res.json(out);
});

// Cancel booking
app.patch('/api/bookings/:id/cancel', authenticate, async (req, res) => {
  const booking = await repo.getBooking(req.params.id);
  
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  
  if (req.user.role === 'user' && booking.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  await repo.updateBooking(booking.id, { status: 'cancelled' });
  booking.status = 'cancelled';
  
  const area = await repo.getParkingArea(booking.parkingAreaId);
  const slot = area.slots.find(s => s.id === booking.slotId);
  if (slot) {
    slot.status = 'available';
    await repo.updateParkingAreaSlots(area.id, area.slots);
  }
  
  res.json(booking);
});

// ============ PUNCH IN/OUT ROUTES ============

// Punch In - Create booking via camera
app.post('/api/punch-in', authenticate, requireRole('camera'), async (req, res) => {
  try {
    const { vehicleNumber, parkingAreaId } = req.body;
    
    const vehicle = await repo.getVehicleByNumberUpper(vehicleNumber);
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not registered in system' });
    }
    
    const area = await repo.getParkingArea(parkingAreaId);
    if (!area) {
      return res.status(404).json({ error: 'Parking area not found' });
    }
    
    const existingBooking = await repo.findActiveBookingVehicleArea(vehicle.id, parkingAreaId);
    
    if (existingBooking) {
      return res.status(400).json({ 
        error: 'Vehicle already has an active booking',
        booking: existingBooking
      });
    }
    
    const availableSlot = area.slots
      .filter(s => s.status === 'available')
      .sort((a, b) => a.distance - b.distance)[0];
    
    if (!availableSlot) {
      return res.status(404).json({ error: 'No available slots' });
    }
    
    const booking = {
      id: Date.now().toString(),
      userId: vehicle.userId,
      parkingAreaId,
      slotId: availableSlot.id,
      vehicleId: vehicle.id,
      startTime: new Date().toISOString(),
      endTime: null,
      hours: null,
      totalPrice: null,
      status: 'active',
      punchInTime: new Date().toISOString(),
      punchType: 'camera',
      createdAt: new Date()
    };
    
    await repo.insertBooking(booking);
    availableSlot.status = 'booked';
    if (!availableSlot.bookings) availableSlot.bookings = [];
    availableSlot.bookings.push(booking.id);
    await repo.updateParkingAreaSlots(area.id, area.slots);
    
    res.json({
      booking,
      vehicle,
      slot: availableSlot,
      parkingArea: area
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Punch Out - Complete booking
app.post('/api/punch-out', authenticate, async (req, res) => {
  try {
    const { vehicleNumber, parkingAreaId, bookingId } = req.body;
    
    let booking;
    
    if (bookingId) {
      booking = await repo.getBooking(bookingId);
      if (booking && booking.status !== 'active') booking = null;
    } else if (vehicleNumber && parkingAreaId) {
      const vehicle = await repo.getVehicleByNumberUpper(vehicleNumber);
      
      if (!vehicle) {
        return res.status(404).json({ error: 'Vehicle not registered' });
      }
      
      booking = await repo.findActiveBookingVehicleArea(vehicle.id, parkingAreaId);
    }
    
    if (!booking) {
      return res.status(404).json({ error: 'No active booking found' });
    }
    
    if (req.user.role === 'user' && booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const startTimeDate = new Date(booking.startTime || booking.punchInTime);
    const endTime = new Date();
    const durationMs = Math.max(0, endTime - startTimeDate);
    const area = await repo.getParkingArea(booking.parkingAreaId);
    const pricing = computeParkingPricingFromDurationMs(durationMs, area.pricePerHour);
    const hours = parseFloat((pricing.elapsedMinutes / 60).toFixed(2));
    const totalPrice = pricing.total;
    
    const endIso = endTime.toISOString();
    await repo.updateBooking(booking.id, {
      endTime: endIso,
      punchOutTime: endIso,
      hours,
      totalPrice,
      status: 'completed'
    });
    booking.endTime = endIso;
    booking.punchOutTime = endIso;
    booking.hours = hours;
    booking.totalPrice = totalPrice;
    booking.status = 'completed';
    
    const slot = area.slots.find(s => s.id === booking.slotId);
    if (slot) {
      slot.status = 'available';
      await repo.updateParkingAreaSlots(area.id, area.slots);
    }

    const payable = parseFloat(Number(totalPrice).toFixed(2));
    let walletPayment = { success: false };

    if (payable <= 0) {
      const walletIntentId = `auto_wallet_${Date.now()}`;
      await repo.updateBooking(booking.id, {
        paymentStatus: 'paid',
        paymentIntentId: walletIntentId,
        paidAmount: 0,
        paidAt: endIso
      });
      booking.paymentStatus = 'paid';
      booking.paymentIntentId = walletIntentId;
      booking.paidAmount = 0;
      booking.paidAt = endIso;
      walletPayment = { success: true, paidAmount: 0 };
    } else {
      const parkUser = await repo.getUserById(booking.userId);
      if (!parkUser) {
        walletPayment = { success: false, reason: 'user_not_found', amountDue: payable };
      } else {
        const current = parkUser.walletBalance != null ? parkUser.walletBalance : 0;
        if (current >= payable) {
          const newBal = parseFloat((current - payable).toFixed(2));
          await repo.updateUserWallet(parkUser.id, newBal);
          const walletIntentId = `auto_wallet_${Date.now()}`;
          await repo.updateBooking(booking.id, {
            paymentStatus: 'paid',
            paymentIntentId: walletIntentId,
            paidAmount: payable,
            paidAt: endIso
          });
          booking.paymentStatus = 'paid';
          booking.paymentIntentId = walletIntentId;
          booking.paidAmount = payable;
          booking.paidAt = endIso;
          walletPayment = {
            success: true,
            paidAmount: payable,
            newWalletBalance: newBal
          };
        } else {
          walletPayment = {
            success: false,
            reason: 'insufficient_wallet_balance',
            amountDue: payable,
            walletBalance: parseFloat(Number(current).toFixed(2))
          };
        }
      }
    }

    res.json({
      booking,
      duration: {
        hours,
        minutes: Math.floor(pricing.elapsedMinutes),
        elapsedMinutes: parseFloat(pricing.elapsedMinutes.toFixed(2)),
        totalPrice
      },
      walletPayment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active booking for a vehicle
app.get('/api/bookings/active/:vehicleNumber', authenticate, async (req, res) => {
  try {
    const vehicle = await repo.getVehicleByNumberUpper(req.params.vehicleNumber);
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    const activeBooking = await repo.findActiveBookingByVehicleId(vehicle.id);
    
    if (!activeBooking) {
      return res.json({ booking: null });
    }
    
    const area = await repo.getParkingArea(activeBooking.parkingAreaId);
    
    res.json({
      booking: activeBooking,
      vehicle,
      parkingArea: area
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PAYMENT ROUTES ============

async function getPricingForBooking(booking) {
  const area = await repo.getParkingArea(booking.parkingAreaId);
  if (!area) return null;

  // Start: manual booking uses startTime; camera punch-in uses punchInTime (both may exist; prefer explicit start)
  const start = new Date(booking.startTime || booking.punchInTime);
  // End: after checkout use stored end (manual scheduled end while active, or punch-out / stop-booking time when completed)
  const hasFixedEnd = !!(booking.endTime || booking.punchOutTime);
  const end = hasFixedEnd
    ? new Date(booking.endTime || booking.punchOutTime)
    : new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Invalid booking timestamps' };
  }
  if (end < start) {
    return {
      error:
        'Invalid booking times: end is before start. For camera flow, use punch-in then punch-out. For manual booking, ensure end is after start (use next day if parking overnight).'
    };
  }

  const durationMs = end - start;
  const p = computeParkingPricingFromDurationMs(durationMs, area.pricePerHour);

  return {
    pricing: {
      durationMinutes: Math.floor(p.elapsedMinutes),
      elapsedMinutes: parseFloat(p.elapsedMinutes.toFixed(2)),
      durationHours: parseFloat((p.elapsedMinutes / 60).toFixed(2)),
      pricePerHour: area.pricePerHour,
      ratePerMinute: parseFloat(p.ratePerMinute.toFixed(4)),
      subtotal: p.subtotalBeforeDiscount,
      discount: p.discount,
      discountPercent: p.discountPercent,
      tax: p.tax,
      gstPercent: p.gstPercent,
      total: p.total,
      currency: 'INR'
    },
    area
  };
}

// ============ WALLET ROUTES (User) ============

app.get('/api/wallet', authenticate, requireRole('user'), async (req, res) => {
  const user = await repo.getUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const balance = user.walletBalance != null ? user.walletBalance : 0;
  res.json({ balance: parseFloat(Number(balance).toFixed(2)) });
});

app.post('/api/wallet/add', authenticate, requireRole('user'), async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const user = await repo.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const current = user.walletBalance != null ? user.walletBalance : 0;
    const next = parseFloat((current + amount).toFixed(2));
    await repo.updateUserWallet(user.id, next);
    res.json({ balance: next });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/wallet/deduct', authenticate, requireRole('user'), async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const user = await repo.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const current = user.walletBalance != null ? user.walletBalance : 0;
    if (current < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    const next = parseFloat((current - amount).toFixed(2));
    await repo.updateUserWallet(user.id, next);
    res.json({ balance: next });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Calculate dynamic price for booking
app.post('/api/payments/calculate-price', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await repo.getBooking(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const result = await getPricingForBooking(booking);
    if (!result) {
      return res.status(404).json({ error: 'Parking area not found' });
    }
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      booking,
      pricing: result.pricing
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pay completed booking from wallet (same amount as calculate-price)
app.post('/api/payments/wallet-pay', authenticate, requireRole('user'), async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await repo.getBooking(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    if (booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ error: 'Booking is not completed' });
    }
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Booking is already paid' });
    }

    const result = await getPricingForBooking(booking);
    if (!result) {
      return res.status(404).json({ error: 'Parking area not found' });
    }
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    const payable = result.pricing.total;

    const user = await repo.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const current = user.walletBalance != null ? user.walletBalance : 0;
    if (current < payable) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const newBal = parseFloat((current - payable).toFixed(2));
    await repo.updateUserWallet(user.id, newBal);
    const paidAt = new Date().toISOString();
    const walletIntentId = `wallet_${Date.now()}`;
    await repo.updateBooking(booking.id, {
      paymentStatus: 'paid',
      paymentIntentId: walletIntentId,
      paidAmount: payable,
      paidAt
    });
    booking.paymentStatus = 'paid';
    booking.paymentIntentId = walletIntentId;
    booking.paidAmount = payable;
    booking.paidAt = paidAt;

    res.json({
      success: true,
      balance: newBal,
      booking
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create payment intent (Stripe simulation)
app.post('/api/payments/create-intent', authenticate, async (req, res) => {
  try {
    const { bookingId, amount } = req.body;
    
    const booking = await repo.getBooking(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Verify ownership
    if (req.user.role === 'user' && booking.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const id = `pi_${Date.now()}`;
    const paymentIntent = {
      id,
      amount: Math.round(amount * 100), // paise
      currency: 'inr',
      status: 'requires_payment_method',
      client_secret: `${id}_secret_${Math.random().toString(36).substr(2, 9)}`,
      created: Date.now(),
      bookingId
    };
    
    await repo.insertPaymentIntent(paymentIntent);
    
    res.json(paymentIntent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm payment
app.post('/api/payments/confirm', authenticate, async (req, res) => {
  try {
    const { paymentIntentId, paymentMethodId } = req.body;
    
    const paymentIntent = await repo.getPaymentIntent(paymentIntentId);
    if (!paymentIntent) {
      return res.status(404).json({ error: 'Payment intent not found' });
    }
    
    const booking = await repo.getBooking(paymentIntent.bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const paidAt = new Date().toISOString();
    await repo.updatePaymentIntent(paymentIntentId, 'succeeded', paymentMethodId, paidAt);
    const paidAmount = paymentIntent.amount / 100;
    await repo.updateBooking(booking.id, {
      paymentStatus: 'paid',
      paymentIntentId,
      paidAmount,
      paidAt
    });
    
    const paymentIntentOut = {
      ...paymentIntent,
      status: 'succeeded',
      payment_method: paymentMethodId,
      paid_at: paidAt
    };
    booking.paymentStatus = 'paid';
    booking.paymentIntentId = paymentIntentId;
    booking.paidAmount = paidAmount;
    booking.paidAt = paidAt;
    
    res.json({
      success: true,
      paymentIntent: paymentIntentOut,
      booking
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment history for user
app.get('/api/payments/history', authenticate, requireRole('user'), async (req, res) => {
  try {
    const userBookings = await repo.listPaidBookingsByUser(req.user.id);
    
    const payments = await Promise.all(
      userBookings.map(async (booking) => {
        const [area, vehicle] = await Promise.all([
          repo.getParkingArea(booking.parkingAreaId),
          repo.getVehicleById(booking.vehicleId)
        ]);
        return {
          id: booking.paymentIntentId,
          bookingId: booking.id,
          amount: booking.paidAmount,
          parkingArea: area?.name,
          location: area?.location,
          vehicle: vehicle?.vehicleNumber,
          startTime: booking.startTime,
          endTime: booking.endTime,
          duration: booking.hours,
          paidAt: booking.paidAt
        };
      })
    );
    
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ANALYTICS ROUTES ============

// Get analytics for a parking area
app.get('/api/analytics/parking-area/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    const area = await repo.getParkingArea(id);
    if (!area) {
      return res.status(404).json({ error: 'Parking area not found' });
    }
    
    let bookings = await repo.listBookingsForArea(
      id,
      startDate || null,
      endDate || null
    );
    bookings = bookings.filter((b) => b.startTime);
    
    // Calculate hourly traffic for each day of week
    const hourlyTraffic = {};
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Initialize structure
    daysOfWeek.forEach(day => {
      hourlyTraffic[day] = Array(24).fill(0);
    });
    
    // Count bookings by hour and day
    bookings.forEach(booking => {
      const startTime = new Date(booking.startTime);
      const dayName = daysOfWeek[startTime.getDay()];
      const hour = startTime.getHours();
      
      hourlyTraffic[dayName][hour]++;
    });
    
    // Calculate daily traffic
    const dailyTraffic = {};
    daysOfWeek.forEach(day => {
      dailyTraffic[day] = hourlyTraffic[day].reduce((sum, count) => sum + count, 0);
    });
    
    // Calculate peak hours
    const allHours = Array(24).fill(0);
    Object.values(hourlyTraffic).forEach(dayHours => {
      dayHours.forEach((count, hour) => {
        allHours[hour] += count;
      });
    });
    
    const peakHour = allHours.indexOf(Math.max(...allHours));
    const peakHourCount = Math.max(...allHours);
    
    const slots = Array.isArray(area.slots) ? area.slots : [];
    // Calculate occupancy rate
    const totalSlots = slots.length;
    const currentOccupied = slots.filter(s => s.status === 'booked').length;
    const occupancyRate = totalSlots > 0 ? (currentOccupied / totalSlots) * 100 : 0;
    
    // Revenue analytics
    const totalRevenue = bookings
      .filter(b => b.paymentStatus === 'paid')
      .reduce((sum, b) => sum + (b.paidAmount || 0), 0);
    
    const avgDuration = bookings.length > 0
      ? bookings.reduce((sum, b) => sum + (b.hours || 0), 0) / bookings.length
      : 0;
    
    res.json({
      parkingArea: {
        id: area.id,
        name: area.name,
        location: area.location,
        totalSlots
      },
      hourlyTraffic,
      dailyTraffic,
      peakHour: {
        hour: peakHour,
        count: peakHourCount,
        time: `${peakHour}:00 - ${peakHour + 1}:00`
      },
      summary: {
        totalBookings: bookings.length,
        activeBookings: bookings.filter(b => b.status === 'active').length,
        completedBookings: bookings.filter(b => b.status === 'completed').length,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        avgDuration: parseFloat(avgDuration.toFixed(2)),
        occupancyRate: parseFloat(occupancyRate.toFixed(2)),
        currentOccupied
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get analytics for all parking areas (overview)
app.get('/api/analytics/overview', authenticate, async (req, res) => {
  try {
    const areas =
      req.user.role === 'owner'
        ? await repo.listParkingAreasByOwner(req.user.id)
        : await repo.listParkingAreas();
    
    const analytics = await Promise.all(
      areas.map(async (area) => {
      const bookings = await repo.listBookingsForArea(area.id, null, null);
      const slots = Array.isArray(area.slots) ? area.slots : [];
      const totalSlots = slots.length;
      const currentOccupied = slots.filter(s => s.status === 'booked').length;
      const occupancyRate = totalSlots > 0 ? (currentOccupied / totalSlots) * 100 : 0;
      
      const totalRevenue = bookings
        .filter(b => b.paymentStatus === 'paid')
        .reduce((sum, b) => sum + (b.paidAmount || 0), 0);
      
      return {
        id: area.id,
        name: area.name,
        location: area.location,
        totalSlots,
        occupiedSlots: currentOccupied,
        availableSlots: totalSlots - currentOccupied,
        occupancyRate: parseFloat(occupancyRate.toFixed(2)),
        totalBookings: bookings.length,
        revenue: parseFloat(totalRevenue.toFixed(2))
      };
    })
    );
    
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ START SERVER ============

async function startServer() {
  const pool = createPool();
  if (!pool) {
    console.error('Set PG_DATABASE in backend/.env (e.g. smart_parking) to use PostgreSQL.');
    process.exit(1);
  }
  try {
    await initSchema(pool);
    repo = createRepository(pool);
    const summary = await loadCsvFromDirIfPresentPg(pool, bcrypt, SEED_DATA_DIR);
    if (summary) {
      console.log(
        'Auto-seed OK:',
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
      }
    } else {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
      const userCount = rows[0].c;
      if (userCount > 0) {
        console.log(
          `CSV auto-seed skipped: database already has ${userCount} user row(s); using existing data.`
        );
      } else if (!fs.existsSync(SEED_DATA_DIR)) {
        console.warn(
          `Seed folder missing: ${SEED_DATA_DIR} — add owners_parking.csv, users_vehicles.csv, bookings.csv (run: node scripts/generate-seed-csvs.js from repo root)`
        );
      } else {
        const need = ['owners_parking.csv', 'users_vehicles.csv', 'bookings.csv'];
        const missing = need.filter((f) => !fs.existsSync(path.join(SEED_DATA_DIR, f)));
        if (missing.length) {
          console.warn(
            `Empty database but missing seed file(s) in ${SEED_DATA_DIR}: ${missing.join(', ')}`
          );
        } else {
          console.warn(
            'Seed CSVs are present but import did not run; check csvImportPg logs or run: npm run db:bootstrap'
          );
        }
      }
    }
  } catch (e) {
    console.error('Startup failed:', e);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
