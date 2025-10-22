const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// --- State Variables ---
let latestSensorData = {};
let eventLog = [];
const MAX_LOG_ENTRIES = 20;

// --- Heartbeat tracking for device status ---
let lastHeartbeat = 0; // Set to 0 so it's "offline" until first POST
const DEVICE_TIMEOUT_MS = 10000; // 10 seconds

// --- Thresholds (defined globally) ---
const HEALTH_THRESHOLD = 30;
const STRESS_THRESHOLD_MV = 30;

// Middleware
app.use(cors());
app.use(express.json());

// --- Endpoint for ESP32 to send data TO ---
app.post('/api/data', (req, res) => {
    // Store the previous state BEFORE updating
    const previousData = { ...latestSensorData };

    // Get new data from ESP32
    latestSensorData = req.body;

    // --- 1. UPDATE HEARTBEAT ---
    lastHeartbeat = Date.now();

    // --- 2. MOVE THRESHOLD LOGIC HERE ---
    // Check if the new data is below the thresholds
    if (latestSensorData.health < HEALTH_THRESHOLD || latestSensorData.voltage < STRESS_THRESHOLD_MV) {
        latestSensorData.weakBrickWarning = true;
    } else {
        latestSensorData.weakBrickWarning = false;
    }
    // --- END OF MOVED LOGIC ---

    // --- 3. LOGIC TO CHECK FOR CHANGES ---
    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    // Check for earthquake alert changes
    if (latestSensorData.earthquakeAlert && !previousData.earthquakeAlert) {
        addLogEntry({ timestamp, message: '🔴 Earthquake Alert TRIGGERED!' });
    } else if (!latestSensorData.earthquakeAlert && previousData.earthquakeAlert) {
        addLogEntry({ timestamp, message: '🟢 Earthquake Alert Cleared.' });
    }

    // Check for weak brick warning changes (this will NOW work)
    if (latestSensorData.weakBrickWarning && !previousData.weakBrickWarning) {
        addLogEntry({ timestamp, message: '🟡 Weak Brick Warning DETECTED!' });
    } else if (!latestSensorData.weakBrickWarning && previousData.weakBrickWarning) {
        addLogEntry({ timestamp, message: '🔵 Weak Brick Warning Cleared.' });
    }

    console.log('Received data:', latestSensorData);
    res.status(200).send({ message: 'Data received and processed' });
});

// Helper function to manage the log
function addLogEntry(entry) {
    eventLog.unshift(entry); // Add new entry to the beginning
    if (eventLog.length > MAX_LOG_ENTRIES) {
        eventLog.pop(); // Remove the oldest entry if log is full
    }
}

// --- Endpoint for Webpage to get data FROM ---
app.get('/api/data', (req, res) => {
    
    // --- 1. CHECK THE DEVICE STATUS ---
    // Check if the last heartbeat was too long ago
    const isDeviceOnline = (Date.now() - lastHeartbeat) < DEVICE_TIMEOUT_MS;

    // --- 2. SEND THE FINAL JSON ---
    res.json({
        isOnline: isDeviceOnline,           // <-- FIX 1: Use the real status
        latestSensorData: latestSensorData,
        eventLog: eventLog                  // <-- FIX 2: Send the real log
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
