import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

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

# Automatically encode ALL text columns
le = LabelEncoder()

for column in df.columns:
    if df[column].dtype == "object":
        df[column] = le.fit_transform(df[column])

# Features (Input)
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

# Target (Output)
y = df["accident_severity"]

# Split dataset
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

# Create model
model = RandomForestClassifier()

# Train model
model.fit(X_train, y_train)

# Predict
predictions = model.predict(X_test)

# Accuracy
accuracy = accuracy_score(y_test, predictions)

print("\nModel Accuracy:")
print(accuracy)

import joblib

# Save trained model
joblib.dump(model, "roadguard_model.pkl")

print("\nModel saved successfully!")