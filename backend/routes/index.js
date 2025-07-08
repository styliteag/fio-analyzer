const express = require('express');
const testRunsRoutes = require('./test-runs');
const importRoutes = require('./import');
const timeSeriesRoutes = require('./time-series');
const utilsRoutes = require('./utils');

const router = express.Router();

// Mount all route modules
router.use('/test-runs', testRunsRoutes);
router.use('/import', importRoutes);
router.use('/time-series', timeSeriesRoutes);
router.use('/', utilsRoutes);

module.exports = router;
