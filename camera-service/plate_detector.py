from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import pytesseract
from ultralytics import YOLO
import base64
import os
import re

app = Flask(__name__)
CORS(app)

# Load YOLO model
MODEL_PATH = 'yolo-weights.pt'  
try:
    model = YOLO(MODEL_PATH)
    print("YOLO model loaded successfully")
except Exception as e:
    print(f"Error loading YOLO model: {e}")
    model = None

def preprocess_for_tesseract(plate_img):
    """Preprocess the plate image for better OCR results"""
    # Convert to grayscale
    gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
    
    # Remove noise using Gaussian blur
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    
    # Increase contrast using CLAHE
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blur)
    
    # Binarize using OTSU thresholding
    _, thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return thresh

def clean_plate_text(text):
    """Clean and format the OCR text"""
    # Remove special characters and spaces
    text = re.sub(r'[^A-Z0-9]', '', text.upper())
    
    # Common OCR corrections
    text = text.replace('O', '0')  # Replace O with 0 in certain contexts
    text = text.replace('I', '1')  # Replace I with 1
    text = text.replace('S', '5')  # Replace S with 5 in certain contexts
    
    return text

@app.route('/detect-plate', methods=['POST'])
def detect_plate():
    """Detect and read number plate from uploaded image"""
    try:
        if not model:
            return jsonify({'error': 'YOLO model not loaded'}), 500
        
        # Get image from request
        data = request.get_json()
        
        if 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
        # Decode base64 image
        image_data = data['image'].split(',')[1] if ',' in data['image'] else data['image']
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'Invalid image'}), 400
        
        # Run YOLO detection
        results = model(img)
        boxes = results[0].boxes.xyxy.cpu().numpy()
        
        if len(boxes) == 0:
            return jsonify({'error': 'No number plate detected'}), 404
        
        # Get first detected plate
        x1, y1, x2, y2 = boxes[0].astype(int)
        
        # Crop the plate
        plate_crop = img[y1:y2, x1:x2]
        
        if plate_crop.size == 0:
            return jsonify({'error': 'Invalid plate crop'}), 400
        
        # Preprocess for OCR
        processed_plate = preprocess_for_tesseract(plate_crop)
        
        # Run Tesseract OCR
        # Configure Tesseract for better results
        custom_config = r'--oem 3 --psm 7 -c tesseract_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        plate_text = pytesseract.image_to_string(processed_plate, config=custom_config)
        
        # Clean the text
        plate_number = clean_plate_text(plate_text)
        
        if not plate_number or len(plate_number) < 4:
            return jsonify({'error': 'Could not read plate number'}), 404
        
        # Encode cropped plate image
        _, buffer = cv2.imencode('.jpg', plate_crop)
        plate_crop_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Encode processed plate image
        _, buffer2 = cv2.imencode('.jpg', processed_plate)
        processed_base64 = base64.b64encode(buffer2).decode('utf-8')
        
        return jsonify({
            'plateNumber': plate_number,
            'confidence': float(results[0].boxes.conf[0]),
            'plateImage': f'data:image/jpeg;base64,{plate_crop_base64}',
            'processedImage': f'data:image/jpeg;base64,{processed_base64}',
            'bbox': {
                'x1': int(x1),
                'y1': int(y1),
                'x2': int(x2),
                'y2': int(y2)
            }
        })
        
    except Exception as e:
        print(f"Error detecting plate: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None
    })

if __name__ == '__main__':
    # Make sure Tesseract is installed
    try:
        pytesseract.get_tesseract_version()
        print("Tesseract is installed")
    except:
        print("WARNING: Tesseract not found! Please install it:")
        print("Ubuntu: sudo apt-get install tesseract-ocr")
        print("Mac: brew install tesseract")
        print("Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
