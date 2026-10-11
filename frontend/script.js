// Configuration
const BACKEND_URL = "http://localhost:3005";

// --- Modal Logic ---
const reportModal = document.getElementById('reportModal');
document.getElementById('openReportModalBtn').addEventListener('click', () => reportModal.classList.remove('hidden'));
document.getElementById('closeReportModalBtn').addEventListener('click', () => reportModal.classList.add('hidden'));

// --- Login & Live Location ---
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = document.getElementById('phoneNumber').value;
    if(phone) {
        localStorage.setItem('userPhone', phone);
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        setTimeout(() => map.invalidateSize(), 100); // fix leaflet rendering issue after unhide
    }
});

const handleLiveLocation = (callback) => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            callback(`${lat}, ${lng}`);
        }, (error) => {
            alert('Failed to get live location. Please allow location access.');
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
};

document.getElementById('useLiveLocationLoginBtn').addEventListener('click', () => {
    const phone = document.getElementById('phoneNumber').value;
    if(!phone) {
        alert('Please enter a phone number first');
        return;
    }
    
    handleLiveLocation((coords) => {
        localStorage.setItem('userPhone', phone);
        document.getElementById('start').value = coords; // Autofill start location
        // Pan map
        const [lat, lng] = coords.split(',').map(n => parseFloat(n.trim()));
        map.setView([lat, lng], 13);

        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        setTimeout(() => map.invalidateSize(), 100);
    });
});

document.getElementById('btnReportLiveLoc').addEventListener('click', () => {
    handleLiveLocation((coords) => {
        document.getElementById('reportLocation').value = coords;
    });
});

document.getElementById('btnUseCurrentLoc').addEventListener('click', () => {
    handleLiveLocation((coords) => {
        document.getElementById('start').value = coords;
        const [lat, lng] = coords.split(',').map(n => parseFloat(n.trim()));
        map.setView([lat, lng], 14);
    });
});

// Image Preview logic
let base64Image = "";
document.getElementById('reportImage').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            base64Image = event.target.result;
            const preview = document.getElementById('imagePreview');
            preview.src = base64Image;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        base64Image = "";
        document.getElementById('imagePreview').classList.add('hidden');
    }
});

// --- Map Initialization ---
// Default setup to India: Coordinates (20.5937, 78.9629)
const map = L.map('map').setView([20.5937, 78.9629], 5);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap - RoadGuard AI'
}).addTo(map);

// Array to hold active polylines so we can remove them later
let activeRoutes = [];

// Color map
const colorMap = {
    "green": "#28a745",
    "yellow": "#f29900",
    "orange": "#f29900",
    "red": "#ff4d4d",
    "gray": "#94a3b8"
};

const riskClassMap = {
    "Low": "green",
    "Moderate": "orange",
    "High": "red",
    "Lowest of routes": "green",
    "Middle of routes": "orange",
    "Highest of routes": "red"
};

// Custom Marker for Hotspots (replaced with CircleMarker below but kept for backwards comp)
const hotspotIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#ff4d4d;width:15px;height:15px;border-radius:50%;border:2px solid white;'></div>",
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

// Custom Marker for Start
const startIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#28a745;width:15px;height:15px;border-radius:50%;border:2px solid white;'></div>",
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

// Custom Marker for Destination
const destIcon = L.divIcon({
    className: 'custom-div-icon',
    html: "<div style='background-color:#ff4d4d;width:15px;height:15px;border-radius:50%;border:2px solid white;'></div>",
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

// --- Form Handling ---
document.getElementById('routeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Gather data
    const start = document.getElementById('start').value;
    const destination = document.getElementById('destination').value;
    const mode = document.getElementById('mode').value;
    const time = document.getElementById('time').value;
    const weather = document.getElementById('weather').value;
    const traffic = document.getElementById('traffic').value;
    const targetRegion = document.getElementById('targetRegion').value;

    const payload = { start, destination, targetRegion, mode, time, weather, traffic };

    // Clear old map layers and results
    activeRoutes.forEach(layer => map.removeLayer(layer));
    activeRoutes = [];
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '<p style="color:var(--text-secondary)">Calculating routes...</p>';
    document.getElementById('topRouteInfo').classList.add('hidden');

    try {
        const response = await fetch(`${BACKEND_URL}/routes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to process routes');
        }
        
        if (data.routes && data.routes.length > 0) {
            resultsContainer.innerHTML = ''; // clear loading text
            if (data.regionUsed) {
                const regionNote = document.createElement('div');
                regionNote.className = 'region-note';
                const startName = data.locationResolution?.startName || start;
                const destinationName = data.locationResolution?.destinationName || destination;
                regionNote.innerHTML = `
                    <div class="city-route">${startName} <span>to</span> ${destinationName}</div>
                    <div class="baseline">Region baseline: ${data.regionUsed.region} (${data.regionUsed.sourceYear})</div>
                `;
                resultsContainer.appendChild(regionNote);
            }

            let mapSimMarker = null;

            data.routes.forEach(route => {
                // 1. Draw Polyline on Map
                const polyline = L.polyline(route.coordinates, {
                    color: route.colorHex,
                    weight: 6,
                    opacity: 0.9,
                    lineCap: 'round',
                    lineJoin: 'round'
                }).addTo(map);

                // Add tooltips to lines
                polyline.bindTooltip(`<b>${route.name}</b><br>Risk: ${route.riskScore} (${route.riskLevel})`);
                activeRoutes.push(polyline);
                
                // Add markers for Start & Destination
                if(route.coordinates.length > 0) {
                    const startMarker = L.marker(route.coordinates[0], {icon: startIcon}).addTo(map).bindPopup("Start");
                    const endMarker = L.marker(route.coordinates[route.coordinates.length - 1], {icon: destIcon}).addTo(map).bindPopup("Destination");
                    activeRoutes.push(startMarker, endMarker);
                }

                // 2. Create Result Card
                const card = document.createElement('div');
                card.className = `route-card ${route.color || 'yellow'}`;
                card.style.cursor = 'pointer'; // Make it clickable
                const riskClass = riskClassMap[route.riskLevel] || route.color || 'yellow';
                const steps = (route.steps || []).slice(0, 5).map((step, index) => `
                    <li>
                        <span class="step-index">${index + 1}</span>
                        <span class="step-text">${step.instruction}</span>
                        <span class="step-distance">${step.distance}</span>
                    </li>
                `).join('');
                card.innerHTML = `
                    <div class="route-topline">
                        <div>
                            <div class="route-name">${route.name}</div>
                            <div class="route-source">${route.dataSource || 'route'}</div>
                        </div>
                        <div class="risk-meter ${riskClass}">
                            <strong>${route.riskScore}</strong>
                            <span>/100</span>
                        </div>
                    </div>
                    <div class="route-stats">
                        <span class="route-distance">${route.distance}</span>
                        <span class="route-dot">•</span>
                        <span class="route-time">${route.duration}</span>
                    </div>
                    <div class="route-score">${route.riskLevel} Risk</div>
                    <div class="route-compare">${route.comparisonNote || 'Risk compared for this route.'}</div>
                    <div class="route-xai">${route.explanation}</div>
                    <ol class="nav-steps">${steps}</ol>
                `;

                // Clicking Card triggers Simulation
                card.addEventListener('click', () => {
                    // Reset all other lines
                    activeRoutes.forEach(r => {
                        if (r.setStyle) { r.setStyle({ weight: 4, opacity: 0.3 }); }
                    });
                    // Highlight current route
                    polyline.setStyle({ weight: 8, opacity: 1.0 });

                    // Update Top Info
                    const topInfo = document.getElementById('topRouteInfo');
                    topInfo.innerHTML = `
                        <strong>${route.distance}</strong>
                        <span>${route.duration}</span>
                        <span>${route.riskLevel} Risk</span>
                    `;
                    topInfo.classList.remove('hidden');

                    // Highlight Card
                    document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');

                    // Navigation Simulation
                    if (mapSimMarker) map.removeLayer(mapSimMarker);
                    
                    mapSimMarker = L.circleMarker(route.coordinates[0], {
                        color: 'white', fillColor: '#000000', fillOpacity: 1, radius: 8
                    }).addTo(map);
                    activeRoutes.push(mapSimMarker);
                    map.panTo(route.coordinates[0]);

                    let step = 0;
                    const simInterval = setInterval(() => {
                        step++;
                        if (step >= route.coordinates.length) {
                            clearInterval(simInterval);
                            return;
                        }
                        mapSimMarker.setLatLng(route.coordinates[step]);
                        map.panTo(route.coordinates[step]);
                    }, 1000); // Move every 1s
                });

                resultsContainer.appendChild(card);
            });

            // 3. Draw Hotspots if provided
            if (data.hotspots && data.hotspots.length > 0) {
                data.hotspots.forEach(hs => {
                    const hotspotMarker = L.circleMarker([hs.lat, hs.lng], {
                        color: '#ff4d4d',
                        fillColor: '#ff4d4d',
                        fillOpacity: 0.6,
                        radius: 12
                    }).addTo(map);
                    hotspotMarker.bindPopup(`<b>${hs.label || 'Accident Hotspot'}</b>`);
                    activeRoutes.push(hotspotMarker);
                });
            }

            // Adjust map view to fit all drawn routes
            const group = new L.featureGroup(activeRoutes);
            map.fitBounds(group.getBounds(), { padding: [50, 50] });

        } else {
            resultsContainer.innerHTML = '<p style="color:red">No routes found.</p>';
        }

    } catch (error) {
        console.error("Error fetching routes:", error);
        resultsContainer.innerHTML = `<div class="error-card">Search failed: ${error.message}. Make sure the backend is running, then try again.</div>`;
    }
});

// --- Accident Reporting ---
document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const location = document.getElementById('reportLocation').value;
    const description = document.getElementById('reportDesc').value;
    const severity = document.getElementById('reportSeverity').value;
    const timeOfAccident = document.getElementById('reportTime').value;
    const msgEl = document.getElementById('reportMsg');
    const phoneNumber = localStorage.getItem('userPhone') || 'Unknown';

    try {
        const response = await fetch(`${BACKEND_URL}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                phoneNumber,
                location, 
                description,
                severity,
                timeOfAccident,
                image: base64Image
            })
        });

        if (response.ok) {
            msgEl.textContent = "Thank you! Accident report saved.";
            msgEl.style.color = "var(--risk-green)";
            
            // Clear form
            document.getElementById('reportLocation').value = '';
            document.getElementById('reportDesc').value = '';
            document.getElementById('reportSeverity').value = 'Low';
            document.getElementById('reportTime').value = '';
            document.getElementById('reportImage').value = '';
            document.getElementById('imagePreview').classList.add('hidden');
            base64Image = "";

            setTimeout(() => { msgEl.textContent = ''; }, 3000);
        } else {
            throw new Error("Failed to save.");
        }
    } catch (error) {
        msgEl.textContent = "Error saving report.";
        msgEl.style.color = "var(--risk-red)";
    }
});

async function predictRisk() {

    const data = {
        weather: 1,
        visibility: 10,
        temperature: 30,
        traffic_density: 2,
        road_type: 1,
        vehicles_involved: 2,
        casualties: 1,
        is_peak_hour: 1,
        risk_score: 2
    };

    try {

        const response = await fetch("http://127.0.0.1:5000/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        alert("AI Prediction: " + result.prediction);

    } catch (error) {

        console.error(error);

        alert("Error connecting to AI server");
    }
}