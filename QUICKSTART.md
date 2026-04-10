# Quick Start Guide - Smart Parking System

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies

Open two terminal windows.

**Terminal 1 - Backend:**
```bash
cd smart-parking/backend
npm install
```

**Terminal 2 - Frontend:**
```bash
cd smart-parking/frontend
npm install
```

### Step 2: Start the Application

**Terminal 1 - Start Backend Server:**
```bash
npm start
```
✅ Backend running at http://localhost:3001

**Terminal 2 - Start Frontend:**
```bash
npm start
```
✅ Frontend will open at http://localhost:3000

## 🎯 Test the System

### Create a Parking Owner Account

1. Open http://localhost:3000
2. Click "Register"
3. Select role: **Parking Owner**
4. Fill in:
   - Name: John Doe
   - Email: owner@test.com
   - Phone: 1234567890
   - Password: password123
5. Click "Register"

### Create a Parking Area

1. After login, click "Create New Area"
2. Fill in:
   - Name: Downtown Parking
   - Location: 123 Main Street
   - Price per Hour: 5
   - Rows: 3, Columns: 4
   - Vehicle Types: Select all
3. Click on the grid to design layout (green = slot, gray = pathway)
4. Click "Create Parking Area"
5. Your parking area is now live!

### Create a Parking User Account

1. Logout (top right)
2. Click "Register"
3. Select role: **Parking User**
4. Fill in:
   - Name: Jane Smith
   - Email: user@test.com
   - Phone: 9876543210
   - Password: password123
5. Click "Register"

### Register a Vehicle

1. After login, go to "My Vehicles"
2. Click on the form:
   - Vehicle Number: MH12AB1234
   - Vehicle Type: Car
   - Model: Honda City
3. Click "Register Vehicle"

### Book a Parking Slot

1. Go to "Search Parking"
2. Enter:
   - Location: Main Street
   - Vehicle Type: Car
3. Click "Search"
4. Click on "Downtown Parking" card
5. Select a green (available) slot by clicking on it
6. Fill in booking details:
   - Select your vehicle
   - Start time: Today's date + current time
   - End time: Today's date + 2 hours later
7. Click "Confirm Booking"
8. ✅ Booking successful!

### View Bookings

**As User:**
- Go to "My Bookings" to see your reservation

**As Owner:**
- Login as owner (owner@test.com)
- Go to "Bookings" to see all bookings for your parking area

## 🎨 Understanding the Layout

### Grid Color Coding

- 🟢 **Green** = Available slot (click to book)
- 🔴 **Red** = Booked slot (unavailable)
- ⚫ **Gray** = Pathway/Empty space
- 🟡 **Yellow border** = Selected slot

### Slot Naming

Slots are automatically named:
- Row A, Column 1 = **A1**
- Row B, Column 3 = **B3**
- Row C, Column 2 = **C2**

## 🔄 Common Workflows

### Owner Workflow
```
Register → Create Parking Area → Design Layout → Monitor Bookings
```

### User Workflow
```
Register → Add Vehicle → Search Parking → Book Slot → View Booking
```

## 💡 Tips

1. **Design Realistic Layouts**: Use gray cells for entry/exit pathways
2. **Price Strategy**: Set competitive hourly rates
3. **Vehicle Types**: Select appropriate types for your parking size
4. **Time Selection**: Ensure end time is after start time
5. **Multiple Vehicles**: Users can register unlimited vehicles

## 🐛 Quick Fixes

**Can't see parking areas?**
- Make sure you're logged in as a user (not owner)
- Try searching without filters first

**Booking fails?**
- Ensure you have a registered vehicle
- Check that the slot is green (available)
- Verify your time range is valid

**Layout not saving?**
- Make sure at least one cell is green (has a slot)
- Click cells to toggle between slot/pathway

## 📱 Testing Scenarios

### Scenario 1: Full Cycle Test
1. Create owner account
2. Create parking area with 6 slots
3. Create user account
4. Register vehicle
5. Book 3 slots
6. Login as owner - verify 3 bookings appear
7. Login as user - cancel 1 booking
8. Login as owner - verify booking is cancelled

### Scenario 2: Multiple Parking Areas
1. As owner, create 3 different parking areas
2. Each with different layouts and pricing
3. As user, search and compare options
4. Book from different locations

### Scenario 3: Slot Management
1. As owner, create parking area
2. Note available slots count
3. As user, book a slot
4. As owner, check updated availability
5. As user, cancel booking
6. As owner, verify slot is available again

## 🚀 Next Steps

After testing the basic functionality:

1. **Explore Features**:
   - Try different grid layouts
   - Test with multiple vehicles
   - Create various parking areas

2. **Understand the Code**:
   - Review `backend/server.js` for API logic
   - Check `frontend/src/App.js` for React components
   - Study the 2D matrix implementation

3. **Customize**:
   - Modify pricing logic
   - Add new vehicle types
   - Enhance the UI design

4. **Deploy**:
   - See DEPLOYMENT.md for production setup
   - Configure environment variables
   - Set up a real database

## 📞 Need Help?

- Check README.md for detailed documentation
- Review code comments for implementation details
- Test with the provided example scenarios

---

**Happy Parking! 🅿️**
