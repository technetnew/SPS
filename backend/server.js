const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const plansRoutes = require('./routes/plans');
const familyRoutes = require('./routes/family');
const skillsRoutes = require('./routes/skills');
const alertsRoutes = require('./routes/alerts');
const videosRoutes = require('./routes/videos');
const kiwixRoutes = require('./routes/kiwix');
const sharingRoutes = require('./routes/sharing');
const picturesRoutes = require('./routes/pictures');
const gpsRoutes = require('./routes/gps');
const tilesRoutes = require('./routes/tiles');
const osmRoutes = require('./routes/osm');
const pantryRoutes = require('./routes/pantry');
const familyProfilesRoutes = require('./routes/family-profiles');
const contactRoutes = require('./routes/contact');
const settingsRoutes = require('./routes/settings');
const systemRoutes = require('./routes/system');
const simulationRoutes = require('./routes/simulation');
const gardenRoutes = require('./routes/garden');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (required for Nginx reverse proxy)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet());

// CORS Configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.'
    });
  }
});
app.use('/api/', limiter);

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (for uploads)
const uploadDirs = [
  path.join(__dirname, 'uploads'),
  path.resolve('/var/www/sps/uploads'),
  path.resolve('/var/www/sps/pictures')
];

uploadDirs.forEach(dir => {
  app.use('/uploads', express.static(dir));
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/kiwix', kiwixRoutes);
app.use('/api/sharing', sharingRoutes);
app.use('/api/pictures', picturesRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/tiles', tilesRoutes);
app.use('/api/osm', osmRoutes);
app.use('/api/pantry', pantryRoutes);
app.use('/api/family-profiles', familyProfilesRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/garden', gardenRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`SPS Backend API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
