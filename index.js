const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// --- State Variables ---
let latestSensorData = {};
let eventLog = []; 
const MAX_LOG_ENTRIES = 20;

// --- NEW: Add a variable to track the last time we heard from the ESP32 ---
let lastHeartbeat = Date.now();
const DEVICE_TIMEOUT_MS = 10000; // 10 seconds

// Middleware
app.use(cors());
app.use(express.json());

// --- Endpoint for ESP32 to send data TO ---
app.post('/api/data', (req, res) => {
  const previousData = { ...latestSensorData };
  latestSensorData = req.body;
  
  // --- NEW: Update the heartbeat timestamp on every successful POST ---
  lastHeartbeat = Date.now();

  // Logic to check for state changes and add log entries
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  if (latestSensorData.earthquakeAlert && !previousData.earthquakeAlert) {
      addLogEntry({ timestamp, message: '🔴 Earthquake Alert TRIGGERED!' });
  } else if (!latestSensorData.earthquakeAlert && previousData.earthquakeAlert) {
      addLogEntry({ timestamp, message: '🟢 Earthquake Alert Cleared.' });
  }

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

// --- Endpoint for the website to get data FROM ---
app.get('/api/data', (req, res) => {
  
  // --- NEW: Check if the device is online ---
  const isOnline = (Date.now() - lastHeartbeat) < DEVICE_TIMEOUT_MS;

  res.json({
    isOnline, // <-- Send this new status to the frontend
    latestSensorData: isOnline ? latestSensorData : {}, // Send empty data if offline
    eventLog
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
