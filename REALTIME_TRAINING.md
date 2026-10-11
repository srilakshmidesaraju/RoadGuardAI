# RoadGuard AI real-time data and training guide

This project now separates two jobs:

1. Training uses historical accident/risk records to create `ai_service/accident_model.joblib`.
2. Prediction uses current route features, weather, traffic incidents, and user reports to score each route.

## 1. Install Python AI dependencies

```powershell
cd C:\Project_New\ai_service
pip install -r requirements.txt
```

## 2. Prepare training data

Create a CSV file with these columns:

```csv
accidents,distance_km,duration_min,incident_count,report_count,traffic,weather,time,mode,risk_score
4,12.5,35,2,3,High,Rainy,Night,Bike,86
1,8.2,14,0,1,Low,Sunny,Day,Car,22
2,16.0,41,1,2,Medium,Foggy,Night,Bus,67
```

Column meaning:

- `accidents`: weighted historical accidents near that route or road segment.
- `distance_km`: route distance.
- `duration_min`: route duration.
- `incident_count`: live/current incidents near the route.
- `report_count`: reports submitted by RoadGuard users near the route.
- `traffic`: `Low`, `Medium`, or `High`.
- `weather`: `Sunny`, `Rainy`, or `Foggy`.
- `time`: `Day` or `Night`.
- `mode`: `Car`, `Bike`, `Bus`, or `Walk`.
- `risk_score`: target label from 0 to 100.

Use official historical accident datasets where possible. For India, start with the Open Government Data platform and Ministry of Road Transport and Highways accident datasets, then transform the location/road/time/severity fields into the columns above.

## 3. Train the model

```powershell
cd C:\Project_New
python ai_service\train_model.py --csv data\roadguard_training.csv
```

This creates:

```text
ai_service\accident_model.joblib
```

Restart the Python AI service, or reload it without restarting:

```powershell
curl -X POST http://localhost:5001/reload_model
```

Check status:

```powershell
curl http://localhost:5001/model_status
```

## 4. Enable live data during prediction

The app can run without keys, but these environment variables improve real-time scoring:

```powershell
$env:OPENWEATHER_KEY="your_openweather_key"
$env:MAPQUEST_KEY="your_mapquest_key"
$env:MONGO_URI="mongodb://localhost:27017/roadguard"
$env:AI_SERVICE_URL="http://localhost:5001"
```

Live data currently used:

- OSRM public route service for alternate route geometry when start and destination are entered as coordinates, such as `17.3850, 78.4867`.
- OpenWeather current weather if `OPENWEATHER_KEY` is set.
- MapQuest traffic incidents if `MAPQUEST_KEY` is set.
- RoadGuard user accident reports stored in MongoDB.
- India regional baseline calibration from `data/india_region_risk.csv`.

## 5. India target city/state accuracy

For India use, enter the target city/state in the app's `Target city/state` field.
The backend applies official 2022 NCRB/ADSI accident, injury, and death baselines
from `data/india_region_risk.csv`.

Examples:

```text
Mumbai, Maharashtra
Kochi, Kerala
Lucknow, Uttar Pradesh
Bengaluru, Karnataka
Chennai, Tamil Nadu
Delhi
```

If the user leaves the field blank, the backend tries to infer the region from the
start/destination text using Indian city/state names. If it cannot infer a region,
it falls back to the India national baseline.

## 6. Important note about "real-time training"

Do not retrain the model for every route request. A safer production pattern is:

- Store incoming user reports immediately.
- Use those reports instantly as prediction features.
- Retrain the model on a schedule, for example nightly or weekly.
- Keep the previous model until the new model passes validation.

This avoids unstable predictions while still using real-time user reports in the current route score.
