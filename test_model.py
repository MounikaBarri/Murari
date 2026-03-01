import os

file_path = "emotion_model/emotion_model.h5"

print("File Exists:", os.path.exists(file_path))

if os.path.exists(file_path):
    print("File Size:", os.path.getsize(file_path), "bytes")
else:
    print("File not found.")


# import cv2

# cap = cv2.VideoCapture(1)

# if not cap.isOpened():
#     print("Camera not detected")
# else:
#     print("Camera working")