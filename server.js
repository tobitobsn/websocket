const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

// App und Server erstellen
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Statische Dateien bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Aktuelle Sensordaten
let latestData = {
  roll: 0,
  pitch: 0,
  yaw: 0,
  timestamp: Date.now()
};

// Verbundene Clients
const clients = new Set();

// CORS-Header für WebSocket-Server
const corsOptions = {
  origin: '*', // Für Entwicklungszwecke; in Produktion die spezifische Domain angeben
  methods: ['GET', 'POST'],
  credentials: true
};

// Bei der HTTP-Server-Einrichtung
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Im WebSocket-Handler auf dem Server
wss.on('connection', (ws) => {
    console.log('Neuer Client verbunden');
    clients.add(ws);
    
    // Aktuelle Daten direkt senden
    ws.send(JSON.stringify(latestData));
    
    // Nachrichtenverarbeitung
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Ping-Pong-Mechanismus
            if (data.ping) {
                ws.send(JSON.stringify({pong: true}));
                return;
            }
            
            // ESP32 sendet Daten mit r, p, y Feldern
            if ('r' in data && 'p' in data && 'y' in data) {
                latestData = {
                    roll: data.r,
                    pitch: data.p,
                    yaw: data.y,
                    timestamp: Date.now()
                };
                
                // An alle anderen Clients weiterleiten
                clients.forEach((client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(latestData));
                    }
                });
            }
        } catch (e) {
            console.error('Fehler beim Verarbeiten der Nachricht:', e);
        }
    });
    
    // Verbindung geschlossen
    ws.on('close', () => {
        clients.delete(ws);
        console.log('Client getrennt');
    });
});

// Server starten
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
