import base64
import os
import sys

import cv2
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS


sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.face_detector import FaceDetector
from modules.emotion import EmotionRecognizer
from modules.drowsiness import DrowsinessDetector
from modules.head_pose import HeadPoseEstimator
from modules.behavior_detector import BehaviorDetector
from modules.engagement_engine import EngagementEngine

app = Flask(__name__)

_default_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_frontend_url = os.getenv("FRONTEND_URL")
allow_origins = _default_origins + [_frontend_url] if _frontend_url else _default_origins
CORS(app, origins=allow_origins)

# ── Shared, stateless models — safe to reuse across every session ──────────
face_detector = FaceDetector()
emotion_model = EmotionRecognizer()
head_pose = HeadPoseEstimator()
behavior = BehaviorDetector()
engine = EngagementEngine()
print("ML/CV models loaded successfully.")

# ── Per-session state ───────────────────────────────────────────────────────
# DrowsinessDetector keeps mutable counters (closed_counter/yawn_counter) to
# debounce blink/yawn detection across consecutive frames — that state must
# stay isolated per student session, not shared globally like the models above.
_drowsiness_sessions: dict[str, DrowsinessDetector] = {}


def _get_drowsiness(session_id: str) -> DrowsinessDetector:
    detector = _drowsiness_sessions.get(session_id)
    if detector is None:
        detector = DrowsinessDetector()
        _drowsiness_sessions[session_id] = detector
    return detector


def _placeholder_stats(state: str) -> dict:
    return {
        "state": state, "score": 0.0,
        "emotion": "Unknown", "emo_conf": 0.0, "ear": 0.0, "mar": 0.0,
        "drowsy": False, "yawning": False, "head_direction": "Unknown",
        "phone_detected": False, "looking_away": False,
        "person_present": False,
    }


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/frame", methods=["POST"])
def process_frame():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id")
    frame_b64 = data.get("frame_b64")

    if not session_id or not frame_b64:
        return jsonify({"error": "session_id and frame_b64 are required"}), 400

    try:
        jpg_bytes = base64.b64decode(frame_b64)
        frame = cv2.imdecode(np.frombuffer(jpg_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception as e:
        return jsonify({"error": f"Could not decode frame: {e}"}), 400

    if frame is None:
        return jsonify({"error": "Could not decode frame"}), 400

    landmarks, _ = face_detector.get_landmarks(frame)

    if landmarks is None:
        stats = _placeholder_stats("No Face Detected 🔍")
        try:
            br = behavior.detect(frame)
            stats["phone_detected"] = bool(br["phone_detected"])
            stats["person_present"] = bool(br["person_present"])
            if stats["phone_detected"]:
                stats["state"] = "Phone Detected 📱"
        except Exception:
            pass
        return jsonify({"current": stats})

    x_min, y_min = np.min(landmarks, axis=0)
    x_max, y_max = np.max(landmarks, axis=0)
    h, w = frame.shape[:2]
    x_min, y_min = max(0, int(x_min)), max(0, int(y_min))
    x_max, y_max = min(w, int(x_max)), min(h, int(y_max))
    face_roi = frame[y_min:y_max, x_min:x_max]

    emotion, emo_conf = emotion_model.predict(face_roi)

    drowsiness = _get_drowsiness(session_id)
    drowsy_result = drowsiness.analyze(landmarks)
    ear = drowsy_result["ear"]
    mar = drowsy_result["mar"]

    head_result = head_pose.estimate(landmarks)
    if head_result is None:
        head_score, head_direction, looking_away = 0.5, "Unknown", False
    else:
        head_score = 1.0 if not head_result["looking_away"] else 0.3
        head_direction = head_result["direction"]
        looking_away = head_result["looking_away"]

    behavior_result = behavior.detect(frame)
    phone_detected = behavior_result["phone_detected"]
    person_present = behavior_result["person_present"]
    behavior_score = behavior.get_score(frame)

    score, state = engine.calculate(emotion, ear, mar, head_score, behavior_score)

    stats = {
        "state": state, "score": score,
        "emotion": emotion, "emo_conf": float(emo_conf),
        "ear": float(ear), "mar": float(mar),
        "drowsy": bool(drowsy_result["drowsy"]), "yawning": bool(drowsy_result["yawning"]),
        "head_direction": head_direction,
        "phone_detected": bool(phone_detected),
        "looking_away": bool(looking_away),
        "person_present": bool(person_present),
    }

    return jsonify({"current": stats})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
