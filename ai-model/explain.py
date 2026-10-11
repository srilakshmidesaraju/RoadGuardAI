import pandas as pd
import joblib
from sklearn.preprocessing import LabelEncoder

# Load dataset
df = pd.read_csv("indian_roads_dataset.csv")

# Select useful columns
df = df[
    [
        "weather",
        "visibility",
        "temperature",
        "traffic_density",
        "road_type",
        "accident_severity",
        "vehicles_involved",
        "casualties",
        "is_peak_hour",
        "risk_score"
    ]
]

# Remove empty values
df = df.dropna()

# Encode text columns
le = LabelEncoder()

for column in df.columns:
    if df[column].dtype == "object":
        df[column] = le.fit_transform(df[column])

# Features
X = df[
    [
        "weather",
        "visibility",
        "temperature",
        "traffic_density",
        "road_type",
        "vehicles_involved",
        "casualties",
        "is_peak_hour",
        "risk_score"
    ]
]

# Load trained model
model = joblib.load("roadguard_model.pkl")

# Get feature importance
importance_values = model.feature_importances_

print("\nFeature Importance:\n")

for feature, importance in zip(X.columns, importance_values):
    print(f"{feature}: {importance}")