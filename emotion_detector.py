import cv2
import numpy as np
from tensorflow.keras.models import load_model

model = load_model("emotion_model/emotion_model.h5")

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
)

labels = ["Normal", "Laugh", "Cry", "Angry"]

def detect_emotion_from_frame(frame):

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    if len(faces) == 0:
        return "No Face", 0

    (x, y, w, h) = faces[0]
    face = gray[y:y+h, x:x+w]
    face = cv2.resize(face, (48, 48))
    face = face / 255.0
    face = face.reshape(1, 48, 48, 1)

    prediction = model.predict(face)
    confidence = float(np.max(prediction))
    emotion = labels[np.argmax(prediction)]

    return emotion, confidence