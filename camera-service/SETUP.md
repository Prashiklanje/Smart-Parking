# Camera Service Setup Guide

## Quick Start

### 1. Install Dependencies

#### Install Tesseract OCR

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
sudo apt-get install libtesseract-dev
```

**macOS:**
```bash
brew install tesseract
```

**Windows:**
1. Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
2. Install and add to PATH
3. Default path: `C:\Program Files\Tesseract-OCR\tesseract.exe`

#### Install Python Packages

```bash
cd smart-parking/camera-service
pip install -r requirements.txt
```

Or install individually:
```bash
pip install flask==3.0.0
pip install flask-cors==4.0.0
pip install opencv-python==4.8.1.78
pip install numpy==1.24.3
pip install pytesseract==0.3.10
pip install ultralytics==8.0.220
pip install Pillow==10.1.0
```

### 2. Verify Installation

```bash
# Check Tesseract
tesseract --version

# Should output something like:
# tesseract 5.3.0

# Check Python packages
python -c "import cv2, pytesseract; print('All packages installed!')"
```

### 3. Update Model Path

If YOLO weights are in a different location, update `plate_detector.py`:

```python
MODEL_PATH = '/path/to/your/best/weights.pt'
```

### 4. Start the Camera Service

```bash
cd smart-parking/camera-service
python plate_detector.py
```

You should see:
```
YOLO model loaded successfully
Tesseract is installed
 * Running on http://0.0.0.0:5000
```

### 5. Test the Service

```bash
curl http://localhost:5000/health
```

Should return:
```json
{
  "status": "ok",
  "model_loaded": true
}
```

## Testing Number Plate Detection

### Using cURL

```bash
# Convert image to base64
base64_image=$(base64 -w 0 your_plate_image.jpg)

# Send request
curl -X POST http://localhost:5000/detect-plate \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"data:image/jpeg;base64,$base64_image\"}"
```

### Using Python

```python
import requests
import base64

# Read image
with open('plate_image.jpg', 'rb') as f:
    img_data = base64.b64encode(f.read()).decode()

# Send request
response = requests.post(
    'http://localhost:5000/detect-plate',
    json={'image': f'data:image/jpeg;base64,{img_data}'}
)

print(response.json())
```

## Common Issues

### Issue 1: Tesseract Not Found

**Error:** `TesseractNotFoundError`

**Solution:**
```bash
# Ubuntu
sudo apt-get install tesseract-ocr

# macOS
brew install tesseract

# Windows: Add to PATH
set PATH=%PATH%;C:\Program Files\Tesseract-OCR
```

### Issue 2: YOLO Model Not Loading

**Error:** `FileNotFoundError: best/weights.pt`

**Solution:**
1. Check if `best/` folder exists in `camera-service/`
2. Verify `weights.pt` is inside
3. Update `MODEL_PATH` in `plate_detector.py`

### Issue 3: OpenCV Issues

**Error:** `ImportError: libGL.so.1`

**Solution (Ubuntu):**
```bash
sudo apt-get install libgl1-mesa-glx
```

### Issue 4: Port Already in Use

**Error:** `Address already in use`

**Solution:**
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use different port in plate_detector.py
app.run(host='0.0.0.0', port=5001)
```

## Production Deployment

### Using Gunicorn

```bash
pip install gunicorn

gunicorn -w 4 -b 0.0.0.0:5000 plate_detector:app
```

### Using Docker

Create `Dockerfile`:
```dockerfile
FROM python:3.9-slim

# Install Tesseract
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "plate_detector.py"]
```

Build and run:
```bash
docker build -t camera-service .
docker run -p 5000:5000 camera-service
```

## Performance Tips

### 1. GPU Acceleration (YOLO)

Install PyTorch with CUDA:
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

### 2. Model Optimization

Use smaller YOLO model for faster inference:
```python
model = YOLO('yolov8n.pt')  # Nano model (faster)
# vs
model = YOLO('yolov8x.pt')  # Extra large (more accurate)
```

### 3. Image Resizing

Resize large images before processing:
```python
# In detect_plate function
max_size = 1280
if img.shape[0] > max_size or img.shape[1] > max_size:
    scale = max_size / max(img.shape[0], img.shape[1])
    img = cv2.resize(img, None, fx=scale, fy=scale)
```

## Monitoring

### Check Service Health

```bash
# Health check
curl http://localhost:5000/health

# View logs
tail -f camera-service.log
```

### Add Logging

Add to `plate_detector.py`:
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('camera-service.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
```

## Integration with Frontend

The camera service is automatically called by the React frontend when:
1. User uploads an image in Camera Dashboard
2. Clicks "Punch In" or "Punch Out"
3. Frontend calls:
   ```javascript
   const result = await api.detectPlate(imageBase64);
   ```

## Support

For issues:
1. Check logs: `camera-service.log`
2. Test YOLO separately
3. Test Tesseract separately
4. Verify image format (JPEG/PNG)
5. Check image quality

---

**Camera Service Ready!** 📹
