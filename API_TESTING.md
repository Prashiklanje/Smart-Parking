# API Testing Guide - Smart Parking System

## 🧪 Testing the REST API

This guide provides examples for testing all API endpoints using curl, Postman, or any HTTP client.

Base URL: `http://localhost:3001/api`

## 📝 Authentication Endpoints

### 1. Register New Owner

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "owner@test.com",
  "password": "password123",
  "role": "owner",
  "name": "John Owner",
  "phone": "1234567890"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.com",
    "password": "password123",
    "role": "owner",
    "name": "John Owner",
    "phone": "1234567890"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1706702400000",
    "email": "owner@test.com",
    "role": "owner",
    "name": "John Owner"
  }
}
```

### 2. Register New User

**Request Body:**
```json
{
  "email": "user@test.com",
  "password": "password123",
  "role": "user",
  "name": "Jane User",
  "phone": "9876543210"
}
```

### 3. Login (Owner)

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "owner@test.com",
  "password": "password123",
  "role": "owner"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@test.com",
    "password": "password123",
    "role": "owner"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1706702400000",
    "email": "owner@test.com",
    "role": "owner",
    "name": "John Owner"
  }
}
```

**Note:** Save the token for subsequent requests!

### 4. Login (User)

**Request Body:**
```json
{
  "email": "user@test.com",
  "password": "password123",
  "role": "user"
}
```

## 🅿️ Parking Area Endpoints (Owner Only)

### 5. Create Parking Area

**Endpoint:** `POST /api/parking-areas`

**Headers:**
```
Authorization: Bearer <your-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Downtown Parking",
  "location": "123 Main Street, City Center",
  "layoutMatrix": [
    [1, 1, 0, 1],
    [1, 1, 1, 1],
    [0, 1, 1, 0]
  ],
  "pricePerHour": 5,
  "vehicleTypes": ["2-wheeler", "Car", "SUV"],
  "timings": "24/7"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3001/api/parking-areas \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Downtown Parking",
    "location": "123 Main Street, City Center",
    "layoutMatrix": [[1,1,0,1],[1,1,1,1],[0,1,1,0]],
    "pricePerHour": 5,
    "vehicleTypes": ["2-wheeler", "Car", "SUV"],
    "timings": "24/7"
  }'
```

**Response:**
```json
{
  "id": "1706702500000",
  "ownerId": "1706702400000",
  "name": "Downtown Parking",
  "location": "123 Main Street, City Center",
  "layoutMatrix": [[1,1,0,1],[1,1,1,1],[0,1,1,0]],
  "slots": [
    {
      "id": "A1",
      "row": 0,
      "col": 0,
      "status": "available",
      "bookings": []
    },
    {
      "id": "A2",
      "row": 0,
      "col": 1,
      "status": "available",
      "bookings": []
    },
    // ... more slots
  ],
  "totalSlots": 9,
  "pricePerHour": 5,
  "vehicleTypes": ["2-wheeler", "Car", "SUV"],
  "timings": "24/7",
  "createdAt": "2026-01-31T10:15:00.000Z"
}
```

### 6. Get Owner's Parking Areas

**Endpoint:** `GET /api/parking-areas/owner`

**Headers:**
```
Authorization: Bearer <owner-token>
```

**cURL:**
```bash
curl -X GET http://localhost:3001/api/parking-areas/owner \
  -H "Authorization: Bearer YOUR_OWNER_TOKEN"
```

**Response:**
```json
[
  {
    "id": "1706702500000",
    "ownerId": "1706702400000",
    "name": "Downtown Parking",
    "location": "123 Main Street, City Center",
    // ... full parking area details
  }
]
```

### 7. Update Slot Status

**Endpoint:** `PATCH /api/parking-areas/:areaId/slots/:slotId`

**Headers:**
```
Authorization: Bearer <owner-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "disabled"
}
```

**cURL:**
```bash
curl -X PATCH http://localhost:3001/api/parking-areas/1706702500000/slots/A1 \
  -H "Authorization: Bearer YOUR_OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "disabled"}'
```

## 🚗 Vehicle Endpoints (User Only)

### 8. Register Vehicle

**Endpoint:** `POST /api/vehicles`

**Headers:**
```
Authorization: Bearer <user-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "vehicleNumber": "MH12AB1234",
  "vehicleType": "Car",
  "model": "Honda City"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3001/api/vehicles \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleNumber": "MH12AB1234",
    "vehicleType": "Car",
    "model": "Honda City"
  }'
```

**Response:**
```json
{
  "id": "1706702600000",
  "userId": "1706702450000",
  "vehicleNumber": "MH12AB1234",
  "vehicleType": "Car",
  "model": "Honda City",
  "createdAt": "2026-01-31T10:20:00.000Z"
}
```

### 9. Get User's Vehicles

**Endpoint:** `GET /api/vehicles`

**Headers:**
```
Authorization: Bearer <user-token>
```

**cURL:**
```bash
curl -X GET http://localhost:3001/api/vehicles \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

## 🔍 Search & View Parking Areas

### 10. Search Parking Areas (All Users)

**Endpoint:** `GET /api/parking-areas?location=Main&vehicleType=Car`

**Headers:**
```
Authorization: Bearer <user-token>
```

**Query Parameters:**
- `location` (optional): Search by location text
- `vehicleType` (optional): Filter by vehicle type
- `date` (optional): Check availability for date

**cURL:**
```bash
curl -X GET "http://localhost:3001/api/parking-areas?location=Main&vehicleType=Car" \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**Response:**
```json
[
  {
    "id": "1706702500000",
    "name": "Downtown Parking",
    "location": "123 Main Street, City Center",
    "totalSlots": 9,
    "availableSlots": 9,
    "pricePerHour": 5,
    "vehicleTypes": ["2-wheeler", "Car", "SUV"],
    // ... more details
  }
]
```

### 11. Get Parking Area Details

**Endpoint:** `GET /api/parking-areas/:id`

**cURL:**
```bash
curl -X GET http://localhost:3001/api/parking-areas/1706702500000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📅 Booking Endpoints

### 12. Create Booking

**Endpoint:** `POST /api/bookings`

**Headers:**
```
Authorization: Bearer <user-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "parkingAreaId": "1706702500000",
  "slotId": "A1",
  "vehicleId": "1706702600000",
  "startTime": "2026-01-31T14:00:00.000Z",
  "endTime": "2026-01-31T18:00:00.000Z"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3001/api/bookings \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parkingAreaId": "1706702500000",
    "slotId": "A1",
    "vehicleId": "1706702600000",
    "startTime": "2026-01-31T14:00:00.000Z",
    "endTime": "2026-01-31T18:00:00.000Z"
  }'
```

**Response:**
```json
{
  "id": "1706702700000",
  "userId": "1706702450000",
  "parkingAreaId": "1706702500000",
  "slotId": "A1",
  "vehicleId": "1706702600000",
  "startTime": "2026-01-31T14:00:00.000Z",
  "endTime": "2026-01-31T18:00:00.000Z",
  "hours": 4,
  "totalPrice": 20,
  "status": "active",
  "createdAt": "2026-01-31T10:25:00.000Z"
}
```

### 13. Get User Bookings

**Endpoint:** `GET /api/bookings/user`

**Headers:**
```
Authorization: Bearer <user-token>
```

**cURL:**
```bash
curl -X GET http://localhost:3001/api/bookings/user \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**Response:**
```json
[
  {
    "id": "1706702700000",
    "userId": "1706702450000",
    "parkingAreaId": "1706702500000",
    "slotId": "A1",
    "vehicleId": "1706702600000",
    "startTime": "2026-01-31T14:00:00.000Z",
    "endTime": "2026-01-31T18:00:00.000Z",
    "hours": 4,
    "totalPrice": 20,
    "status": "active",
    "parkingArea": {
      "name": "Downtown Parking",
      "location": "123 Main Street, City Center"
    },
    "vehicle": {
      "vehicleNumber": "MH12AB1234",
      "vehicleType": "Car"
    }
  }
]
```

### 14. Get Owner Bookings

**Endpoint:** `GET /api/bookings/owner`

**Headers:**
```
Authorization: Bearer <owner-token>
```

**cURL:**
```bash
curl -X GET http://localhost:3001/api/bookings/owner \
  -H "Authorization: Bearer YOUR_OWNER_TOKEN"
```

### 15. Cancel Booking

**Endpoint:** `PATCH /api/bookings/:id/cancel`

**Headers:**
```
Authorization: Bearer <user-token>
```

**cURL:**
```bash
curl -X PATCH http://localhost:3001/api/bookings/1706702700000/cancel \
  -H "Authorization: Bearer YOUR_USER_TOKEN"
```

**Response:**
```json
{
  "id": "1706702700000",
  "userId": "1706702450000",
  "status": "cancelled",
  // ... other booking details
}
```

## 🧪 Testing Scenarios

### Complete Flow Test

```bash
# 1. Register Owner
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@test.com","password":"pass123","role":"owner","name":"Owner","phone":"1234567890"}'

# Save the returned token as OWNER_TOKEN

# 2. Create Parking Area
curl -X POST http://localhost:3001/api/parking-areas \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Parking","location":"Test Location","layoutMatrix":[[1,1],[1,1]],"pricePerHour":5,"vehicleTypes":["Car"],"timings":"24/7"}'

# Save the returned parking area ID as AREA_ID

# 3. Register User
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"pass123","role":"user","name":"User","phone":"9876543210"}'

# Save the returned token as USER_TOKEN

# 4. Register Vehicle
curl -X POST http://localhost:3001/api/vehicles \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vehicleNumber":"ABC123","vehicleType":"Car","model":"Test Car"}'

# Save the returned vehicle ID as VEHICLE_ID

# 5. Search Parking
curl -X GET "http://localhost:3001/api/parking-areas?location=Test" \
  -H "Authorization: Bearer $USER_TOKEN"

# 6. Create Booking
curl -X POST http://localhost:3001/api/bookings \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"parkingAreaId\":\"$AREA_ID\",\"slotId\":\"A1\",\"vehicleId\":\"$VEHICLE_ID\",\"startTime\":\"2026-01-31T14:00:00Z\",\"endTime\":\"2026-01-31T18:00:00Z\"}"

# 7. View User Bookings
curl -X GET http://localhost:3001/api/bookings/user \
  -H "Authorization: Bearer $USER_TOKEN"

# 8. View Owner Bookings
curl -X GET http://localhost:3001/api/bookings/owner \
  -H "Authorization: Bearer $OWNER_TOKEN"
```

## ❌ Error Responses

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied"
}
```

### 404 Not Found
```json
{
  "error": "Parking area not found"
}
```

### 400 Bad Request
```json
{
  "error": "Slot not available"
}
```

## 📊 Postman Collection

To import into Postman, create a collection with these requests:

**Environment Variables:**
- `base_url`: http://localhost:3001/api
- `owner_token`: (set after owner login)
- `user_token`: (set after user login)
- `area_id`: (set after creating parking area)
- `vehicle_id`: (set after registering vehicle)

Then use `{{base_url}}`, `{{owner_token}}`, etc. in your requests.

## 🔧 Testing Tips

1. **Save Tokens**: Always save the JWT tokens returned from login
2. **Use Variables**: Store IDs in variables for reuse
3. **Test Order**: Follow the logical flow (register → login → create/book)
4. **Check Response**: Verify status codes and response structure
5. **Error Cases**: Test invalid inputs and unauthorized access
6. **Clean Up**: Cancel bookings and test reusability

## 📝 Notes

- All timestamps should be in ISO 8601 format
- Tokens expire after 7 days
- Vehicle numbers are automatically converted to uppercase
- Booking duration is calculated in hours (rounded up)
- Slots are automatically locked during booking

Happy Testing! 🧪
