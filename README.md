# RoadGuardAI 🚦

### AI-Powered Road Safety and Risk-Aware Route Planning

RoadGuardAI is a road-safety routing application designed to help users compare routes using estimated accident risk, rather than relying only on travel time or distance.

The project combines a web interface, a Node.js backend, and a Python-based machine-learning service to calculate route risk using available road, traffic, weather, and other risk-related information.

## Problem Statement

Conventional navigation systems primarily help users find convenient routes based on travel time and distance. However, the quickest route may not always be the safest.

RoadGuardAI aims to make route selection more safety-aware by estimating risk using relevant road and travel conditions.

## Proposed Solution

RoadGuardAI is designed to:

- Accept a starting location and destination.
- Retrieve available routes through a routing service.
- Estimate risk using a trained machine-learning model and available route features.
- Present route risk scores on a scale of 0–100.
- Categorize estimated risk as Low, Moderate, or High.
- Provide risk-related explanations to help users understand the prediction.

*Risk estimates are model predictions, not guarantees of actual road safety.*

## Key Features

- **Risk-aware routing:** Evaluate routes using estimated safety risk in addition to route information.
- **Machine-learning risk prediction:** Use a trained model to estimate route risk.
- **Separate AI service:** Keep risk prediction in a Python Flask service.
- **Route retrieval:** Use the public OSRM routing service for supported route requests.
- **Configurable external data:** Environment settings are provided for weather and traffic-incident integrations.
- **India-focused risk data:** Include a regional risk-baseline CSV for India.
- **Model management endpoints:** Check model status and request model reloading through the AI service.

The availability of live weather, traffic incidents, database-backed reports, and other integrations depends on their implementation, configuration, credentials, and service availability.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express |
| AI service | Python, Flask |
| Machine learning | Trained model loaded with Joblib |
| Routing | OSRM public routing service |
| Data storage/configuration | MongoDB connection setting provided |
| Data processing | CSV datasets |

## System Architecture

```text
User
  |
  v
Frontend
HTML + CSS + JavaScript
  |
  v
Node.js / Express Backend
Port 3005
  |
  +------> OSRM Routing Service
  |
  +------> Configured External Data Services
  |
  v
Python Flask AI Service
Port 5001
  |
  v
Trained Risk Prediction Model
  |
  v
Risk Score and Explanation
  |
  v
Frontend Results
```

## Project Structure

```text
RoadGuardAI/
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── backend/
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
├── ai_service/
│   ├── app.py
│   ├── train_model.py
│   ├── prepare_training_data.py
│   ├── requirements.txt
│   └── accident_model.joblib
├── ai-model/
│   ├── app.py
│   ├── explain.py
│   ├── indian_roads_dataset.csv
│   ├── roadguard_model.pkl
│   └── test.py
├── data/
│   ├── india_region_risk.csv
│   ├── nyc_crashes_real.csv
│   └── roadguard_training.csv
├── .env.example
├── .gitignore
├── REALTIME_TRAINING.md
├── start_all.bat
└── README.md
```

## Prerequisites

Install the following software before running the application:

- Node.js and npm
- Python 3
- Git
- Windows Command Prompt or another terminal

MongoDB and external API credentials may be needed for the corresponding integrations.

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/srilakshmidesaraju/RoadGuardAI.git
cd RoadGuardAI
```

### 2. Set up the Python environment

From the project root in Windows Command Prompt:

```bat
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r ai_service\requirements.txt
```

If the project already has a working `.venv` directory, you may activate that environment instead of creating another one.

### 3. Install backend dependencies

```bat
cd backend
npm install
cd ..
```

### 4. Configure environment variables

Create a local `.env` file using `.env.example` as a reference. Add valid credentials only for the integrations you intend to use.

Example configuration:

```dotenv
OPENWEATHER_KEY=your_openweather_key
MAPQUEST_KEY=your_mapquest_key
MONGO_URI=mongodb://localhost:27017/roadguard
AI_SERVICE_URL=http://localhost:5001
PORT=3005
```

Keep your real `.env` file and API credentials private. Do not commit secrets to GitHub.

### 5. Start the application

From the project root, run:

```bat
start_all.bat
```

The supplied startup script installs the Python AI dependencies, starts the Python service, installs backend dependencies, and starts the Node.js backend.

When the services are running, open:

**http://localhost:3005/**

The Python AI service is configured to run at port `5001`.

## Machine-Learning Risk Prediction

The `ai_service` directory contains the Flask application and the trained model file `accident_model.joblib`.

The AI service exposes these endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /model_status` | Check the loaded-model status |
| `POST /reload_model` | Request a model reload |
| `POST /calculate_risk` | Calculate risk from a prediction request |

The model's output depends on the features supplied to it and the model's training data. Risk scores should be interpreted as estimates, not as certainty about future accidents.

### Training and data preparation

The repository includes scripts for preparing training data and training the AI model:

- `ai_service/prepare_training_data.py`
- `ai_service/train_model.py`

Refer to `REALTIME_TRAINING.md` for the documented data format, training workflow, configuration, and model-reloading instructions.

## Datasets

The repository contains CSV files used for risk data and model-related workflows:

- `data/india_region_risk.csv`
- `data/roadguard_training.csv`
- `data/nyc_crashes_real.csv`
- `ai-model/indian_roads_dataset.csv`

Before redistributing or using these datasets in a public or commercial deployment, verify their original sources, licenses, permitted uses, and suitability for the intended region.

## Security and Responsible Use

- Keep API keys and credentials out of source control.
- Validate user input and protect backend endpoints before public deployment.
- Do not treat a predicted risk score as a substitute for official road warnings or personal judgment.
- Verify the quality, geographic coverage, and freshness of accident, traffic, and weather data.
- Document model limitations and validate predictions against appropriate real-world data.

## Future Improvements

Potential areas for further development include:

- Broader and more reliable road-accident datasets.
- Better model evaluation and calibration.
- More comprehensive route-risk explanations.
- Improved real-time data coverage.
- Automated tests and deployment workflows.

These are potential improvements, not claims that the functionality is already implemented.

## License

No license has been specified in this README. Add a license after deciding how the project may be used, modified, and redistributed.