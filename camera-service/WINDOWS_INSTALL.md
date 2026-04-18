# Windows Installation Guide

## Issue with Python 3.14

If you're using Python 3.14 (or 3.13+), you might encounter compatibility issues with older package versions.

## Solution: Install packages without version constraints

Instead of using the requirements.txt file, install packages individually:

```bash
# Navigate to camera-service directory
cd smart-parking\camera-service

# Install packages (letting pip choose compatible versions)
pip install flask
pip install flask-cors
pip install opencv-python
pip install numpy
pip install pytesseract
pip install ultralytics
pip install Pillow
pip install torch torchvision
```

## Alternative: Use Python 3.11 or 3.12

The most stable option is to use Python 3.11 or 3.12:

1. **Download Python 3.11**: https://www.python.org/downloads/release/python-3119/
2. **Uninstall Python 3.14** (optional)
3. **Install Python 3.11**
4. **Reinstall packages**:
   ```bash
   pip install -r requirements.txt
   ```

## Install Tesseract OCR on Windows

1. **Download Tesseract installer**:
   - https://github.com/UB-Mannheim/tesseract/wiki
   - Download: `tesseract-ocr-w64-setup-5.3.3.20231005.exe`

2. **Run installer**:
   - Install to: `C:\Program Files\Tesseract-OCR`
   - ✅ Check "Add to PATH" during installation

3. **Verify installation**:
   ```bash
   tesseract --version
   ```

4. **If not in PATH, add manually**:
   - Right-click "This PC" → Properties
   - Advanced system settings → Environment Variables
   - Edit "Path" → Add: `C:\Program Files\Tesseract-OCR`

## Verify All Installations

```bash
# Check Python
python --version

# Check pip
pip --version

# Check Tesseract
tesseract --version

# Test imports
python -c "import cv2, pytesseract, flask; print('All packages OK!')"
```

## Common Issues

### Issue 1: pip install fails with "AttributeError: module 'pkgutil'"

**Solution**: Upgrade pip first
```bash
python -m pip install --upgrade pip
```

### Issue 2: numpy build error

**Solution**: Install latest numpy
```bash
pip install numpy --upgrade
```

### Issue 3: torch installation slow/large

**Solution**: Install CPU-only version (faster, smaller)
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

### Issue 4: Tesseract not found

**Error**: `TesseractNotFoundError`

**Solution**: Add to pytesseract config in `plate_detector.py`
```python
import pytesseract

# Add this line at the top (Windows only)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

## Quick Install (All-in-One)

```bash
# Upgrade pip
python -m pip install --upgrade pip

# Install all packages
pip install flask flask-cors opencv-python numpy pytesseract ultralytics Pillow torch torchvision

# Verify
python -c "import cv2, pytesseract, flask, ultralytics; print('Success!')"
```

## Start Camera Service

```bash
cd smart-parking\camera-service
python plate_detector.py
```

Should see:
```
YOLO model loaded successfully
Tesseract is installed
 * Running on http://0.0.0.0:5000
```

## Troubleshooting

### Can't find YOLO weights

**Error**: `FileNotFoundError: best/weights.pt`

**Solution**: Check if `best` folder exists in `camera-service/`
```bash
dir best
# Should show files inside
```

### Port 5000 already in use

**Solution**: Change port in `plate_detector.py`
```python
# Line at bottom of file
app.run(host='0.0.0.0', port=5001, debug=True)  # Changed to 5001
```

Then update frontend `App.js`:
```javascript
const response = await fetch('http://localhost:5001/detect-plate', {
```

---

**Once installed, the camera service should work perfectly!** 📹
