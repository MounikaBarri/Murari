import cv2
import numpy as np
from tensorflow.keras.models import load_model
import os

# ==========================================================
# Load Model Safely
# ==========================================================
MODEL_PATH = os.path.join("emotion_model", "emotion_model.h5")

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"❌ Model file not found at {MODEL_PATH}")

model = load_model(MODEL_PATH)

# ==========================================================
# Load Haarcascade Safely
# ==========================================================
face_cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"

if not os.path.exists(face_cascade_path):
    raise FileNotFoundError("❌ Haarcascade XML not found")

face_cascade = cv2.CascadeClassifier(face_cascade_path)

# ==========================================================
# Emotion Labels (MUST match training order)
# ==========================================================
labels = ["Normal", "Laugh", "Cry", "Angry"]


# ==========================================================
# Detect Emotion
# ==========================================================
def detect_emotion_from_frame(frame):

    try:
        if frame is None:
            return "No Face", 0.0

        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Detect faces
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.3,
            minNeighbors=5,
            minSize=(30, 30)
        )

        if len(faces) == 0:
            return "No Face", 0.0

        # Take first detected face
        (x, y, w, h) = faces[0]

        # Ensure bounding box is valid
        if w <= 0 or h <= 0:
            return "No Face", 0.0

        face = gray[y:y+h, x:x+w]

        if face.size == 0:
            return "No Face", 0.0

        # Resize to model input
        face = cv2.resize(face, (48, 48))
        face = face.astype("float32") / 255.0
        face = np.reshape(face, (1, 48, 48, 1))

        # Predict
        prediction = model.predict(face, verbose=0)

        confidence = float(np.max(prediction))
        emotion = labels[np.argmax(prediction)]

        return emotion, confidence

    except Exception as e:
        print("Emotion detection error:", e)
        return "No Face", 0.0