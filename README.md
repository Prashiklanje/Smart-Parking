# 🅿️ Smart Parking Slot Booking System

A comprehensive web-based platform for managing and booking parking spaces with real-time availability, 2D layout visualization, and role-based access control.

## 🌟 Features

### For Parking Owners
- Register and manage multiple parking areas
- Create custom parking layouts using 2D matrix representation with entry points
- Set pricing and availability timings
- View all bookings and occupancy analytics
- Enable/disable specific parking slots
- Real-time dashboard with slot status

### For Parking Users
- Search parking areas by location and vehicle type
- Register multiple vehicles
- View real-time parking layout with availability
- Auto-allocate nearest slot OR manually select preferred slot
- Manage booking history
- Cancel or stop active bookings from dashboard

### 📹 Camera Punch In/Out (NEW!)
- **AI-powered automatic entry/exit system**
- **YOLO v8** number plate detection
- **Tesseract OCR** text recognition
- Touchless parking experience
- Automatic slot assignment on entry
- Automatic checkout and billing on exit
- Real-time booking management
- Separate camera operator roles

## 🏗️ System Architecture

### Technology Stack
- **Frontend**: React.js with modern hooks and context API
- **Backend**: Node.js + Express.js
- **Camera Service**: Python Flask + YOLO v8 + Tesseract OCR
- **Authentication**: JWT (JSON Web Tokens)
- **Database**: In-memory storage (easily upgradable to MongoDB)
- **Styling**: Custom CSS with gradient themes
- **AI/ML**: Ultralytics YOLO, OpenCV, Pytesseract

### Key Components

#### Backend (Express.js)
```
/api/auth          - Authentication endpoints
/api/parking-areas - Parking area management
/api/vehicles      - Vehicle registration
/api/bookings      - Booking management
```

#### Frontend (React)
```
- AuthContext      - Global authentication state
- OwnerDashboard   - Parking owner interface
- UserDashboard    - Parking user interface
- ParkingLayout    - 2D grid visualization
- BookingSystem    - Slot booking workflow
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd smart-parking/backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the backend server:
```bash
npm start
```

The backend will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd smart-parking/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## 📖 Usage Guide

### For Parking Owners

1. **Register as Owner**
   - Select "Parking Owner" role during registration
   - Provide name, email, phone, and password

2. **Create Parking Area**
   - Click "Create New Area" in dashboard
   - Enter parking area details:
     - Name and location
     - Price per hour
     - Select allowed vehicle types
   - Design layout using the grid editor:
     - Click cells to toggle between parking slot (green) and pathway (gray)
     - Slots are automatically labeled (A1, A2, B1, etc.)
   - Submit to create the parking area

3. **Manage Parking Areas**
   - View all your parking areas
   - See real-time occupancy
   - Monitor bookings and revenue

### For Parking Users

1. **Register as User**
   - Select "Parking User" role during registration
   - Provide personal details

2. **Register Vehicle**
   - Go to "My Vehicles" tab
   - Add vehicle details:
     - Vehicle number (e.g., MH12AB1234)
     - Vehicle type (2-wheeler, Car, SUV, EV)
     - Model (optional)

3. **Search & Book Parking**
   - Go to "Search Parking" tab
   - Filter by location and vehicle type
   - Click on a parking area to view layout
   - Select an available slot (green)
   - Choose vehicle and time duration
   - Confirm booking

4. **Manage Bookings**
   - View active and past bookings
   - Cancel active bookings if needed

## 🎨 2D Matrix Parking Layout System

### Matrix Representation
The parking layout uses a 2D array where:
- `1` = Valid parking slot
- `0` = Empty space / pathway / obstacle

Example 3x4 layout:
```javascript
[
  [1, 1, 0, 1],  // Row A: Slots A1, A2, A4
  [1, 1, 1, 1],  // Row B: Slots B1, B2, B3, B4
  [0, 1, 1, 0]   // Row C: Slots C2, C3
]
```

### Visual Representation
- **Green cells**: Available parking slots
- **Red cells**: Booked slots
- **Gray cells**: Pathways/empty spaces
- **Yellow border**: Currently selected slot

### Automatic Slot ID Generation
Slots are automatically assigned IDs based on position:
- Format: `[ROW_LETTER][COLUMN_NUMBER]`
- Example: A1, A2, B1, B2, C3, etc.

## 🔐 Security Features

### Authentication
- Password hashing using bcrypt
- JWT-based session management
- Role-based access control
- Protected API routes

### Authorization
- Users can only access their own data
- Owners can only manage their parking areas
- Booking validation prevents double-booking
- Slot locking mechanism during booking

## 📊 Database Schema

### Users Table
```javascript
{
  id: String,
  email: String,
  password: String (hashed),
  role: String ('owner' | 'user'),
  name: String,
  phone: String,
  createdAt: Date
}
```

### Parking Areas Table
```javascript
{
  id: String,
  ownerId: String,
  name: String,
  location: String,
  layoutMatrix: Array,
  slots: Array,
  totalSlots: Number,
  pricePerHour: Number,
  vehicleTypes: Array,
  timings: String,
  createdAt: Date
}
```

### Vehicles Table
```javascript
{
  id: String,
  userId: String,
  vehicleNumber: String,
  vehicleType: String,
  model: String,
  createdAt: Date
}
```

### Bookings Table
```javascript
{
  id: String,
  userId: String,
  parkingAreaId: String,
  slotId: String,
  vehicleId: String,
  startTime: Date,
  endTime: Date,
  hours: Number,
  totalPrice: Number,
  status: String ('active' | 'completed' | 'cancelled'),
  createdAt: Date
}
```

## 🔄 Slot Allocation Logic

### Booking Process
1. User selects parking area and time
2. System checks slot availability
3. User selects preferred slot from visual layout
4. System validates:
   - Slot is available
   - No time conflicts
   - Vehicle is registered
5. Booking is confirmed and slot is locked
6. Slot status updates to 'booked'

### Cancellation Process
1. User requests cancellation
2. System validates booking ownership
3. Booking status updates to 'cancelled'
4. Slot becomes available again
5. Slot status updates to 'available'

## 🎯 Future Enhancements

### Database
- [ ] Integrate MongoDB for persistent storage
- [ ] Add database migrations
- [ ] Implement data backup system

### Features
- [ ] Payment gateway integration
- [ ] Email/SMS notifications
- [ ] QR code for parking entry/exit
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Dynamic pricing based on demand
- [ ] Reservation system for future bookings
- [ ] Integration with navigation apps

### Performance
- [ ] Implement caching (Redis)
- [ ] Add CDN for static assets
- [ ] Optimize image loading
- [ ] Add pagination for large datasets

### Security
- [ ] Implement rate limiting
- [ ] Add CAPTCHA for registration
- [ ] Two-factor authentication
- [ ] Audit logs for all actions

## 🐛 Troubleshooting

### Common Issues

**Backend not starting:**
- Ensure port 3001 is not in use
- Check Node.js version (v14+)
- Verify all dependencies are installed

**Frontend not connecting to backend:**
- Ensure backend is running on port 3001
- Check CORS settings in server.js
- Verify API_URL in App.js

**Booking not working:**
- Ensure vehicle is registered
- Check time format (datetime-local)
- Verify slot is available

## 📝 API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Parking Areas (Owner)
- `POST /api/parking-areas` - Create parking area
- `GET /api/parking-areas/owner` - Get owner's areas
- `GET /api/parking-areas/:id` - Get area details
- `PATCH /api/parking-areas/:id/slots/:slotId` - Update slot status

### Parking Areas (User)
- `GET /api/parking-areas` - Search parking areas
- `GET /api/parking-areas/:id` - Get area details

### Vehicles (User)
- `POST /api/vehicles` - Register vehicle
- `GET /api/vehicles` - Get user's vehicles

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/user` - Get user bookings
- `GET /api/bookings/owner` - Get owner bookings
- `PATCH /api/bookings/:id/cancel` - Cancel booking

## 📄 License

This project is open source and available for educational purposes.

## 👥 Contributors

Created as a demonstration of a smart parking management system.

## 📞 Support

For issues or questions, please open an issue in the repository.

---

**Built with ❤️ using React & Node.js**
