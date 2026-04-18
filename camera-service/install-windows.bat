@echo off
echo ========================================
echo Smart Parking Camera Service Installer
echo ========================================
echo.

echo Step 1: Upgrading pip...
python -m pip install --upgrade pip
echo.

echo Step 2: Installing Python packages...
echo This may take a few minutes...
echo.

pip install flask
pip install flask-cors
pip install opencv-python
pip install numpy
pip install pytesseract
pip install ultralytics
pip install Pillow
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo.
echo ========================================
echo Step 3: Verifying installations...
echo ========================================
echo.

python -c "import cv2; print('✓ OpenCV installed')"
python -c "import flask; print('✓ Flask installed')"
python -c "import numpy; print('✓ NumPy installed')"
python -c "import pytesseract; print('✓ Pytesseract installed')"
python -c "from ultralytics import YOLO; print('✓ YOLO (Ultralytics) installed')"

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Install Tesseract OCR from:
echo    https://github.com/UB-Mannheim/tesseract/wiki
echo.
echo 2. Start the camera service:
echo    python plate_detector.py
echo.
pause
