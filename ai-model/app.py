from flask import Flask, request, jsonify
import joblib
import pandas as pd

# Create Flask app
app = Flask(__name__)

# Load trained model
model = joblib.load("roadguard_model.pkl")

# Prediction route
@app.route("/predict", methods=["POST"])
def predict():

    # Get JSON data from frontend
    data = request.json

    # Convert to DataFrame
    df = pd.DataFrame([data])

    # Predict
    prediction = model.predict(df)

    # Convert numeric prediction into labels
    risk_labels = {
        0: "Low Risk",
        1: "Medium Risk",
        2: "High Risk"
    }

    result = risk_labels.get(int(prediction[0]), "Unknown")

    # Return result
    return jsonify({
        "prediction": result
    })

# Run server
if __name__ == "__main__":
    app.run(debug=True) 