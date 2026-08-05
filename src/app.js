const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { corsOptionsDelegate } = require('./config/cors');
const { router: v1Router } = require('./routes/v1');
const { requestTelemetry } = require('./middlewares/requestTelemetry');
const { notFound } = require('./middlewares/notFound');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(requestTelemetry);
app.use(helmet());
app.use(cors(corsOptionsDelegate));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Official API surface.
app.use('/api/v1', v1Router);

// Legacy compatibility surface removed: only the official /api/v1 router remains mounted.

app.use(notFound);
app.use(errorHandler);

module.exports = { app };
