const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3005;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
const MAPQUEST_KEY = process.env.MAPQUEST_KEY || '';
const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY || '';
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/roadguard', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected to roadguard database.'))
  .catch(err => console.error('MongoDB connection error:', err));

const reportSchema = new mongoose.Schema({
    phoneNumber: String,
    location: String,
    description: String,
    severity: String,
    image: String,
    timeOfAccident: Date,
    lat: Number,
    lng: Number,
    createdAt: { type: Date, default: Date.now }
});
const Report = mongoose.model('Report', reportSchema);

function normalizeName(value) {
    return String(value || '')
        .toUpperCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^A-Z0-9&]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function loadRegionRiskData() {
    const csvPath = path.join(__dirname, '../data/india_region_risk.csv');
    if (!fs.existsSync(csvPath)) return new Map();

    const lines = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
    const rows = lines.slice(1).map(line => {
        const [region, type, cases, injured, died, sourceYear, source] = line.split(',');
        return {
            region: normalizeName(region),
            displayRegion: region,
            type,
            cases: Number(cases),
            injured: Number(injured),
            died: Number(died),
            sourceYear,
            source,
        };
    });
    const comparableRows = rows.filter(row => row.type !== 'country');
    const maxCases = Math.max(...comparableRows.map(row => row.cases));
    const maxFatalityRate = Math.max(...comparableRows.map(row => row.died / Math.max(row.cases, 1)));
    const maxInjuryRate = Math.max(...comparableRows.map(row => row.injured / Math.max(row.cases, 1)));
    const indexedRows = rows.map(row => {
        const density = row.cases / maxCases;
        const fatalityRate = (row.died / Math.max(row.cases, 1)) / maxFatalityRate;
        const injuryRate = (row.injured / Math.max(row.cases, 1)) / maxInjuryRate;
        const index = Math.min(100, Math.round((density * 45 + fatalityRate * 40 + injuryRate * 15) * 100) / 100);
        return { ...row, riskIndex: index };
    });
    const averageIndex = indexedRows
        .filter(row => row.type !== 'country')
        .reduce((total, row, _, arr) => total + row.riskIndex / arr.length, 0);

    return new Map(indexedRows.map(row => [
        row.region,
        row.type === 'country' ? { ...row, riskIndex: averageIndex } : row,
    ]));
}

const REGION_RISK = loadRegionRiskData();
const CITY_TO_REGION = new Map([
    ['MUMBAI', 'MAHARASHTRA'],
    ['PUNE', 'MAHARASHTRA'],
    ['NAGPUR', 'MAHARASHTRA'],
    ['NASHIK', 'MAHARASHTRA'],
    ['NASIK', 'MAHARASHTRA'],
    ['THANE', 'MAHARASHTRA'],
    ['HYDERABAD', 'TELANGANA'],
    ['BENGALURU', 'KARNATAKA'],
    ['BANGALORE', 'KARNATAKA'],
    ['MYSURU', 'KARNATAKA'],
    ['MYSORE', 'KARNATAKA'],
    ['CHENNAI', 'TAMIL NADU'],
    ['COIMBATORE', 'TAMIL NADU'],
    ['MADURAI', 'TAMIL NADU'],
    ['DELHI', 'DELHI'],
    ['NEW DELHI', 'DELHI'],
    ['KOLKATA', 'WEST BENGAL'],
    ['AHMEDABAD', 'GUJARAT'],
    ['SURAT', 'GUJARAT'],
    ['JAIPUR', 'RAJASTHAN'],
    ['LUCKNOW', 'UTTAR PRADESH'],
    ['KANPUR', 'UTTAR PRADESH'],
    ['AGRA', 'AGRA'],
    ['BHOPAL', 'BHOPAL'],
    ['INDORE', 'MADHYA PRADESH'],
    ['KOCHI', 'KERALA'],
    ['KOZHIKODE', 'KERALA'],
    ['THIRUVANANTHAPURAM', 'KERALA'],
]);

const CITY_COORDS = new Map([
    ['MUMBAI', { lat: 19.0760, lng: 72.8777, name: 'Mumbai, Maharashtra' }],
    ['PUNE', { lat: 18.5204, lng: 73.8567, name: 'Pune, Maharashtra' }],
    ['NAGPUR', { lat: 21.1458, lng: 79.0882, name: 'Nagpur, Maharashtra' }],
    ['NASHIK', { lat: 19.9975, lng: 73.7898, name: 'Nashik, Maharashtra' }],
    ['NASIK', { lat: 19.9975, lng: 73.7898, name: 'Nashik, Maharashtra' }],
    ['THANE', { lat: 19.2183, lng: 72.9781, name: 'Thane, Maharashtra' }],
    ['HYDERABAD', { lat: 17.3850, lng: 78.4867, name: 'Hyderabad, Telangana' }],
    ['BENGALURU', { lat: 12.9716, lng: 77.5946, name: 'Bengaluru, Karnataka' }],
    ['BANGALORE', { lat: 12.9716, lng: 77.5946, name: 'Bengaluru, Karnataka' }],
    ['CHENNAI', { lat: 13.0827, lng: 80.2707, name: 'Chennai, Tamil Nadu' }],
    ['COIMBATORE', { lat: 11.0168, lng: 76.9558, name: 'Coimbatore, Tamil Nadu' }],
    ['MADURAI', { lat: 9.9252, lng: 78.1198, name: 'Madurai, Tamil Nadu' }],
    ['DELHI', { lat: 28.6139, lng: 77.2090, name: 'Delhi' }],
    ['NEW DELHI', { lat: 28.6139, lng: 77.2090, name: 'New Delhi' }],
    ['KOLKATA', { lat: 22.5726, lng: 88.3639, name: 'Kolkata, West Bengal' }],
    ['AHMEDABAD', { lat: 23.0225, lng: 72.5714, name: 'Ahmedabad, Gujarat' }],
    ['SURAT', { lat: 21.1702, lng: 72.8311, name: 'Surat, Gujarat' }],
    ['JAIPUR', { lat: 26.9124, lng: 75.7873, name: 'Jaipur, Rajasthan' }],
    ['LUCKNOW', { lat: 26.8467, lng: 80.9462, name: 'Lucknow, Uttar Pradesh' }],
    ['KANPUR', { lat: 26.4499, lng: 80.3319, name: 'Kanpur, Uttar Pradesh' }],
    ['AGRA', { lat: 27.1767, lng: 78.0081, name: 'Agra, Uttar Pradesh' }],
    ['BHOPAL', { lat: 23.2599, lng: 77.4126, name: 'Bhopal, Madhya Pradesh' }],
    ['INDORE', { lat: 22.7196, lng: 75.8577, name: 'Indore, Madhya Pradesh' }],
    ['KOCHI', { lat: 9.9312, lng: 76.2673, name: 'Kochi, Kerala' }],
    ['KOZHIKODE', { lat: 11.2588, lng: 75.7804, name: 'Kozhikode, Kerala' }],
    ['THIRUVANANTHAPURAM', { lat: 8.5241, lng: 76.9366, name: 'Thiruvananthapuram, Kerala' }],
]);

function parseLatLng(value) {
    if (!value || typeof value !== 'string') return null;
    const parts = value.split(',').map(part => Number(part.trim()));
    if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
    return { lat: parts[0], lng: parts[1] };
}

function compactPlaceName(value) {
    if (!value) return '';
    return String(value)
        .split(',')
        .slice(0, 3)
        .map(part => part.trim())
        .filter(Boolean)
        .join(', ');
}

function findRegionRisk(...values) {
    for (const value of values) {
        const normalized = normalizeName(value);
        if (!normalized) continue;
        if (REGION_RISK.has(normalized)) return REGION_RISK.get(normalized);
        if (CITY_TO_REGION.has(normalized) && REGION_RISK.has(CITY_TO_REGION.get(normalized))) {
            return REGION_RISK.get(CITY_TO_REGION.get(normalized));
        }
        for (const [regionName, risk] of REGION_RISK.entries()) {
            if (normalized.includes(regionName) || regionName.includes(normalized)) return risk;
        }
        for (const [city, regionName] of CITY_TO_REGION.entries()) {
            if (normalized.includes(city) && REGION_RISK.has(regionName)) {
                return REGION_RISK.get(regionName);
            }
        }
    }
    return null;
}

async function resolveLocation(value) {
    const parsed = parseLatLng(value);
    if (parsed) return { point: parsed, regionRisk: null, source: 'coordinates', name: value };

    const regionRisk = findRegionRisk(value);
    const normalized = normalizeName(value);
    for (const [city, coords] of CITY_COORDS.entries()) {
        if (normalized === city || normalized.includes(city)) {
            return {
                point: { lat: coords.lat, lng: coords.lng },
                regionRisk,
                source: 'local city database',
                name: coords.name,
            };
        }
    }
    if (!value || typeof value !== 'string') {
        return { point: null, regionRisk, source: 'missing', name: '' };
    }

    try {
        const response = await axios.get(`${NOMINATIM_URL}/search`, {
            params: {
                q: value,
                format: 'jsonv2',
                addressdetails: 1,
                limit: 1,
                countrycodes: 'in',
            },
            headers: { 'User-Agent': 'RoadGuardAI/1.0 local student project' },
            timeout: 9000,
        });
        const first = response.data?.[0];
        if (!first) return { point: null, regionRisk, source: 'unresolved text', name: value };

        const address = first.address || {};
        const detectedRegion = findRegionRisk(
            address.city,
            address.town,
            address.village,
            address.county,
            address.state_district,
            address.state,
            value
        );
        return {
            point: { lat: Number(first.lat), lng: Number(first.lon) },
            regionRisk: detectedRegion || regionRisk,
            source: 'Nominatim geocode',
            name: compactPlaceName(first.display_name) || value,
        };
    } catch (error) {
        console.warn('Geocoding failed, using fallback routing:', error.message);
        return { point: null, regionRisk, source: 'geocode failed', name: value };
    }
}

function haversineKm(a, b) {
    const radius = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * radius * Math.asin(Math.sqrt(h));
}

function routeDistanceKm(points) {
    return points.slice(1).reduce((total, point, index) => {
        return total + haversineKm(points[index], point);
    }, 0);
}

function distancePointToSegmentKm(point, start, end) {
    const segmentLength = haversineKm(start, end);
    if (segmentLength === 0) return haversineKm(point, start);

    const x = point.lng;
    const y = point.lat;
    const x1 = start.lng;
    const y1 = start.lat;
    const x2 = end.lng;
    const y2 = end.lat;
    const rawT = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1))
        / (((x2 - x1) ** 2) + ((y2 - y1) ** 2));
    const t = Math.max(0, Math.min(1, rawT));
    const projection = { lat: y1 + t * (y2 - y1), lng: x1 + t * (x2 - x1) };
    return haversineKm(point, projection);
}

function minDistanceToRouteKm(point, routePoints) {
    if (routePoints.length === 0) return Infinity;
    if (routePoints.length === 1) return haversineKm(point, routePoints[0]);
    return routePoints.slice(1).reduce((minDistance, current, index) => {
        const previous = routePoints[index];
        return Math.min(minDistance, distancePointToSegmentKm(point, previous, current));
    }, Infinity);
}

function severityWeight(severity) {
    return { Low: 1, Medium: 2, High: 3 }[severity] || 1;
}

function inferTraffic(durationMin, distanceKm) {
    const minPerKm = durationMin / Math.max(distanceKm, 1);
    if (minPerKm >= 4) return 'High';
    if (minPerKm >= 2.2) return 'Medium';
    return 'Low';
}

function clampRisk(score) {
    return Math.max(0, Math.min(100, Math.round(score)));
}

function riskLabel(score) {
    if (score <= 39) return { riskLevel: 'Low', color: 'green' };
    if (score <= 74) return { riskLevel: 'Moderate', color: 'yellow' };
    return { riskLevel: 'High', color: 'red' };
}

function relativeRiskLabel(rank, total) {
    if (total <= 1) return riskLabel(rank);
    if (rank === 0) return { riskLevel: 'Lowest of routes', color: 'green', colorHex: '#188038' };
    if (rank === total - 1) return { riskLevel: 'Highest of routes', color: 'red', colorHex: '#d93025' };
    return { riskLevel: 'Middle of routes', color: 'orange', colorHex: '#f29900' };
}

function compareRoutesWithinSearch(routes) {
    if (routes.length <= 1) {
        return routes.map(route => ({
            ...route,
            colorHex: route.colorHex || '#188038',
            comparisonNote: 'Only one route available for this search.',
        }));
    }

    const avgDistance = routes.reduce((total, route) => total + route.distanceKmValue, 0) / routes.length;
    const avgDuration = routes.reduce((total, route) => total + route.durationMinValue, 0) / routes.length;

    const withComparableScore = routes.map((route, index) => {
        const durationPressure = route.durationMinValue / Math.max(route.distanceKmValue, 1);
        const avgDurationPressure = avgDuration / Math.max(avgDistance, 1);
        const distanceAdjustment = (route.distanceKmValue - avgDistance) * 0.04;
        const durationAdjustment = (durationPressure - avgDurationPressure) * 4.5;
        const alternativeAdjustment = route.dataSource === 'estimated alternative route' ? index * 2 : 0;
        const comparativeRiskScore = clampRisk(
            route.riskScore + distanceAdjustment + durationAdjustment + alternativeAdjustment
        );
        return { ...route, comparativeRiskScore };
    });

    const sorted = [...withComparableScore].sort((a, b) => {
        if (a.comparativeRiskScore !== b.comparativeRiskScore) {
            return a.comparativeRiskScore - b.comparativeRiskScore;
        }
        if (a.durationMinValue !== b.durationMinValue) {
            return a.durationMinValue - b.durationMinValue;
        }
        return a.distanceKmValue - b.distanceKmValue;
    });
    const rankByName = new Map(sorted.map((route, rank) => [route.name, rank]));

    return withComparableScore.map(route => {
        const rank = rankByName.get(route.name);
        const relative = relativeRiskLabel(rank, routes.length);
        return {
            ...route,
            riskScore: route.comparativeRiskScore,
            riskLevel: relative.riskLevel,
            color: relative.color,
            colorHex: relative.colorHex,
            comparisonRank: rank + 1,
            comparisonNote: `Compared with ${routes.length} routes for this same search.`,
        };
    });
}

function applyRegionCalibration(risk, regionRisk) {
    if (!regionRisk) return risk;

    const national = REGION_RISK.get('INDIA');
    const nationalIndex = national?.riskIndex || 45;
    const adjustment = Math.max(-12, Math.min(18, (regionRisk.riskIndex - nationalIndex) * 0.35));
    const riskScore = clampRisk(risk.riskScore + adjustment);
    const label = riskLabel(riskScore);
    const explanation = `${risk.explanation} Region baseline: ${regionRisk.displayRegion} (${regionRisk.cases.toLocaleString()} accidents, ${regionRisk.died.toLocaleString()} deaths in ${regionRisk.sourceYear}).`;

    return {
        ...risk,
        riskScore,
        riskLevel: label.riskLevel,
        color: label.color,
        regionBaseline: {
            region: regionRisk.displayRegion,
            cases: regionRisk.cases,
            injured: regionRisk.injured,
            died: regionRisk.died,
            sourceYear: regionRisk.sourceYear,
            source: regionRisk.source,
        },
        explanation,
    };
}

function mapWeather(openWeatherMain) {
    const value = String(openWeatherMain || '').toLowerCase();
    if (value.includes('rain') || value.includes('drizzle') || value.includes('thunder')) return 'Rainy';
    if (value.includes('fog') || value.includes('mist') || value.includes('haze') || value.includes('smoke')) return 'Foggy';
    return 'Sunny';
}

function localRiskEstimate(features) {
    const trafficImpact = { Low: 1, Medium: 5, High: 10 }[features.traffic] || 1;
    const weatherImpact = { Sunny: 1, Clear: 1, Rainy: 7, Rain: 7, Foggy: 9, Fog: 9 }[features.weather] || 1;
    const timeImpact = { Day: 2, Night: 8 }[features.time] || 2;
    const modeImpact = { Car: 3, Bike: 7, Bus: 4, Walk: 2 }[features.mode] || 3;
    const reports = Math.min(10, Number(features.report_count || 0));
    const incidents = Math.min(10, Number(features.incident_count || 0));
    const accidents = Math.min(10, Number(features.accidents || 0));
    const durationPressure = Math.min(10, Number(features.duration_min || 10) / Math.max(Number(features.distance_km || 5), 1));
    const raw = accidents * 0.25
        + reports * 0.2
        + incidents * 0.15
        + trafficImpact * 0.15
        + weatherImpact * 0.1
        + timeImpact * 0.075
        + modeImpact * 0.05
        + durationPressure * 0.025;
    const riskScore = clampRisk((raw / 8) * 100);
    const label = riskLabel(riskScore);
    const reasons = [];
    if (reports >= 3 || accidents >= 3) reasons.push('accident reports near this route');
    if (incidents >= 2) reasons.push('live incidents near the route');
    if (trafficImpact >= 5) reasons.push('traffic congestion');
    if (weatherImpact >= 7) reasons.push(`${String(features.weather).toLowerCase()} weather`);
    if (timeImpact >= 8) reasons.push('night travel');
    if (modeImpact >= 7) reasons.push('bike rider exposure');
    return {
        riskScore,
        riskLevel: label.riskLevel,
        color: label.color,
        modelSource: 'backend fallback formula',
        explanation: reasons.length
            ? `${label.riskLevel} risk due to ${reasons.slice(0, 3).join(', ')}. Source: backend fallback formula.`
            : `${label.riskLevel} risk under current route conditions. Source: backend fallback formula.`,
    };
}

async function getWeatherForPoint(point, fallbackWeather) {
    if (!OPENWEATHER_KEY || !point) return fallbackWeather || 'Sunny';
    try {
        const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
            params: { lat: point.lat, lon: point.lng, appid: OPENWEATHER_KEY },
            timeout: 6000
        });
        return mapWeather(response.data?.weather?.[0]?.main);
    } catch (error) {
        console.warn('Weather API failed, using selected weather:', error.message);
        return fallbackWeather || 'Sunny';
    }
}

function decodePolyline(encoded) {
    let index = 0;
    let lat = 0;
    let lng = 0;
    const coordinates = [];

    while (index < encoded.length) {
        let result = 0;
        let shift = 0;
        let byte = null;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);

        result = 0;
        shift = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
    return coordinates;
}

async function getOsrmRoutes(startPoint, destinationPoint) {
    if (!startPoint || !destinationPoint) return [];
    const url = `https://router.project-osrm.org/route/v1/driving/${startPoint.lng},${startPoint.lat};${destinationPoint.lng},${destinationPoint.lat}`;
    const response = await axios.get(url, {
        params: { alternatives: true, overview: 'full', geometries: 'polyline', steps: true },
        timeout: 10000
    });

    return (response.data.routes || []).map((route, index) => {
        const points = decodePolyline(route.geometry);
        const steps = (route.legs || []).flatMap(leg => leg.steps || []).map((step, stepIndex) => {
            const maneuver = step.maneuver || {};
            const roadName = step.name || 'road';
            const type = String(maneuver.type || 'continue').replace(/_/g, ' ');
            const modifier = maneuver.modifier ? `${maneuver.modifier} ` : '';
            const instruction = type === 'arrive'
                ? 'Arrive at destination'
                : stepIndex === 0
                ? `Start on ${roadName}`
                : `${type.charAt(0).toUpperCase()}${type.slice(1)} ${modifier}onto ${roadName}`;
            return {
                instruction,
                roadName,
                distance: `${(step.distance / 1000).toFixed(1)} km`,
                duration: `${Math.max(1, Math.round(step.duration / 60))} min`,
                location: maneuver.location ? { lng: maneuver.location[0], lat: maneuver.location[1] } : null,
            };
        });
        return {
            id: index + 1,
            name: `Route ${index + 1}`,
            points,
            steps,
            distanceKm: route.distance / 1000,
            durationMin: route.duration / 60,
            source: 'OSRM live route'
        };
    });
}

function fallbackRoutes(startPoint, destinationPoint, options = {}) {
    const start = startPoint || { lat: 20.5, lng: 78.9 };
    const destination = destinationPoint || { lat: 20.6, lng: 78.95 };
    const startId = options.startId || 1;
    const source = options.source || 'fallback route';
    const midLat = (start.lat + destination.lat) / 2;
    const midLng = (start.lng + destination.lng) / 2;
    const templates = [
        { name: 'Main Highway Route', offset: 0.04 },
        { name: 'City Center Route', offset: -0.04 },
        { name: 'Outer Ring Route', offset: 0.08 }
    ];

    return templates.map((template, index) => {
        const points = [
            start,
            { lat: midLat + template.offset, lng: midLng - template.offset },
            destination
        ];
        const distanceKm = routeDistanceKm(points);
        return {
            id: startId + index,
            name: options.namePrefix ? `${options.namePrefix} ${index + 1}` : template.name,
            points,
            steps: [
                { instruction: 'Start from selected location', roadName: 'Start', distance: '0.0 km', duration: '1 min', location: start },
                { instruction: `Continue via ${template.name}`, roadName: template.name, distance: `${distanceKm.toFixed(1)} km`, duration: `${Math.round(distanceKm * 1.8)} min`, location: points[1] },
                { instruction: 'Arrive at destination', roadName: 'Destination', distance: '0.0 km', duration: '1 min', location: destination },
            ],
            distanceKm,
            durationMin: distanceKm * (index === 0 ? 2.2 : index === 1 ? 3.2 : 2.6),
            source
        };
    });
}

async function getNearbyReports(routePoints) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const reports = await Report.find({
        createdAt: { $gte: since },
        lat: { $type: 'number' },
        lng: { $type: 'number' }
    }).limit(1000);

    return reports.filter(report => {
        const distance = minDistanceToRouteKm({ lat: report.lat, lng: report.lng }, routePoints);
        return distance <= 1.5;
    });
}

async function getTrafficIncidents(routePoints) {
    if (!MAPQUEST_KEY || routePoints.length === 0) return [];
    const lats = routePoints.map(point => point.lat);
    const lngs = routePoints.map(point => point.lng);
    const boundingBox = `${Math.max(...lats)},${Math.min(...lngs)},${Math.min(...lats)},${Math.max(...lngs)}`;

    try {
        const response = await axios.get('https://www.mapquestapi.com/traffic/v2/incidents', {
            params: {
                key: MAPQUEST_KEY,
                boundingBox,
                filters: 'incidents,congestion,construction',
                outFormat: 'json'
            },
            timeout: 8000
        });
        return response.data?.incidents || [];
    } catch (error) {
        console.warn('Traffic incident API failed:', error.message);
        return [];
    }
}

async function scoreRoute(route, input, weatherValue, regionRisk) {
    const nearbyReports = await getNearbyReports(route.points);
    const incidents = await getTrafficIncidents(route.points);
    const weightedReports = nearbyReports.reduce((total, report) => total + severityWeight(report.severity), 0);
    const traffic = input.traffic || inferTraffic(route.durationMin, route.distanceKm);
    const riskFeatures = {
        accidents: weightedReports,
        report_count: nearbyReports.length,
        incident_count: incidents.length,
        distance_km: route.distanceKm,
        duration_min: route.durationMin,
        traffic,
        weather: weatherValue,
        time: input.time,
        mode: input.mode
    };

    let baseRisk = null;
    try {
        const aiResponse = await axios.post(`${AI_SERVICE_URL}/calculate_risk`, riskFeatures, { timeout: 8000 });
        baseRisk = aiResponse.data;
    } catch (error) {
        console.warn('AI service unavailable, using backend risk fallback:', error.message);
        baseRisk = localRiskEstimate(riskFeatures);
    }

    const risk = applyRegionCalibration(baseRisk, regionRisk);
    const midpoint = route.points[Math.floor(route.points.length / 2)];
    return {
        name: route.name,
        coordinates: route.points.map(point => [point.lat, point.lng]),
        distance: `${route.distanceKm.toFixed(1)} km`,
        duration: `${Math.round(route.durationMin)} mins`,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        color: risk.color,
        colorHex: risk.color === 'green' ? '#28a745' : (risk.color === 'yellow' ? '#ffc107' : '#ff4d4d'),
        explanation: risk.explanation,
        dataSource: route.source,
        distanceKmValue: route.distanceKm,
        durationMinValue: route.durationMin,
        steps: (route.steps || []).slice(0, 12),
        reportsNearby: nearbyReports.length,
        liveIncidents: incidents.length,
        regionBaseline: risk.regionBaseline || null,
        hotspot: risk.riskScore >= 75 && midpoint ? {
            lat: midpoint.lat,
            lng: midpoint.lng,
            label: `Risk hotspot (${risk.riskScore}/100)`
        } : null
    };
}

app.post('/report', async (req, res) => {
    try {
        const { phoneNumber, location, description, severity, image, timeOfAccident } = req.body;
        const parsed = parseLatLng(location);
        const newReport = new Report({
            phoneNumber,
            location,
            description,
            severity,
            image,
            timeOfAccident,
            lat: parsed?.lat,
            lng: parsed?.lng
        });
        await newReport.save();
        res.status(201).json({ message: 'Report saved successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save report' });
    }
});

app.get('/reports', async (req, res) => {
    try {
        const reports = await Report.find().sort({ createdAt: -1 }).limit(10);
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

app.post('/routes', async (req, res) => {
    try {
        const { start, destination, targetRegion } = req.body;
        const startLocation = await resolveLocation(start);
        const destinationLocation = await resolveLocation(destination);
        const startPoint = startLocation.point;
        const destinationPoint = destinationLocation.point;
        const regionRisk = findRegionRisk(targetRegion)
            || destinationLocation.regionRisk
            || startLocation.regionRisk
            || findRegionRisk(destination, start)
            || REGION_RISK.get('INDIA');
        const weather = await getWeatherForPoint(startPoint, req.body.weather);

        let routes = [];
        try {
            routes = await getOsrmRoutes(startPoint, destinationPoint);
        } catch (error) {
            console.warn('OSRM route lookup failed, using fallback routes:', error.message);
        }
        if (routes.length === 0) {
            routes = fallbackRoutes(startPoint, destinationPoint);
        } else if (routes.length < 3 && startPoint && destinationPoint) {
            const estimatedAlternatives = fallbackRoutes(startPoint, destinationPoint, {
                startId: routes.length + 1,
                namePrefix: 'Estimated alternative',
                source: 'estimated alternative route',
            });
            routes = routes.concat(estimatedAlternatives.slice(0, 3 - routes.length));
        }

        const scoredRoutes = await Promise.all(routes.map(route => scoreRoute(route, req.body, weather, regionRisk)));
        const comparedRoutes = compareRoutesWithinSearch(scoredRoutes);
        const hotspots = comparedRoutes.filter(route => route.hotspot).map(route => route.hotspot);
        const finalRoutes = comparedRoutes
            .map(({ hotspot, distanceKmValue, durationMinValue, comparativeRiskScore, ...route }) => route)
            .sort((a, b) => a.riskScore - b.riskScore);

        res.json({
            routes: finalRoutes,
            hotspots,
            weatherUsed: weather,
            regionUsed: regionRisk ? {
                region: regionRisk.displayRegion,
                cases: regionRisk.cases,
                injured: regionRisk.injured,
                died: regionRisk.died,
                sourceYear: regionRisk.sourceYear,
            } : null,
            locationResolution: {
                start: startLocation.source,
                destination: destinationLocation.source,
                startName: startLocation.name || start,
                destinationName: destinationLocation.name || destination,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process routes' });
    }
});

app.listen(PORT, () => {
    console.log(`Node backend running on http://localhost:${PORT}`);
});
