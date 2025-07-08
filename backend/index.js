const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Import our modules
const { PORT, swaggerOptions } = require('./config');
const { initDatabase } = require('./database');
const { logInfo, requestLoggingMiddleware, errorLoggingMiddleware } = require('./utils');
const apiRoutes = require('./routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Add comprehensive logging middleware
app.use(requestLoggingMiddleware);

// Initialize database
const db = initDatabase();

// Dynamic Swagger setup that adapts to the current host
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', (req, res) => {
    // Generate dynamic server URL based on the request
    const hostHeader = req.get('Host');
    const protocol = req.get('X-Forwarded-Proto') || (req.secure ? 'https' : 'http');
    const currentServerUrl = `${protocol}://${hostHeader}`;

    // Clone the swagger options and update servers
    const dynamicSwaggerOptions = {
        ...swaggerOptions,
        definition: {
            ...swaggerOptions.definition,
            servers: [
                {
                    url: currentServerUrl,
                    description: 'Current server'
                },
                {
                    url: 'http://localhost:8000',
                    description: 'Development server'
                },
                {
                    url: '/',
                    description: 'Relative URL'
                }
            ]
        }
    };

    const dynamicSwaggerSpecs = swaggerJsdoc(dynamicSwaggerOptions);

    const swaggerUiAssets = swaggerUi.generateHTML(dynamicSwaggerSpecs, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'FIO Analyzer API Documentation'
    });

    res.send(swaggerUiAssets);
});

// Serve Swagger JSON
app.get('/api-docs/swagger.json', (req, res) => {
    // Generate dynamic server URL based on the request
    const hostHeader = req.get('Host');
    const protocol = req.get('X-Forwarded-Proto') || (req.secure ? 'https' : 'http');
    const currentServerUrl = `${protocol}://${hostHeader}`;

    // Clone the swagger options and update servers
    const dynamicSwaggerOptions = {
        ...swaggerOptions,
        definition: {
            ...swaggerOptions.definition,
            servers: [
                {
                    url: currentServerUrl,
                    description: 'Current server'
                }
            ]
        }
    };

    const dynamicSwaggerSpecs = swaggerJsdoc(dynamicSwaggerOptions);
    res.json(dynamicSwaggerSpecs);
});

// Mount API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    logInfo('Health check requested', { requestId: req.requestId });
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Add error logging middleware (must be last)
app.use(errorLoggingMiddleware);

// Start server
app.listen(PORT, () => {
    logInfo('FIO Analyzer Backend Server started', {
        port: PORT,
        nodeVersion: process.version,
        platform: process.platform,
        processId: process.pid,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    logInfo('Received SIGINT signal, initiating graceful shutdown', {
        processId: process.pid,
        uptime: process.uptime()
    });

    if (db) {
        db.close((err) => {
            if (err) {
                logError('Error closing database during shutdown', err, {
                    processId: process.pid
                });
            } else {
                logInfo('Database connection closed successfully during shutdown', {
                    processId: process.pid
                });
            }
            logInfo('Server shutdown complete', { processId: process.pid });
            process.exit(0);
        });
    } else {
        logInfo('Server shutdown complete (no database connection)', {
            processId: process.pid
        });
        process.exit(0);
    }
});

process.on('SIGTERM', () => {
    logInfo('Received SIGTERM signal, initiating graceful shutdown', {
        processId: process.pid,
        uptime: process.uptime()
    });

    if (db) {
        db.close((err) => {
            if (err) {
                logError('Error closing database during shutdown', err, {
                    processId: process.pid
                });
            } else {
                logInfo('Database connection closed successfully during shutdown', {
                    processId: process.pid
                });
            }
            logInfo('Server shutdown complete', { processId: process.pid });
            process.exit(0);
        });
    } else {
        logInfo('Server shutdown complete (no database connection)', {
            processId: process.pid
        });
        process.exit(0);
    }
});

module.exports = app;
