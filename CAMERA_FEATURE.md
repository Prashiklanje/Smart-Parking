# Camera Punch In/Out Feature - Documentation

## 🎥 Overview

The Smart Parking System now includes **AI-powered camera-based punch in/out** functionality using:
- **YOLO v8** for number plate detection
- **Tesseract OCR** for text recognition
- **Real-time booking** without manual input

## 🌟 Key Features

### Punch In Camera
- Upload number plate image
- AI detects and reads vehicle number
- Automatically creates booking
- Assigns nearest available slot
- Records entry time

### Punch Out Camera
- Upload number plate image
- AI recognizes vehicle
- Calculates parking duration
- Computes total price
- Completes booking

### Stop Booking (User Dashboard)
- Users can manually stop active bookings
- Same as punch out via camera
- Available in "My Bookings" section

## 🔧 Technical Architecture

### System Components

```
User uploads image
       ↓
Frontend (React)
       ↓
Camera Service (Flask/Python)
   - YOLO Detection
   - Tesseract OCR
       ↓
Backend (Node.js)
   - Create/Complete Booking
   - Update Slot Status
       ↓
Database
```

### Services

**1. Frontend (Port 3000)**
- User interface for camera operation
- Image upload and preview
- Results display

**2. Camera Service (Port 5000)**
- Flask Python server
- YOLO number plate detection
- Tesseract OCR processing
- Image preprocessing

**3. Backend (Port 3001)**
- Punch in/out API endpoints
- Booking management
- Slot allocation

## 📋 Installation & Setup

### Prerequisites

1. **Python 3.8+** with packages:
   ```bash
   pip install flask flask-cors opencv-python pytesseract ultralytics numpy
   ```

2. **Tesseract OCR**:
   - **Ubuntu**: `sudo apt-get install tesseract-ocr`
   - **Mac**: `brew install tesseract`
   - **Windows**: Download from https://github.com/UB-Mannheim/tesseract/wiki

3. **YOLO Weights**:
   - Included in `/camera-service/best/` directory

### Start Services

**Terminal 1 - Backend:**
```bash
cd smart-parking/backend
npm install
npm start
```

**Terminal 2 - Frontend:**
```bash
cd smart-parking/frontend
npm install
npm start
```

**Terminal 3 - Camera Service:**
```bash
cd smart-parking/camera-service
pip install -r requirements.txt
python plate_detector.py
```

Services will run on:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Camera Service: http://localhost:5000

## 🎯 User Guide

### Creating Camera Accounts

1. Go to registration page
2. Select role:
   - **📹 Punch In Camera** - For entry point
   - **📹 Punch Out Camera** - For exit point
3. Fill in details and register

### Using Punch In Camera

1. **Login** as Punch In Camera
2. **Select** parking area from dropdown
3. **Upload** image of vehicle's number plate
4. **Click** "Punch In" button
5. **System processes:**
   - Detects number plate using YOLO
   - Reads text using Tesseract OCR
   - Finds vehicle in database
   - Assigns nearest available slot
   - Creates booking with current time
6. **View results:**
   - Detected plate number
   - Assigned slot
   - Distance from entry
   - Booking confirmation

### Using Punch Out Camera

1. **Login** as Punch Out Camera
2. **Select** parking area
3. **Upload** number plate image
4. **Click** "Punch Out" button
5. **System processes:**
   - Detects and reads plate
   - Finds active booking
   - Calculates duration
   - Computes total price
   - Completes booking
6. **View results:**
   - Parking duration
   - Total charges
   - Checkout time

### Manual Stop Booking (User)

1. **Login** as regular user
2. Go to **"My Bookings"**
3. Find active booking
4. Click **"Stop Booking"** button
5. Confirm checkout
6. Booking completed with price calculated

## 🔬 YOLO + Tesseract Pipeline

### Step 1: YOLO Detection

```python
# Load YOLO model
model = YOLO('best/weights.pt')

# Run detection
results = model(image)
boxes = results[0].boxes.xyxy.cpu().numpy()

# Get bounding box
x1, y1, x2, y2 = boxes[0].astype(int)
plate_crop = image[y1:y2, x1:x2]
```

**Output:** Cropped number plate region

### Step 2: Image Preprocessing

```python
def preprocess_for_tesseract(plate_img):
    # Convert to grayscale
    gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
    
    # Noise reduction
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    
    # Contrast enhancement using CLAHE
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blur)
    
    # Binarization using OTSU
    _, thresh = cv2.threshold(enhanced, 0, 255, 
                              cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return thresh
```

**Output:** Clean, binary image optimized for OCR

### Step 3: Tesseract OCR

```python
# Configure Tesseract
custom_config = r'--oem 3 --psm 7 -c tesseract_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

# Extract text
plate_text = pytesseract.image_to_string(processed_plate, config=custom_config)

# Clean result
plate_number = clean_plate_text(plate_text)
```

**Output:** Vehicle number (e.g., "MH12AB1234")

### Step 4: Text Cleaning

```python
def clean_plate_text(text):
    # Remove special characters
    text = re.sub(r'[^A-Z0-9]', '', text.upper())
    
    # OCR corrections
    text = text.replace('O', '0')  # O to 0
    text = text.replace('I', '1')  # I to 1
    text = text.replace('S', '5')  # S to 5
    
    return text
```

**Output:** Clean vehicle number

## 📊 API Endpoints

### Camera Service (Flask)

#### POST /detect-plate
Detect and read number plate from image

**Request:**
```json
{
  "image": "data:image/jpeg;base64,..."
}
```

**Response:**
```json
{
  "plateNumber": "MH12AB1234",
  "confidence": 0.95,
  "plateImage": "data:image/jpeg;base64,...",
  "processedImage": "data:image/jpeg;base64,...",
  "bbox": {
    "x1": 100,
    "y1": 150,
    "x2": 350,
    "y2": 220
  }
}
```

### Backend (Express)

#### POST /api/punch-in
Create booking via camera

**Headers:**
```
Authorization: Bearer <camera-token>
```

**Request:**
```json
{
  "vehicleNumber": "MH12AB1234",
  "parkingAreaId": "1706702500000"
}
```

**Response:**
```json
{
  "booking": {
    "id": "1706702700000",
    "slotId": "A1",
    "punchInTime": "2026-01-31T14:00:00Z",
    "status": "active"
  },
  "vehicle": {...},
  "slot": {
    "id": "A1",
    "distance": 2
  },
  "parkingArea": {...}
}
```

#### POST /api/punch-out
Complete booking

**Request:**
```json
{
  "vehicleNumber": "MH12AB1234",
  "parkingAreaId": "1706702500000"
}
```

OR

```json
{
  "bookingId": "1706702700000"
}
```

**Response:**
```json
{
  "booking": {
    "id": "1706702700000",
    "status": "completed",
    "totalPrice": 25
  },
  "duration": {
    "hours": 5,
    "minutes": 300,
    "totalPrice": 25
  }
}
```

## 🔄 Workflow Examples

### Example 1: Camera Punch In

```
1. Vehicle arrives at entry
2. Camera captures number plate
3. Operator uploads image
4. YOLO detects plate region
5. Tesseract reads: "MH12AB1234"
6. System finds vehicle in database
7. Assigns slot A1 (nearest, 2 steps)
8. Creates booking at 14:00:00
9. Driver parks at slot A1
```

### Example 2: Camera Punch Out

```
1. Vehicle arrives at exit
2. Camera captures plate
3. Operator uploads image
4. System reads: "MH12AB1234"
5. Finds active booking (started 14:00)
6. Current time: 19:00
7. Duration: 5 hours
8. Price: 5 hours × $5 = $25
9. Booking completed
10. Slot freed
```

### Example 3: Manual Stop (User)

```
1. User opens "My Bookings"
2. Sees active booking (started 14:00)
3. Clicks "Stop Booking"
4. System calculates duration
5. Shows price: $25 for 5 hours
6. Booking marked complete
7. Slot becomes available
```

## 🎨 UI Components

### Camera Dashboard

**Elements:**
- Parking area selector
- Image upload button
- Image preview
- Process button
- Results display

**Results Show:**
- Detected plate number
- Confidence score
- Cropped plate image
- Processed image
- Booking details (punch in)
- Duration & price (punch out)

### User Booking Card

**Active Booking Shows:**
- Parking area & location
- Assigned slot
- Vehicle number
- Start time
- Current status
- **Stop Booking** button
- Cancel button

## 🔐 Security & Validation

### Access Control
- Camera roles can only punch in/out
- Cannot access user/owner dashboards
- Separate authentication

### Data Validation
- Vehicle must be registered
- Parking area must exist
- Plate detection must succeed
- No duplicate active bookings

### Error Handling
- No plate detected → Error message
- Vehicle not found → Not registered
- No available slots → Full parking
- OCR failure → Manual entry fallback

## 🐛 Troubleshooting

### Camera Service Not Starting

```bash
# Check if Tesseract is installed
tesseract --version

# Install if missing
sudo apt-get install tesseract-ocr

# Check Python packages
pip list | grep -E 'opencv|tesseract|ultralytics'

# Reinstall if needed
pip install -r requirements.txt
```

### Plate Detection Failing

**Issue:** "No number plate detected"

**Solutions:**
1. Ensure good image quality
2. Plate should be clearly visible
3. Good lighting conditions
4. Avoid reflections/glare
5. Try different image angles

### OCR Reading Wrong

**Issue:** Incorrect vehicle number

**Solutions:**
1. Check image preprocessing
2. Adjust CLAHE parameters
3. Use higher resolution images
4. Clean the number plate
5. Manual correction option

### Port Conflicts

```bash
# Check if ports are in use
lsof -i :3000  # Frontend
lsof -i :3001  # Backend
lsof -i :5000  # Camera service

# Kill process if needed
kill -9 <PID>
```

## 📈 Performance Optimization

### YOLO Inference
- Use GPU if available
- Reduce image size for faster processing
- Batch processing for multiple plates

### Tesseract OCR
- Whitelist only alphanumeric characters
- Use appropriate PSM mode (7 for single line)
- Preprocessing improves accuracy

### API Response Time
- Average detection: 1-2 seconds
- Network latency: <500ms
- Total punch in/out: 2-3 seconds

## 🚀 Future Enhancements

Possible improvements:
- Real-time video stream processing
- Multi-plate detection in single image
- License plate format validation
- State/country recognition
- Automatic number correction
- Mobile app integration
- QR code alternative
- Facial recognition for drivers

## 📝 Testing

### Test Scenarios

**1. Successful Punch In:**
- Upload clear plate image
- Verify YOLO detection
- Check slot assignment (nearest)
- Confirm booking creation

**2. Successful Punch Out:**
- Upload exit image
- Verify booking found
- Check duration calculation
- Confirm price accuracy

**3. Edge Cases:**
- Unregistered vehicle
- Poor image quality
- Full parking lot
- Duplicate booking attempt
- Network failure

### Sample Test Data

```javascript
// Test vehicles
{
  vehicleNumber: "MH12AB1234",
  vehicleType: "Car"
}

{
  vehicleNumber: "DL01CD5678",
  vehicleType: "SUV"
}
```

## 📄 License & Credits

- **YOLO v8**: Ultralytics
- **Tesseract OCR**: Google
- **OpenCV**: Intel/Willow Garage
- **Flask**: Pallets Projects

---

**This feature transforms the parking system into a truly automated, touchless experience!** 🎉
