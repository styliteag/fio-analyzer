const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Import our modules
const { PORT, swaggerOptions } = require('./config');
const { initDatabase } = require('./database');
const { logInfo } = require('./utils');
const apiRoutes = require('./routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

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
    console.log('\nReceived SIGINT. Graceful shutdown...');
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed.');
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Graceful shutdown...');
    if (db) {
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed.');
            }
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

module.exports = app;