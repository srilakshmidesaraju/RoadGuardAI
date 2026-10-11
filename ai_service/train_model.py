from pathlib import Path
import argparse

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split


FEATURES = [
    "accidents",
    "distance_km",
    "duration_min",
    "incident_count",
    "report_count",
    "traffic",
    "weather",
    "time",
    "mode",
]


def train(csv_path, output_path):
    data = pd.read_csv(csv_path)
    missing = [column for column in FEATURES + ["risk_score"] if column not in data.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    x = pd.get_dummies(data[FEATURES])
    y = data["risk_score"].clip(0, 100)

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=42
    )

    model = RandomForestRegressor(
        n_estimators=250,
        min_samples_leaf=3,
        random_state=42,
    )
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    metrics = {
        "mae": round(mean_absolute_error(y_test, predictions), 3),
        "r2": round(r2_score(y_test, predictions), 3),
        "training_rows": int(len(data)),
        "feature_columns": list(x.columns),
    }

    joblib.dump({"model": model, "columns": list(x.columns), "metrics": metrics}, output_path)
    return metrics


def main():
    parser = argparse.ArgumentParser(description="Train RoadGuard AI accident risk model.")
    parser.add_argument("--csv", required=True, help="Training CSV path")
    parser.add_argument(
        "--out",
        default=str(Path(__file__).with_name("accident_model.joblib")),
        help="Output model path",
    )
    args = parser.parse_args()

    metrics = train(args.csv, args.out)
    print("Model trained successfully")
    print(f"Rows: {metrics['training_rows']}")
    print(f"MAE: {metrics['mae']}")
    print(f"R2: {metrics['r2']}")
    print(f"Saved: {args.out}")


if __name__ == "__main__":
    main()
