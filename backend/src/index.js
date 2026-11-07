import express from 'express';
import { config, getSandboxName } from './config/config.js';
import apiRoutes from './routes/api.routes.js';
import contextRoutes from './routes/context.routes.js';
import extRoutes from './routes/ext.routes.js';
import { originGuard, tokenGuard, sandboxScope } from './middleware/security.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.disable('x-powered-by');

// Middleware (order matters: reject foreign origins and missing tokens before any work)
app.use(originGuard);
app.use(tokenGuard);
app.use(express.json({ limit: '2mb' }));
app.use(sandboxScope);

// API Routes
app.use('/api/ext', extRoutes);
app.use('/api/context', contextRoutes);
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
        sandbox: getSandboxName()
    });
});

export default app;

// Start server unless imported (tests import `app` directly)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    app.listen(config.port, config.host, () => {
        const row = (label, value) => `║  ${label.padEnd(10)} ${String(value).padEnd(46)}║`;
        console.log([
            '╔═══════════════════════════════════════════════════════════╗',
            '║          AEP AI Center - Backend Server                   ║',
            '╠═══════════════════════════════════════════════════════════╣',
            row('Status:', 'Running'),
            row('Listen:', `http://${config.host}:${config.port}`),
            row('Sandbox:', config.sandboxName),
            row('API token:', config.apiToken ? 'required' : 'off (set API_TOKEN to require one)'),
            row('API docs:', `http://${config.host}:${config.port}/api/catalog`),
            '╚═══════════════════════════════════════════════════════════╝'
        ].join('\n'));
        if (config.host !== '127.0.0.1' && config.host !== 'localhost' && !config.apiToken) {
            console.warn('[security] Listening on a non-loopback address without API_TOKEN. Anyone who can reach this port can use your AEP credentials.');
        }
    });
}
