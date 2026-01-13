import express from 'express';
import cors from 'cors';
import { config } from './config/config.js';
import apiRoutes from './routes/api.routes.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Serve API catalog (for API Browser)
app.get('/api/catalog', (req, res) => {
    try {
        const catalogPath = path.join(__dirname, '../../api-catalog.json');
        if (fs.existsSync(catalogPath)) {
            const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
            res.json(catalog);
        } else {
            res.status(404).json({ error: 'API catalog not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        sandbox: config.sandboxName
    });
});

// Start server
app.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║          AEP Monitoring System - Backend Server           ║
╠═══════════════════════════════════════════════════════════╣
║  Status:    Running                                       ║
║  Port:      ${config.port}                                          ║
║  Sandbox:   ${config.sandboxName.padEnd(43)}║
║  API Docs:  http://localhost:${config.port}/api/catalog              ║
╚═══════════════════════════════════════════════════════════╝
    `);
});
