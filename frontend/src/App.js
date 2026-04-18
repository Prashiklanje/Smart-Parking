import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import './App.css';

// ============ API SERVICE ============
const API_URL = 'http://localhost:3001/api';

const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  },

  // Auth
  register: (data) => api.request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  login: (data) => api.request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  cameraKioskLogin: (data) =>
    api.request('/auth/camera-kiosk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Parking Areas
  createParkingArea: (data) => api.request('/parking-areas', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getOwnerParkingAreas: () => api.request('/parking-areas/owner'),

  searchParkingAreas: (params) => {
    const query = new URLSearchParams(params).toString();
    return api.request(`/parking-areas?${query}`);
  },

  /** No auth — kiosk login (dedicated path so it never hits /parking-areas/:id) */
  getKioskParkingAreas: async () => {
    const response = await fetch(`${API_URL}/kiosk/parking-areas`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Could not load parking areas');
    }
    return response.json();
  },

  getParkingArea: (id) => api.request(`/parking-areas/${id}`),

  getNearestSlot: (areaId) => api.request(`/parking-areas/${areaId}/nearest-slot`),

  // Vehicles
  registerVehicle: (data) => api.request('/vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getVehicles: () => api.request('/vehicles'),

  // Bookings
  createBooking: (data) => api.request('/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getUserBookings: () => api.request('/bookings/user'),

  getOwnerBookings: () => api.request('/bookings/owner'),

  cancelBooking: (id) => api.request(`/bookings/${id}/cancel`, {
    method: 'PATCH',
  }),

  // Camera / Punch In/Out
  detectPlate: async (imageData) => {
    const response = await fetch('http://localhost:5000/detect-plate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Plate detection failed');
    }
    return response.json();
  },

  punchIn: (data) => api.request('/punch-in', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  punchOut: (data) => api.request('/punch-out', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getActiveBooking: (vehicleNumber) => api.request(`/bookings/active/${vehicleNumber}`),

  // Payments
  calculatePrice: (bookingId) => api.request('/payments/calculate-price', {
    method: 'POST',
    body: JSON.stringify({ bookingId }),
  }),

  createPaymentIntent: (bookingId, amount) => api.request('/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify({ bookingId, amount }),
  }),

  confirmPayment: (paymentIntentId, paymentMethodId) => api.request('/payments/confirm', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId, paymentMethodId }),
  }),

  payBookingWithWallet: (bookingId) => api.request('/payments/wallet-pay', {
    method: 'POST',
    body: JSON.stringify({ bookingId }),
  }),

  getWallet: () => api.request('/wallet'),

  addWalletMoney: (amount) => api.request('/wallet/add', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  }),

  getPaymentHistory: () => api.request('/payments/history'),

  // Analytics
  getAnalytics: (parkingAreaId, startDate, endDate) => {
    let url = `/analytics/parking-area/${parkingAreaId}`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    return api.request(url);
  },

  getOverviewAnalytics: () => api.request('/analytics/overview'),
};

/** Session-only: lot selected on camera login; cleared on logout. */
const CAMERA_AREA_STORAGE_KEY = 'smartParkingCameraArea';

// ============ AUTH CONTEXT ============
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [walletBalance, setWalletBalance] = useState(null);

  const refreshWallet = useCallback(async () => {
    const saved = localStorage.getItem('user');
    if (!saved) {
      return;
    }
    const parsed = JSON.parse(saved);
    if (parsed.role !== 'user') {
      return;
    }
    try {
      const { balance } = await api.getWallet();
      setWalletBalance(balance);
      localStorage.setItem('user', JSON.stringify({ ...parsed, walletBalance: balance }));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setWalletBalance(null);
      return;
    }
    if (user.role === 'user') {
      refreshWallet();
    } else {
      setWalletBalance(null);
    }
  }, [user?.id, user?.role, refreshWallet]);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    if (userData.role === 'user') {
      setWalletBalance(userData.walletBalance != null ? userData.walletBalance : null);
    } else {
      setWalletBalance(null);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setWalletBalance(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    try {
      sessionStorage.removeItem(CAMERA_AREA_STORAGE_KEY);
    } catch (_) {
      /* ignore */
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, walletBalance, refreshWallet }}>
      {children}
    </AuthContext.Provider>
  );
};

// ============ COMPONENTS ============

// Login Page
const LoginPage = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'user',
    parkingAreaId: ''
  });
  const [parkingAreas, setParkingAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [areasError, setAreasError] = useState('');
  const [error, setError] = useState('');

  const isCameraRole = formData.role === 'camera-in' || formData.role === 'camera-out';

  useEffect(() => {
    if (!isCameraRole) {
      setParkingAreas([]);
      setAreasError('');
      return undefined;
    }
    let cancelled = false;
    setAreasLoading(true);
    setAreasError('');
    api
      .getKioskParkingAreas()
      .then((list) => {
        if (!cancelled) setParkingAreas(list);
      })
      .catch((err) => {
        if (!cancelled) setAreasError(err.message);
      })
      .finally(() => {
        if (!cancelled) setAreasLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isCameraRole]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isCameraRole && !formData.parkingAreaId) {
      setError('Please select a parking area');
      return;
    }
    try {
      let response;
      if (isCameraRole) {
        response = await api.cameraKioskLogin({
          role: formData.role,
          parkingAreaId: formData.parkingAreaId
        });
        const sel = parkingAreas.find((a) => a.id === formData.parkingAreaId);
        sessionStorage.setItem(
          CAMERA_AREA_STORAGE_KEY,
          JSON.stringify({
            id: formData.parkingAreaId,
            name: sel?.name || '',
            location: sel?.location || ''
          })
        );
      } else {
        sessionStorage.removeItem(CAMERA_AREA_STORAGE_KEY);
        response = await api.login({
          email: formData.email,
          password: formData.password,
          role: formData.role
        });
      }
      login(response.user, response.token);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Login to Smart Parking</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Role</label>
            <select
              value={formData.role}
              onChange={(e) => {
                const role = e.target.value;
                const nowCamera = role === 'camera-in' || role === 'camera-out';
                const prevCamera =
                  formData.role === 'camera-in' || formData.role === 'camera-out';
                setFormData({
                  ...formData,
                  role,
                  parkingAreaId: nowCamera && prevCamera ? formData.parkingAreaId : ''
                });
              }}
            >
              <option value="user">Parking User</option>
              <option value="owner">Parking Owner</option>
              <option value="camera-in">📹 Punch In Camera</option>
              <option value="camera-out">📹 Punch Out Camera</option>
            </select>
            {!isCameraRole && (
              <p className="hint">
                Seeded owner accounts must use <strong>Parking Owner</strong> (see data/seed).
              </p>
            )}
            {isCameraRole && (
              <p className="hint camera-login-hint">
                Pick the lot for this terminal, then continue — no email or password needed.
              </p>
            )}
          </div>

          {isCameraRole && (
            <div className="form-group">
              <label>Select parking area</label>
              <select
                value={formData.parkingAreaId}
                onChange={(e) => setFormData({ ...formData, parkingAreaId: e.target.value })}
                required={isCameraRole}
                disabled={areasLoading || parkingAreas.length === 0}
              >
                <option value="">
                  {areasLoading ? 'Loading areas…' : 'Select parking area'}
                </option>
                {parkingAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                    {area.location ? ` — ${area.location}` : ''}
                    {typeof area.availableSlots === 'number'
                      ? ` (${area.availableSlots} free)`
                      : ''}
                  </option>
                ))}
              </select>
              {areasError && <p className="error-text">{areasError}</p>}
            </div>
          )}

          {!isCameraRole && (
            <>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value.trim() })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </>
          )}
          <button type="submit" className="btn-primary">
            {isCameraRole ? 'Continue to camera' : 'Login'}
          </button>
        </form>
        <p className="auth-switch">
          Don&apos;t have an account? <button onClick={onSwitchToRegister}>Register</button>
        </p>
      </div>
    </div>
  );
};

// Register Page
const RegisterPage = ({ onSwitchToLogin }) => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'user'
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.register(formData);
      if (formData.role === 'user') {
        try {
          sessionStorage.setItem('smartParkingOpenWalletOnUserRegister', '1');
        } catch (_) {
          /* ignore */
        }
      }
      login(response.user, response.token);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Register for Smart Parking</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="user">Parking User</option>
              <option value="owner">Parking Owner</option>
              <option value="camera-in">📹 Punch In Camera</option>
              <option value="camera-out">📹 Punch Out Camera</option>
            </select>
          </div>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn-primary">Register</button>
        </form>
        <p className="auth-switch">
          Already have an account? <button onClick={onSwitchToLogin}>Login</button>
        </p>
      </div>
    </div>
  );
};

// Owner Dashboard
const OwnerDashboard = () => {
  const [view, setView] = useState('areas'); // areas, create, bookings
  const [parkingAreas, setParkingAreas] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    loadParkingAreas();
    loadBookings();
  }, []);

  const loadParkingAreas = async () => {
    try {
      const areas = await api.getOwnerParkingAreas();
      setParkingAreas(areas);
    } catch (err) {
      console.error(err);
    }
  };

  const loadBookings = async () => {
    try {
      const data = await api.getOwnerBookings();
      setBookings(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-nav">
        <button
          className={view === 'areas' ? 'active' : ''}
          onClick={() => setView('areas')}
        >
          My Parking Areas
        </button>
        <button
          className={view === 'create' ? 'active' : ''}
          onClick={() => setView('create')}
        >
          Create New Area
        </button>
        <button
          className={view === 'bookings' ? 'active' : ''}
          onClick={() => setView('bookings')}
        >
          Bookings
        </button>
        <button
          className={view === 'analytics' ? 'active' : ''}
          onClick={() => setView('analytics')}
        >
          📊 Analytics
        </button>
      </div>

      <div className="dashboard-content">
        {view === 'areas' && <OwnerParkingAreas areas={parkingAreas} onRefresh={loadParkingAreas} />}
        {view === 'create' && <CreateParkingArea onCreated={loadParkingAreas} />}
        {view === 'bookings' && <OwnerBookings bookings={bookings} />}
        {view === 'analytics' && <AnalyticsDashboard areas={parkingAreas} userRole="owner" />}
      </div>
    </div>
  );
};

// Create Parking Area Form
const CreateParkingArea = ({ onCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    pricePerHour: '',
    rows: 3,
    cols: 4,
    vehicleTypes: [],
    timings: '24/7'
  });
  const [matrix, setMatrix] = useState(Array(3).fill().map(() => Array(4).fill(1)));
  const [entryPoint, setEntryPoint] = useState({ row: 0, col: 0 });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleMatrixChange = (row, col) => {
    const newMatrix = [...matrix];
    
    // If this is the entry point, don't allow changing it to parking slot
    if (entryPoint.row === row && entryPoint.col === col) {
      return;
    }
    
    newMatrix[row][col] = newMatrix[row][col] === 1 ? 0 : 1;
    setMatrix(newMatrix);
  };

  const handleSetEntry = (row, col) => {
    // Entry point must be on a path (0), not a parking slot
    const newMatrix = [...matrix];
    
    // Set old entry back to path
    newMatrix[entryPoint.row][entryPoint.col] = 0;
    
    // Set new entry (also a path)
    newMatrix[row][col] = 0;
    setMatrix(newMatrix);
    setEntryPoint({ row, col });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createParkingArea({
        ...formData,
        layoutMatrix: matrix,
        entryPoint: entryPoint,
        pricePerHour: parseFloat(formData.pricePerHour)
      });
      setSuccess('Parking area created successfully!');
      setError('');
      onCreated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSizeChange = () => {
    const newMatrix = Array(parseInt(formData.rows)).fill().map(() => 
      Array(parseInt(formData.cols)).fill(1)
    );
    // Set entry at top-left by default
    newMatrix[0][0] = 0;
    setMatrix(newMatrix);
    setEntryPoint({ row: 0, col: 0 });
  };

  return (
    <div className="create-area-form">
      <h2>Create Parking Area</h2>
      {success && <div className="success">{success}</div>}
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Parking Area Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Price per Hour (₹)</label>
          <input
            type="number"
            step="0.01"
            value={formData.pricePerHour}
            onChange={(e) => setFormData({ ...formData, pricePerHour: e.target.value })}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Rows</label>
            <input
              type="number"
              min="1"
              max="10"
              value={formData.rows}
              onChange={(e) => setFormData({ ...formData, rows: e.target.value })}
              onBlur={handleSizeChange}
            />
          </div>
          <div className="form-group">
            <label>Columns</label>
            <input
              type="number"
              min="1"
              max="10"
              value={formData.cols}
              onChange={(e) => setFormData({ ...formData, cols: e.target.value })}
              onBlur={handleSizeChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Vehicle Types (select multiple)</label>
          <div className="checkbox-group">
            {['2-wheeler', 'Car', 'SUV', 'EV'].map(type => (
              <label key={type}>
                <input
                  type="checkbox"
                  checked={formData.vehicleTypes.includes(type)}
                  onChange={(e) => {
                    const types = e.target.checked
                      ? [...formData.vehicleTypes, type]
                      : formData.vehicleTypes.filter(t => t !== type);
                    setFormData({ ...formData, vehicleTypes: types });
                  }}
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Parking Layout</label>
          <div className="parking-grid-editor">
            {matrix.map((row, i) => (
              <div key={i} className="grid-row">
                {row.map((cell, j) => {
                  const isEntry = entryPoint.row === i && entryPoint.col === j;
                  return (
                    <div
                      key={`${i}-${j}`}
                      className={`grid-cell ${
                        isEntry ? 'entry' : 
                        cell === 1 ? 'slot' : 'empty'
                      }`}
                      onClick={() => handleMatrixChange(i, j)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleSetEntry(i, j);
                      }}
                    >
                      {isEntry ? '🚗' : cell === 1 ? `${String.fromCharCode(65 + i)}${j + 1}` : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="hint-box">
            <p><strong>Instructions:</strong></p>
            <p>• <strong>Left-click</strong> to toggle between Parking Slot (Green) and Pathway (Gray)</p>
            <p>• <strong>Right-click</strong> to set as Entry Point (Blue with 🚗)</p>
            <p>• Entry point is where vehicles enter the parking area</p>
            <p>• System will calculate shortest path from entry to all slots</p>
          </div>
        </div>

        <button type="submit" className="btn-primary">Create Parking Area</button>
      </form>
    </div>
  );
};

// Owner Parking Areas List
const OwnerParkingAreas = ({ areas }) => {
  return (
    <div className="parking-areas-list">
      <h2>My Parking Areas</h2>
      {areas.length === 0 ? (
        <p>No parking areas created yet.</p>
      ) : (
        <div className="areas-grid">
          {areas.map(area => (
            <div key={area.id} className="area-card">
              <h3>{area.name}</h3>
              <p><strong>Location:</strong> {area.location}</p>
              <p><strong>Total Slots:</strong> {area.totalSlots}</p>
              <p><strong>Available:</strong> {area.slots.filter(s => s.status === 'available').length}</p>
              <p><strong>Price:</strong> ₹{area.pricePerHour}/hour</p>
              <div className="mini-grid">
                {area.layoutMatrix.map((row, i) => (
                  <div key={i} className="mini-row">
                    {row.map((cell, j) => (
                      <div
                        key={`${i}-${j}`}
                        className={`mini-cell ${
                          cell === 0 ? 'empty' :
                          area.slots.find(s => s.row === i && s.col === j)?.status === 'available' ? 'available' :
                          'booked'
                        }`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Owner Bookings
const OwnerBookings = ({ bookings }) => {
  return (
    <div className="bookings-list">
      <h2>All Bookings</h2>
      {bookings.length === 0 ? (
        <p>No bookings yet.</p>
      ) : (
        <table className="bookings-table">
          <thead>
            <tr>
              <th>Parking Area</th>
              <th>Slot</th>
              <th>Vehicle</th>
              <th>User</th>
              <th>Time</th>
              <th>Price</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(booking => (
              <tr key={booking.id}>
                <td>{booking.parkingArea?.name}</td>
                <td>{booking.slotId}</td>
                <td>{booking.vehicle?.vehicleNumber}</td>
                <td>{booking.user?.name}</td>
                <td>{new Date(booking.startTime).toLocaleString()}</td>
                <td>₹{booking.totalPrice}</td>
                <td><span className={`status ${booking.status}`}>{booking.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// User Dashboard
const UserDashboard = () => {
  const [view, setView] = useState('search'); // search, vehicles, bookings, payments, analytics
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [parkingAreas, setParkingAreas] = useState([]);

  useEffect(() => {
    loadVehicles();
    loadBookings();
    loadParkingAreas();
  }, []);

  const loadVehicles = async () => {
    try {
      const data = await api.getVehicles();
      setVehicles(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadBookings = async () => {
    try {
      const data = await api.getUserBookings();
      setBookings(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadParkingAreas = async () => {
    try {
      const data = await api.searchParkingAreas({});
      setParkingAreas(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-nav">
        <button
          className={view === 'search' ? 'active' : ''}
          onClick={() => setView('search')}
        >
          Search Parking
        </button>
        <button
          className={view === 'vehicles' ? 'active' : ''}
          onClick={() => setView('vehicles')}
        >
          My Vehicles
        </button>
        <button
          className={view === 'bookings' ? 'active' : ''}
          onClick={() => setView('bookings')}
        >
          My Bookings
        </button>
        <button
          className={view === 'payments' ? 'active' : ''}
          onClick={() => setView('payments')}
        >
          💳 Payments
        </button>
        <button
          className={view === 'analytics' ? 'active' : ''}
          onClick={() => setView('analytics')}
        >
          📊 Analytics
        </button>
      </div>

      <div className="dashboard-content">
        {view === 'search' && <SearchParking vehicles={vehicles} onBookingCreated={loadBookings} />}
        {view === 'vehicles' && <VehicleManagement vehicles={vehicles} onVehicleAdded={loadVehicles} />}
        {view === 'bookings' && <UserBookings bookings={bookings} onRefresh={loadBookings} />}
        {view === 'payments' && <PaymentsView />}
        {view === 'analytics' && <AnalyticsDashboard areas={parkingAreas} userRole="user" />}
      </div>
    </div>
  );
};

// Vehicle Management
const VehicleManagement = ({ vehicles, onVehicleAdded }) => {
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    vehicleType: '2-wheeler',
    model: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.registerVehicle(formData);
      setSuccess('Vehicle registered successfully!');
      setError('');
      setFormData({ vehicleNumber: '', vehicleType: '2-wheeler', model: '' });
      onVehicleAdded();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="vehicle-management">
      <h2>My Vehicles</h2>
      
      <div className="add-vehicle-form">
        <h3>Register New Vehicle</h3>
        {success && <div className="success">{success}</div>}
        {error && <div className="error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Vehicle Number</label>
            <input
              type="text"
              value={formData.vehicleNumber}
              onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
              placeholder="e.g., MH12AB1234"
              required
            />
          </div>
          <div className="form-group">
            <label>Vehicle Type</label>
            <select
              value={formData.vehicleType}
              onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
            >
              <option value="2-wheeler">2-wheeler</option>
              <option value="Car">Car</option>
              <option value="SUV">SUV</option>
              <option value="EV">EV</option>
            </select>
          </div>
          <div className="form-group">
            <label>Model (Optional)</label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              placeholder="e.g., Honda City"
            />
          </div>
          <button type="submit" className="btn-primary">Register Vehicle</button>
        </form>
      </div>

      <div className="vehicles-list">
        <h3>Registered Vehicles</h3>
        {vehicles.length === 0 ? (
          <p>No vehicles registered yet.</p>
        ) : (
          <div className="vehicles-grid">
            {vehicles.map(vehicle => (
              <div key={vehicle.id} className="vehicle-card">
                <h4>{vehicle.vehicleNumber}</h4>
                <p><strong>Type:</strong> {vehicle.vehicleType}</p>
                {vehicle.model && <p><strong>Model:</strong> {vehicle.model}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Search Parking
const SearchParking = ({ vehicles, onBookingCreated }) => {
  const [searchParams, setSearchParams] = useState({
    location: '',
    vehicleType: ''
  });
  const [parkingAreas, setParkingAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [bookingData, setBookingData] = useState({
    vehicleId: '',
    slotId: '',
    startTime: '',
    endTime: ''
  });
  const [allocationMode, setAllocationMode] = useState('auto'); // 'auto' or 'manual'
  const [nearestSlot, setNearestSlot] = useState(null);

  const handleSearch = async () => {
    try {
      const areas = await api.searchParkingAreas(searchParams);
      setParkingAreas(areas);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAreaSelect = async (area) => {
    setSelectedArea(area);
    
    // Fetch nearest available slot
    try {
      const nearest = await api.getNearestSlot(area.id);
      setNearestSlot(nearest);
      if (allocationMode === 'auto') {
        setBookingData({ ...bookingData, slotId: nearest.id });
      }
    } catch (err) {
      console.error('No available slots');
      setNearestSlot(null);
    }
  };

  const handleBooking = async () => {
    if (!bookingData.vehicleId || !bookingData.slotId || !bookingData.startTime || !bookingData.endTime) {
      alert('Please fill all booking details');
      return;
    }
    const startMs = new Date(bookingData.startTime).getTime();
    const endMs = new Date(bookingData.endTime).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      alert('Invalid start or end time');
      return;
    }
    if (endMs <= startMs) {
      alert('End time must be after start time. For overnight parking, set the end date to the next calendar day.');
      return;
    }

    try {
      await api.createBooking({
        parkingAreaId: selectedArea.id,
        ...bookingData
      });
      alert('Booking created successfully!');
      setSelectedArea(null);
      setBookingData({ vehicleId: '', slotId: '', startTime: '', endTime: '' });
      setNearestSlot(null);
      onBookingCreated();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSlotSelect = (slot) => {
    if (slot && slot.status === 'available') {
      setBookingData({ ...bookingData, slotId: slot.id });
      setAllocationMode('manual');
    }
  };

  const handleAutoAllocate = () => {
    if (nearestSlot) {
      setBookingData({ ...bookingData, slotId: nearestSlot.id });
      setAllocationMode('auto');
    }
  };

  if (selectedArea) {
    return (
      <div className="booking-view">
        <button onClick={() => setSelectedArea(null)} className="btn-secondary">← Back to Search</button>
        
        <div className="area-details">
          <h2>{selectedArea.name}</h2>
          <p><strong>Location:</strong> {selectedArea.location}</p>
          <p><strong>Price:</strong> ₹{selectedArea.pricePerHour}/hour</p>
          <p><strong>Available Slots:</strong> {selectedArea.availableSlots}/{selectedArea.totalSlots}</p>
          {nearestSlot && (
            <div className="nearest-slot-info">
              <p><strong>🎯 Nearest Available Slot:</strong> {nearestSlot.id} (Distance: {nearestSlot.distance} steps from entry)</p>
            </div>
          )}
        </div>

        <div className="allocation-toggle">
          <button 
            className={`toggle-btn ${allocationMode === 'auto' ? 'active' : ''}`}
            onClick={handleAutoAllocate}
          >
            🤖 Auto-Allocate (Nearest)
          </button>
          <button 
            className={`toggle-btn ${allocationMode === 'manual' ? 'active' : ''}`}
            onClick={() => setAllocationMode('manual')}
          >
            👆 Manual Selection
          </button>
        </div>

        <div className="parking-layout">
          <h3>Parking Layout</h3>
          <div className="parking-grid">
            {selectedArea.layoutMatrix.map((row, i) => (
              <div key={i} className="grid-row">
                {row.map((cell, j) => {
                  const slot = selectedArea.slots.find(s => s.row === i && s.col === j);
                  const isEntry = selectedArea.entryPoint && 
                                 selectedArea.entryPoint.row === i && 
                                 selectedArea.entryPoint.col === j;
                  const isNearest = nearestSlot && slot && slot.id === nearestSlot.id;
                  
                  return (
                    <div
                      key={`${i}-${j}`}
                      className={`grid-cell ${
                        isEntry ? 'entry' :
                        cell === 0 ? 'empty' :
                        slot?.status === 'available' ? 'available' :
                        slot?.status === 'booked' ? 'booked' :
                        'disabled'
                      } ${bookingData.slotId === slot?.id ? 'selected' : ''} ${isNearest ? 'nearest' : ''}`}
                      onClick={() => handleSlotSelect(slot)}
                      title={slot ? `Slot ${slot.id} - Distance: ${slot.distance} steps` : ''}
                    >
                      {isEntry ? '🚗' : cell === 1 && slot?.id}
                      {slot && slot.status === 'available' && (
                        <div className="distance-badge">{slot.distance}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="legend">
            <span className="legend-item"><div className="legend-box entry"></div>Entry Point</span>
            <span className="legend-item"><div className="legend-box available"></div>Available</span>
            <span className="legend-item"><div className="legend-box booked"></div>Booked</span>
            <span className="legend-item"><div className="legend-box nearest"></div>Nearest</span>
          </div>
        </div>

        <div className="booking-form">
          <h3>Book Slot</h3>
          <div className="form-group">
            <label>Select Vehicle</label>
            <select
              value={bookingData.vehicleId}
              onChange={(e) => setBookingData({ ...bookingData, vehicleId: e.target.value })}
            >
              <option value="">Select a vehicle</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.vehicleNumber} ({v.vehicleType})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Selected Slot</label>
            <input type="text" value={bookingData.slotId} readOnly />
          </div>
          <div className="form-group">
            <label>Start Time</label>
            <input
              type="datetime-local"
              value={bookingData.startTime}
              onChange={(e) => setBookingData({ ...bookingData, startTime: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>End Time</label>
            <input
              type="datetime-local"
              value={bookingData.endTime}
              onChange={(e) => setBookingData({ ...bookingData, endTime: e.target.value })}
            />
            <p className="hint">Must be after start (change the date for overnight parking).</p>
          </div>
          <button onClick={handleBooking} className="btn-primary">Confirm Booking</button>
        </div>
      </div>
    );
  }

  return (
    <div className="search-parking">
      <h2>Search Parking Areas</h2>
      
      <div className="search-form">
        <div className="form-group">
          <label>Location</label>
          <input
            type="text"
            value={searchParams.location}
            onChange={(e) => setSearchParams({ ...searchParams, location: e.target.value })}
            placeholder="Enter location"
          />
        </div>
        <div className="form-group">
          <label>Vehicle Type</label>
          <select
            value={searchParams.vehicleType}
            onChange={(e) => setSearchParams({ ...searchParams, vehicleType: e.target.value })}
          >
            <option value="">All Types</option>
            <option value="2-wheeler">2-wheeler</option>
            <option value="Car">Car</option>
            <option value="SUV">SUV</option>
            <option value="EV">EV</option>
          </select>
        </div>
        <button onClick={handleSearch} className="btn-primary">Search</button>
      </div>

      <div className="search-results">
        {parkingAreas.length === 0 ? (
          <p>No parking areas found. Try searching with different criteria.</p>
        ) : (
          <div className="areas-grid">
            {parkingAreas.map(area => (
              <div key={area.id} className="area-card clickable" onClick={() => handleAreaSelect(area)}>
                <h3>{area.name}</h3>
                <p><strong>Location:</strong> {area.location}</p>
                <p><strong>Available:</strong> {area.availableSlots}/{area.totalSlots} slots</p>
                <p><strong>Price:</strong> ₹{area.pricePerHour}/hour</p>
                <p><strong>Vehicle Types:</strong> {area.vehicleTypes.join(', ')}</p>
                <button className="btn-secondary">View & Book</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// User Bookings
const UserBookings = ({ bookings, onRefresh }) => {
  const { refreshWallet } = useAuth();
  const [payingBooking, setPayingBooking] = useState(null);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    
    try {
      await api.cancelBooking(id);
      alert('Booking cancelled successfully!');
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStopBooking = async (id) => {
    if (!window.confirm('Stop this booking and check out?')) return;
    
    try {
      const res = await api.punchOut({ bookingId: id });
      if (res.walletPayment?.success) {
        alert(
          res.walletPayment.paidAmount > 0
            ? `Checked out. ₹${res.walletPayment.paidAmount} paid from your wallet. New balance: ₹${res.walletPayment.newWalletBalance}.`
            : 'Checked out. No charge (₹0).'
        );
        refreshWallet();
      } else if (res.walletPayment?.reason === 'insufficient_wallet_balance') {
        alert(
          `Checked out. Wallet balance ₹${res.walletPayment.walletBalance} is not enough for ₹${res.walletPayment.amountDue}. Please add money and use Pay Now.`
        );
      } else {
        alert('Checked out successfully!');
      }
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="bookings-list">
      <h2>My Bookings</h2>
      {bookings.length === 0 ? (
        <p>No bookings yet.</p>
      ) : (
        <div className="bookings-cards">
          {bookings.map(booking => (
            <div key={booking.id} className="booking-card">
              <h3>{booking.parkingArea?.name}</h3>
              <p><strong>Location:</strong> {booking.parkingArea?.location}</p>
              <p><strong>Slot:</strong> {booking.slotId}</p>
              <p><strong>Vehicle:</strong> {booking.vehicle?.vehicleNumber}</p>
              <p><strong>Start:</strong> {new Date(booking.startTime).toLocaleString()}</p>
              {booking.endTime && (
                <p><strong>End:</strong> {new Date(booking.endTime).toLocaleString()}</p>
              )}
              {booking.hours && (
                <>
                  <p><strong>Duration:</strong> {booking.hours} hours</p>
                  <p><strong>Total Price:</strong> ₹{booking.totalPrice}</p>
                </>
              )}
              <p><strong>Status:</strong> <span className={`status ${booking.status}`}>{booking.status}</span></p>
              
              {booking.paymentStatus === 'paid' && (
                <p className="payment-status paid">✅ Paid ₹{booking.paidAmount}</p>
              )}
              
              {booking.status === 'active' && (
                <div className="button-group">
                  <button onClick={() => handleStopBooking(booking.id)} className="btn-primary">
                    🛑 Stop Booking
                  </button>
                  <button onClick={() => handleCancel(booking.id)} className="btn-danger">
                    Cancel
                  </button>
                </div>
              )}

              {booking.status === 'completed' && booking.paymentStatus !== 'paid' && (
                <button onClick={() => setPayingBooking(booking)} className="btn-payment">
                  💳 Pay Now
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {payingBooking && (
        <PaymentModal 
          booking={payingBooking} 
          onClose={() => {
            setPayingBooking(null);
            onRefresh();
            refreshWallet();
          }} 
        />
      )}
    </div>
  );
};

// ============ ANALYTICS COMPONENTS ============

// Analytics Dashboard
const AnalyticsDashboard = ({ areas, userRole }) => {
  const [selectedArea, setSelectedArea] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    if (areas.length > 0 && !selectedArea) {
      setSelectedArea(areas[0].id);
    }
  }, [areas]);

  useEffect(() => {
    if (selectedArea) {
      loadAnalytics();
    }
  }, [selectedArea]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await api.getAnalytics(selectedArea);
      setAnalytics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (areas.length === 0) {
    return (
      <div className="empty-state">
        <h2>📊 No Parking Areas Available</h2>
        <p>{userRole === 'owner' ? 'Create a parking area to see analytics' : 'No parking areas to analyze'}</p>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <h2>📊 Traffic Analytics</h2>

      <div className="analytics-controls">
        <div className="form-group">
          <label>Select Parking Area:</label>
          <select
            value={selectedArea || ''}
            onChange={(e) => setSelectedArea(e.target.value)}
          >
            {areas.map(area => (
              <option key={area.id} value={area.id}>
                {area.name} - {area.location}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading analytics data...</div>
      ) : analytics ? (
        <>
          {/* Summary Cards */}
          <div className="analytics-summary">
            <div className="summary-card">
              <div className="card-icon">📅</div>
              <h3>Total Bookings</h3>
              <p className="big-number">{analytics.summary.totalBookings}</p>
            </div>
            <div className="summary-card">
              <div className="card-icon">🚗</div>
              <h3>Currently Occupied</h3>
              <p className="big-number">{analytics.summary.currentOccupied}/{analytics.parkingArea.totalSlots}</p>
              <p className="small-text">{analytics.summary.occupancyRate}% occupancy</p>
            </div>
            <div className="summary-card">
              <div className="card-icon">⏰</div>
              <h3>Peak Hour</h3>
              <p className="big-number">{analytics.peakHour.time}</p>
              <p className="small-text">{analytics.peakHour.count} bookings</p>
            </div>
            <div className="summary-card">
              <div className="card-icon">💰</div>
              <h3>Total Revenue</h3>
              <p className="big-number">₹{analytics.summary.totalRevenue}</p>
              <p className="small-text">Avg {analytics.summary.avgDuration.toFixed(1)}hrs per booking</p>
            </div>
          </div>

          {/* Hourly Traffic Chart */}
          <div className="analytics-chart-section">
            <h3>📈 Hourly Traffic Pattern</h3>
            
            {/* Day Selector Slider */}
            <div className="day-selector">
              <label>Select Day:</label>
              <div className="day-buttons">
                {daysOfWeek.map(day => (
                  <button
                    key={day}
                    className={selectedDay === day ? 'day-btn active' : 'day-btn'}
                    onClick={() => setSelectedDay(day)}
                  >
                    {day.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {/* Hourly Bar Chart */}
            <div className="hourly-chart">
              <div className="chart-title">{selectedDay} - Hourly Traffic</div>
              <div className="chart-container">
                <div className="chart-y-axis">
                  <div className="y-label">Bookings</div>
                  <div className="y-ticks">
                    {[...Array(6)].map((_, i) => {
                      const maxValue = Math.max(...(analytics.hourlyTraffic[selectedDay] || []));
                      const tickValue = Math.ceil(maxValue / 5) * (5 - i);
                      return (
                        <div key={i} className="y-tick">
                          {tickValue > 0 ? tickValue : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="chart-bars">
                  {analytics.hourlyTraffic[selectedDay]?.map((count, hour) => {
                    const dayHours = analytics.hourlyTraffic[selectedDay] || [];
                    const maxCount = Math.max(1, ...dayHours);
                    const height = (count / maxCount) * 100;
                    const isPeak = hour === analytics.peakHour.hour;
                    
                    return (
                      <div key={hour} className="bar-container">
                        <div className="bar-track">
                          <div 
                            className={`bar ${isPeak ? 'peak' : ''}`}
                            style={{ height: `${height}%` }}
                            title={`${hour}:00 - ${count} bookings`}
                          >
                            {count > 0 && <span className="bar-value">{count}</span>}
                          </div>
                        </div>
                        <div className="bar-label">{hour < 10 ? `0${hour}` : hour}:00</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Overview */}
          <div className="weekly-overview">
            <h3>📅 Weekly Traffic Overview</h3>
            <div className="weekly-bars">
              {daysOfWeek.map(day => {
                const dayTotal = analytics.dailyTraffic[day] || 0;
                const maxDaily = Math.max(1, ...Object.values(analytics.dailyTraffic));
                const percentage = (dayTotal / maxDaily) * 100;
                
                return (
                  <div key={day} className="weekly-bar-item">
                    <div className="weekly-bar-track">
                      <div 
                        className="weekly-bar"
                        style={{ height: `${percentage}%` }}
                      >
                        {dayTotal > 0 && <span className="weekly-bar-value">{dayTotal}</span>}
                      </div>
                    </div>
                    <div className="weekly-bar-label">{day.substring(0, 3)}</div>
                    {dayTotal === 0 && <span className="weekly-bar-value weekly-bar-value-zero">0</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional Stats */}
          <div className="additional-stats">
            <h3>📋 Additional Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Active Bookings:</span>
                <span className="stat-value">{analytics.summary.activeBookings}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Completed Bookings:</span>
                <span className="stat-value">{analytics.summary.completedBookings}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Available Slots:</span>
                <span className="stat-value">
                  {analytics.parkingArea.totalSlots - analytics.summary.currentOccupied}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Duration:</span>
                <span className="stat-value">{analytics.summary.avgDuration.toFixed(1)} hours</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>No analytics data available yet.</p>
          <p>Start getting bookings to see traffic patterns!</p>
        </div>
      )}
    </div>
  );
};

// ============ PAYMENT COMPONENTS ============

function formatCardNumberGroups(value) {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

function formatExpiryMMYY(value) {
  let d = value.replace(/\D/g, '').slice(0, 4);
  if (d.length >= 2) {
    return `${d.slice(0, 2)}/${d.slice(2, 4)}`;
  }
  return d;
}

// Add Money (wallet) — same modal shell & card field behaviour as standard checkout
const AddMoneyModal = ({ onClose, onAdded }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cardDigits = cardNumber.replace(/\D/g, '');
    if (cardDigits.length !== 16) {
      alert('Card number must be exactly 16 digits (groups of 4).');
      return;
    }
    const expDigits = expiry.replace(/\D/g, '');
    if (expDigits.length !== 4) {
      alert('Enter expiry as MM/YY (4 digits).');
      return;
    }
    const mm = parseInt(expDigits.slice(0, 2), 10);
    if (mm < 1 || mm > 12) {
      alert('Expiry month must be between 01 and 12.');
      return;
    }
    const cvvDigits = cvv.replace(/\D/g, '');
    if (cvvDigits.length < 3 || cvvDigits.length > 4) {
      alert('CVV must be 3 or 4 digits.');
      return;
    }
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    setProcessing(true);
    try {
      await api.addWalletMoney(num);
      onAdded();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>✕</button>
        <h2>💰 Add Money</h2>
        <form onSubmit={handleSubmit} className="payment-form">
          <h3>Payment Details</h3>
          <div className="form-group">
            <label>Card Number</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumberGroups(e.target.value))}
              placeholder="4242 4242 4242 4242"
              maxLength={19}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Expiry (MM/YY)</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiryMMYY(e.target.value))}
                placeholder="MM/YY"
                maxLength={5}
              />
            </div>
            <div className="form-group">
              <label>CVV</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="cc-csc"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                maxLength={4}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Amount to Add (₹)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
            />
          </div>
          <div className="test-card-notice">
            Mock payment: card is not charged. Enter 16 digits as 4×4 groups, MM/YY, and CVV. Only the amount is added to your wallet.
          </div>
          <button type="submit" disabled={processing} className="btn-payment">
            {processing ? '⏳ Processing...' : 'Add Money'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Payment Modal
const PaymentModal = ({ booking, onClose }) => {
  const { walletBalance } = useAuth();
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const result = await api.calculatePrice(booking.id);
      setPricing(result.pricing);
      setLoading(false);
    } catch (err) {
      alert(err.message);
      onClose();
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      await api.payBookingWithWallet(booking.id);
      alert('Payment successful! 🎉');
      onClose();
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Insufficient wallet balance')) {
        alert('Insufficient wallet balance');
      } else {
        alert(msg || 'Payment failed');
      }
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <h2>Loading payment details...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        <h2>💳 Complete Payment</h2>
        
        <div className="payment-summary">
          <h3>Parking Summary</h3>
          <div className="summary-row">
            <span>Location:</span>
            <span>{booking.parkingArea?.name}</span>
          </div>
          <div className="summary-row">
            <span>Vehicle:</span>
            <span>{booking.vehicle?.vehicleNumber}</span>
          </div>
          <div className="summary-row">
            <span>Duration:</span>
            <span>
              {pricing.elapsedMinutes != null
                ? `${pricing.elapsedMinutes.toFixed(1)} minutes (${pricing.durationHours.toFixed(2)} hr)`
                : `${pricing.durationHours} hours (${pricing.durationMinutes} minutes)`}
            </span>
          </div>
          <div className="summary-row">
            <span>Rate:</span>
            <span>
              ₹{pricing.pricePerHour}/hr (₹
              {(pricing.ratePerMinute != null ? pricing.ratePerMinute : pricing.pricePerHour / 60).toFixed(2)}
              /min)
            </span>
          </div>
        </div>

        <div className="price-breakdown">
          <h3>Price Breakdown</h3>
          <div className="breakdown-row">
            <span>
              Subtotal (
              {pricing.elapsedMinutes != null
                ? `${pricing.elapsedMinutes.toFixed(1)} min × ₹${(pricing.ratePerMinute != null ? pricing.ratePerMinute : pricing.pricePerHour / 60).toFixed(2)}/min`
                : `${pricing.durationHours} hr × ₹${pricing.pricePerHour}/hr`}
              ):
            </span>
            <span>₹{pricing.subtotal}</span>
          </div>
          {pricing.discount > 0 && (
            <div className="breakdown-row discount">
              <span>Discount ({pricing.discountPercent}% off):</span>
              <span>-₹{pricing.discount}</span>
            </div>
          )}
          <div className="breakdown-row">
            <span>GST ({pricing.gstPercent != null ? pricing.gstPercent : 18}%):</span>
            <span>₹{pricing.tax}</span>
          </div>
          <div className="breakdown-row total">
            <span><strong>Total Amount:</strong></span>
            <span><strong>₹{pricing.total}</strong></span>
          </div>
        </div>

        {pricing.discountPercent > 0 && (
          <div className="discount-badge">
            🎉 You saved ₹{pricing.discount} with {pricing.discountPercent}% long-stay discount!
          </div>
        )}

        <form onSubmit={handlePayment} className="payment-form">
          <h3>Pay from wallet</h3>
          <div className="price-breakdown">
            <div className="breakdown-row">
              <span>Wallet balance</span>
              <span>₹{(walletBalance != null ? walletBalance : 0).toFixed(2)}</span>
            </div>
            <div className="breakdown-row total">
              <span><strong>Amount due</strong></span>
              <span><strong>₹{pricing.total}</strong></span>
            </div>
          </div>
          <div className="test-card-notice">
            Total is charged from your wallet (same amount as shown above). Add money from the header if needed.
          </div>
          <button type="submit" disabled={processing} className="btn-payment">
            {processing ? '⏳ Processing...' : `💳 Pay Now`}
          </button>
        </form>
      </div>
    </div>
  );
};

// Payments View
const PaymentsView = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const data = await api.getPaymentHistory();
      setPayments(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading payment history...</div>;
  }

  return (
    <div className="payments-view">
      <h2>💳 Payment History</h2>
      
      {payments.length === 0 ? (
        <div className="empty-state">
          <p>No payments yet.</p>
          <p>Your completed bookings will appear here once paid.</p>
        </div>
      ) : (
        <>
          <div className="payments-summary">
            <div className="summary-card">
              <h3>Total Payments</h3>
              <p className="big-number">{payments.length}</p>
            </div>
            <div className="summary-card">
              <h3>Total Spent</h3>
              <p className="big-number">
                ₹{payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="payments-table-container">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Parking Area</th>
                  <th>Vehicle</th>
                  <th>Duration</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(payment => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.paidAt).toLocaleDateString()}</td>
                    <td>
                      <div className="table-location">
                        <strong>{payment.parkingArea}</strong>
                        <small>{payment.location}</small>
                      </div>
                    </td>
                    <td>{payment.vehicle}</td>
                    <td>{payment.duration} hours</td>
                    <td className="amount">₹{payment.amount.toFixed(2)}</td>
                    <td><span className="status paid">Paid</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// ============ CAMERA DASHBOARD ============

const CameraDashboard = () => {
  const { user } = useAuth();
  const [parkingAreas, setParkingAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [lockedArea, setLockedArea] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const isPunchIn = user.role === 'camera-in';
  const isPunchOut = user.role === 'camera-out';

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CAMERA_AREA_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) {
          setSelectedArea(parsed.id);
          setLockedArea(parsed);
          return;
        }
      }
    } catch (_) {
      /* ignore */
    }
    loadParkingAreas();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const startWebcam = async () => {
      setCameraReady(false);
      setError('');
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser does not support webcam access.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          if (!cancelled) setError('Video element not available.');
          return;
        }
        video.srcObject = stream;
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Video failed to load'));
        });
        await video.play();
        if (!cancelled) setCameraReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.name === 'NotAllowedError'
              ? 'Camera permission denied. Allow webcam access for this site and refresh.'
              : err.message || 'Could not open laptop webcam.'
          );
          setCameraReady(false);
        }
      }
    };

    startWebcam();

    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
      }
    };
  }, []);

  const loadParkingAreas = async () => {
    try {
      const areas = await api.searchParkingAreas({});
      setParkingAreas(areas);
      if (areas.length > 0) {
        setSelectedArea((prev) => prev || areas[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const captureFrameAsDataUrl = () => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.92);
  };

  const handleProcess = async () => {
    if (!selectedArea) {
      setError('Please select a parking area');
      return;
    }
    if (!cameraReady) {
      setError('Webcam is not ready yet');
      return;
    }
    const frameDataUrl = captureFrameAsDataUrl();
    if (!frameDataUrl) {
      setError('Could not capture a frame from the webcam');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      // Step 1: Detect plate using camera service (YOLO + Tesseract on server)
      const plateResult = await api.detectPlate(frameDataUrl);
      const vehicleNumber = plateResult.plateNumber;

      // Step 2: Perform punch in or punch out
      if (isPunchIn) {
        const booking = await api.punchIn({
          vehicleNumber,
          parkingAreaId: selectedArea
        });
        
        setResult({
          type: 'punch-in',
          ...plateResult,
          booking: booking.booking,
          vehicle: booking.vehicle,
          slot: booking.slot
        });
      } else if (isPunchOut) {
        const punchOutResult = await api.punchOut({
          vehicleNumber,
          parkingAreaId: selectedArea
        });
        
        setResult({
          type: 'punch-out',
          ...plateResult,
          ...punchOutResult
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError('');
  };

  return (
    <div className="camera-dashboard">
      <h1>{isPunchIn ? '📹 Punch In Camera' : '📹 Punch Out Camera'}</h1>
      
      <div className="camera-controls">
        {lockedArea ? (
          <div className="camera-area-locked">
            <p className="camera-area-locked-label">Parking area</p>
            <p className="camera-area-locked-value">
              <strong>{lockedArea.name || 'Selected lot'}</strong>
              {lockedArea.location ? <span> — {lockedArea.location}</span> : null}
            </p>
            <p className="camera-area-locked-note">
              To use a different lot, log out and sign in again from the login page.
            </p>
          </div>
        ) : (
          <div className="form-group">
            <label>Select Parking Area</label>
            <select
              value={selectedArea || ''}
              onChange={(e) => setSelectedArea(e.target.value)}
            >
              <option value="">Select parking area</option>
              {parkingAreas.map(area => (
                <option key={area.id} value={area.id}>
                  {area.name} - {area.location}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group camera-webcam-block">
          <label>Live webcam (frame is sent to YOLO + Tesseract)</label>
          <div className="camera-webcam-wrap">
            <video
              ref={videoRef}
              className="camera-live-video"
              playsInline
              muted
              autoPlay
              aria-label="Live parking camera preview"
            />
            {!cameraReady && !error && (
              <p className="camera-webcam-status">Starting webcam…</p>
            )}
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="button-group">
          <button
            onClick={handleProcess}
            disabled={!cameraReady || !selectedArea || processing}
            className="btn-primary"
          >
            {processing ? '🔄 Processing...' : isPunchIn ? '✅ Punch In' : '🚪 Punch Out'}
          </button>
          <button onClick={handleReset} className="btn-secondary">
            🔄 Reset
          </button>
        </div>

        {result && (
          <div className="result-panel">
            <h2>✅ {isPunchIn ? 'Punch In Successful!' : 'Punch Out Successful!'}</h2>
            
            <div className="result-details">
              <h3>Detected Information:</h3>
              <p><strong>Vehicle Number:</strong> {result.plateNumber}</p>
              <p><strong>Confidence:</strong> {(result.confidence * 100).toFixed(1)}%</p>
              
              {result.plateImage && (
                <div className="detected-images">
                  <div className="detected-image">
                    <h4>Detected Plate:</h4>
                    <img src={result.plateImage} alt="Detected plate" />
                  </div>
                  <div className="detected-image">
                    <h4>Processed Image:</h4>
                    <img src={result.processedImage} alt="Processed" />
                  </div>
                </div>
              )}

              {isPunchIn && result.booking && (
                <div className="booking-info">
                  <h3>Booking Details:</h3>
                  <p><strong>Slot Assigned:</strong> {result.slot.id}</p>
                  <p><strong>Distance from Entry:</strong> {result.slot.distance} steps</p>
                  <p><strong>Start Time:</strong> {new Date(result.booking.punchInTime).toLocaleString()}</p>
                  <p><strong>Vehicle:</strong> {result.vehicle.vehicleNumber} ({result.vehicle.vehicleType})</p>
                </div>
              )}

              {isPunchOut && result.duration && (
                <div className="checkout-info">
                  <h3>Checkout Summary:</h3>
                  <p><strong>Parking Duration:</strong> {result.duration.hours} hours ({result.duration.minutes} minutes)</p>
                  <p><strong>Total Price:</strong> ₹{result.duration.totalPrice}</p>
                  <p><strong>Check-Out Time:</strong> {new Date().toLocaleString()}</p>
                  {result.walletPayment?.success && (
                    <p className="payment-status paid">
                      {result.walletPayment.paidAmount > 0
                        ? `✅ ₹${result.walletPayment.paidAmount} deducted from user wallet (balance ₹${result.walletPayment.newWalletBalance})`
                        : '✅ No charge (₹0); marked paid'}
                    </p>
                  )}
                  {result.walletPayment && !result.walletPayment.success && result.walletPayment.reason === 'insufficient_wallet_balance' && (
                    <p className="payment-status unpaid">
                      ⚠️ Wallet insufficient (has ₹{result.walletPayment.walletBalance}, needs ₹{result.walletPayment.amountDue}) — user must pay in app
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============ MAIN APP ============

function App() {
  const { user, logout, walletBalance, refreshWallet } = useAuth();
  const [authView, setAuthView] = useState('login');
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  useEffect(() => {
    if (user?.role !== 'user') return;
    try {
      if (sessionStorage.getItem('smartParkingOpenWalletOnUserRegister') === '1') {
        sessionStorage.removeItem('smartParkingOpenWalletOnUserRegister');
        setWalletModalOpen(true);
      }
    } catch (_) {
      /* ignore */
    }
  }, [user?.id, user?.role]);

  if (!user) {
    return authView === 'login' 
      ? <LoginPage onSwitchToRegister={() => setAuthView('register')} />
      : <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
  }

  return (
    <div className="App">
      <header className="app-header">
        <h1>🅿️ Smart Parking</h1>
        <div className="user-info">
          <span>Welcome, {user.name} ({user.role})</span>
          {user.role === 'user' && (
            <button
              type="button"
              className="wallet-trigger"
              onClick={() => setWalletModalOpen(true)}
              title="Add money to wallet"
            >
              ₹{(walletBalance != null ? walletBalance : 0).toFixed(2)}
            </button>
          )}
          <button type="button" onClick={logout} className="btn-secondary">Logout</button>
        </div>
      </header>
      {user.role === 'user' && walletModalOpen && (
        <AddMoneyModal
          onClose={() => setWalletModalOpen(false)}
          onAdded={refreshWallet}
        />
      )}
      
      <main className="app-main">
        {user.role === 'owner' ? (
          <OwnerDashboard />
        ) : user.role === 'camera-in' || user.role === 'camera-out' ? (
          <CameraDashboard />
        ) : (
          <UserDashboard />
        )}
      </main>
    </div>
  );
}

function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

export default AppWrapper;
