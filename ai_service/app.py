from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import math

try:
    import joblib
except Exception:
    joblib = None

app = Flask(__name__)
CORS(app)

MODEL_PATH = Path(__file__).with_name("accident_model.joblib")
MODEL_BUNDLE = None


def load_model():
    global MODEL_BUNDLE
    if joblib and MODEL_PATH.exists():
        MODEL_BUNDLE = joblib.load(MODEL_PATH)
    else:
        MODEL_BUNDLE = None


load_model()


TRAFFIC_IMPACT = {"Low": 1, "Medium": 5, "High": 10}
WEATHER_IMPACT = {"Sunny": 1, "Clear": 1, "Rainy": 7, "Rain": 7, "Foggy": 9, "Fog": 9}
TIME_IMPACT = {"Day": 2, "Night": 8}
MODE_IMPACT = {"Car": 3, "Bike": 7, "Bus": 4, "Walk": 2}


def clamp(value, low=0, high=100):
    return max(low, min(high, value))


def normalize_input(data):
    return {
        "accidents": clamp(int(data.get("accidents", 0)), 0, 50),
        "traffic": data.get("traffic", "Low"),
        "weather": data.get("weather", "Sunny"),
        "time": data.get("time", "Day"),
        "mode": data.get("mode", "Car"),
        "distance_km": float(data.get("distance_km", 5) or 5),
        "duration_min": float(data.get("duration_min", 10) or 10),
        "incident_count": clamp(int(data.get("incident_count", 0)), 0, 50),
        "report_count": clamp(int(data.get("report_count", data.get("accidents", 0))), 0, 50),
    }


def fallback_score(features):
    accidents = min(10, features["accidents"])
    traffic = TRAFFIC_IMPACT.get(features["traffic"], 1)
    weather = WEATHER_IMPACT.get(features["weather"], 1)
    time_of_day = TIME_IMPACT.get(features["time"], 2)
    mode = MODE_IMPACT.get(features["mode"], 3)
    incidents = min(10, features["incident_count"])
    reports = min(10, features["report_count"])
    duration_pressure = min(10, features["duration_min"] / max(features["distance_km"], 1))

    raw_score = (
        accidents * 0.25
        + reports * 0.2
        + incidents * 0.15
        + traffic * 0.15
        + weather * 0.1
        + time_of_day * 0.075
        + mode * 0.05
        + duration_pressure * 0.025
    )
    return int(clamp(round((raw_score / 8) * 100)))


def model_score(features):
    if not MODEL_BUNDLE:
        return None

    model = MODEL_BUNDLE["model"]
    columns = MODEL_BUNDLE["columns"]
    row = {
        "accidents": features["accidents"],
        "distance_km": features["distance_km"],
        "duration_min": features["duration_min"],
        "incident_count": features["incident_count"],
        "report_count": features["report_count"],
        "traffic": features["traffic"],
        "weather": features["weather"],
        "time": features["time"],
        "mode": features["mode"],
    }

    try:
        import pandas as pd

        frame = pd.DataFrame([row])
        encoded = pd.get_dummies(frame)
        encoded = encoded.reindex(columns=columns, fill_value=0)
        prediction = int(clamp(round(float(model.predict(encoded)[0]))))
        return max(prediction, fallback_score(features))
    except Exception as exc:
        print(f"Model prediction failed, using fallback: {exc}")
        return None


def risk_label(score):
    if score <= 39:
        return "Low", "green"
    if score <= 74:
        return "Moderate", "yellow"
    return "High", "red"


def explain(features, score, source):
    reasons = []
    if features["report_count"] >= 3 or features["accidents"] >= 3:
        reasons.append("accident reports near this route")
    if features["incident_count"] >= 2:
        reasons.append("live incidents on or near the route")
    if TRAFFIC_IMPACT.get(features["traffic"], 1) >= 5:
        reasons.append("traffic congestion")
    if WEATHER_IMPACT.get(features["weather"], 1) >= 7:
        reasons.append(f"{features['weather'].lower()} weather")
    if TIME_IMPACT.get(features["time"], 2) >= 8:
        reasons.append("night travel")
    if MODE_IMPACT.get(features["mode"], 3) >= 7:
        reasons.append("higher exposure for bike riders")

    top_reasons = reasons[:3]
    level, _ = risk_label(score)
    if top_reasons:
        return f"{level} risk due to {', '.join(top_reasons)}. Source: {source}."
    return f"{level} risk under current route conditions. Source: {source}."


@app.route("/calculate_risk", methods=["POST"])
def calculate_risk():
    features = normalize_input(request.json or {})
    score = model_score(features)
    source = "trained model" if score is not None else "fallback formula"
    if score is None:
        score = fallback_score(features)

    level, color = risk_label(score)
    return jsonify(
        {
            "riskScore": score,
            "riskLevel": level,
            "color": color,
            "modelSource": source,
            "explanation": explain(features, score, source),
        }
    )


@app.route("/model_status", methods=["GET"])
def model_status():
    return jsonify(
        {
            "trainedModelLoaded": MODEL_BUNDLE is not None,
            "modelPath": str(MODEL_PATH),
        }
    )


@app.route("/reload_model", methods=["POST"])
def reload_model():
    load_model()
    return jsonify({"trainedModelLoaded": MODEL_BUNDLE is not None})


if __name__ == "__main__":
    app.run(port=5001, debug=True)
