from pathlib import Path
import argparse

import numpy as np
import pandas as pd


def number(series):
    return pd.to_numeric(series, errors="coerce").fillna(0)


def time_bucket(value):
    try:
        hour = int(str(value).split(":")[0])
    except Exception:
        hour = 12
    return "Night" if hour < 6 or hour >= 19 else "Day"


def infer_mode(row):
    vehicle = str(row.get("vehicle_type_code1", "")).lower()
    if row.get("number_of_cyclist_injured", 0) > 0 or row.get("number_of_cyclist_killed", 0) > 0:
        return "Bike"
    if "bus" in vehicle:
        return "Bus"
    if "bike" in vehicle or "bicycle" in vehicle or "scooter" in vehicle or "motorcycle" in vehicle:
        return "Bike"
    return "Car"


def infer_weather(factor):
    factor = str(factor).lower()
    if "pavement slippery" in factor or "rain" in factor:
        return "Rainy"
    if "view obstructed" in factor or "obscured" in factor:
        return "Foggy"
    return "Sunny"


def prepare(input_csv, output_csv):
    df = pd.read_csv(input_csv)
    df = df.dropna(subset=["latitude", "longitude"]).copy()
    df["latitude"] = number(df["latitude"])
    df["longitude"] = number(df["longitude"])
    df = df[(df["latitude"].between(40, 42)) & (df["longitude"].between(-75, -72))]

    injury_cols = [
        "number_of_persons_injured",
        "number_of_pedestrians_injured",
        "number_of_cyclist_injured",
        "number_of_motorist_injured",
    ]
    death_cols = [
        "number_of_persons_killed",
        "number_of_pedestrians_killed",
        "number_of_cyclist_killed",
        "number_of_motorist_killed",
    ]
    for column in injury_cols + death_cols:
        df[column] = number(df[column])

    df["cell_lat"] = df["latitude"].round(2)
    df["cell_lng"] = df["longitude"].round(2)
    cell_counts = df.groupby(["cell_lat", "cell_lng"]).size().rename("cell_accidents")
    df = df.join(cell_counts, on=["cell_lat", "cell_lng"])

    df["injuries"] = df[injury_cols].sum(axis=1)
    df["deaths"] = df[death_cols].sum(axis=1)
    df["time"] = df["crash_time"].apply(time_bucket)
    df["mode"] = df.apply(infer_mode, axis=1)
    df["weather"] = df["contributing_factor_vehicle_1"].apply(infer_weather)

    q_low = df["cell_accidents"].quantile(0.50)
    q_high = df["cell_accidents"].quantile(0.80)
    df["traffic"] = np.select(
        [df["cell_accidents"] >= q_high, df["cell_accidents"] >= q_low],
        ["High", "Medium"],
        default="Low",
    )

    # Route-like features are estimated from crash hotspot density so the model
    # can learn RoadGuard's route-level shape from real event-level crash data.
    df["accidents"] = df["cell_accidents"].clip(0, 50)
    df["report_count"] = df["cell_accidents"].clip(0, 50)
    df["incident_count"] = (
        (df["traffic"] == "High").astype(int)
        + (df["injuries"] > 0).astype(int)
        + (df["deaths"] > 0).astype(int) * 3
    ).clip(0, 10)
    df["distance_km"] = np.select(
        [df["traffic"] == "High", df["traffic"] == "Medium"],
        [4.0, 7.5],
        default=12.0,
    )
    df["duration_min"] = df["distance_km"] * np.select(
        [df["traffic"] == "High", df["traffic"] == "Medium"],
        [4.0, 2.8],
        default=1.8,
    )

    density_score = (df["cell_accidents"] / max(df["cell_accidents"].max(), 1)) * 35
    severity_score = (df["injuries"] * 12 + df["deaths"] * 55).clip(0, 55)
    condition_score = (
        (df["traffic"] == "High").astype(int) * 12
        + (df["weather"] != "Sunny").astype(int) * 10
        + (df["time"] == "Night").astype(int) * 8
        + (df["mode"] == "Bike").astype(int) * 8
    )
    df["risk_score"] = (density_score + severity_score + condition_score).clip(0, 100).round()

    output = df[
        [
            "accidents",
            "distance_km",
            "duration_min",
            "incident_count",
            "report_count",
            "traffic",
            "weather",
            "time",
            "mode",
            "risk_score",
        ]
    ].copy()
    output.to_csv(output_csv, index=False)
    return len(df), output["risk_score"].mean(), output["risk_score"].max()


def main():
    parser = argparse.ArgumentParser(description="Prepare RoadGuard training CSV from NYC crash data.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    rows, mean_risk, max_risk = prepare(args.input, args.output)
    print(f"Prepared {rows} real crash-derived training rows")
    print(f"Mean risk score: {mean_risk:.2f}")
    print(f"Max risk score: {max_risk:.0f}")
    print(f"Saved: {args.output}")


if __name__ == "__main__":
    main()
