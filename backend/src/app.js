require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const pool = require('./config/database');

// Run schema migration + ensure admin user on startup
(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/001_schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('DB schema ready');
  } catch (e) {
    console.warn('Schema migration warning:', e.message.slice(0, 120));
  }
  try {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('Admin@1234', 10);
    const roleRes = await pool.query(`SELECT id FROM roles WHERE name='admin' LIMIT 1`);
    if (roleRes.rows[0]) {
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role_id)
         VALUES ('Admin','admin@mipl.com',$1,$2)
         ON CONFLICT (email) DO UPDATE SET password_hash=$1`,
        [hash, roleRes.rows[0].id]
      );
      console.log('Admin user ready');
    }
  } catch (e) {
    console.warn('Admin seed warning:', e.message.slice(0, 120));
  }
})();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const customersRoutes = require('./routes/customers');
const rawMaterialsRoutes = require('./routes/rawMaterials');
const machinesRoutes = require('./routes/machines');
const processCategoriesRoutes = require('./routes/processCategories');
const fgCodesRoutes = require('./routes/fgCodes');
const shiftsRoutes = require('./routes/shifts');
const stockRoutes = require('./routes/stock');
const specSheetRoutes = require('./routes/specSheets');
const salesOrderRoutes = require('./routes/salesOrders');
const productionOrderRoutes = require('./routes/productionOrders');
const machinePlanRoutes = require('./routes/machinePlans');
const ptdRoutes = require('./routes/ptd');
const dashboardRoutes = require('./routes/dashboard');
const exportRoutes = require('./routes/exports');
const settingsRoutes = require('./routes/settings');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/raw-materials', rawMaterialsRoutes);
app.use('/api/machines', machinesRoutes);
app.use('/api/process-categories', processCategoriesRoutes);
app.use('/api/fg-codes', fgCodesRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/spec-sheets', specSheetRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/production-orders', productionOrderRoutes);
app.use('/api/machine-plans', machinePlanRoutes);
app.use('/api/ptd', ptdRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`MIPL PPC Backend running on port ${PORT}`);
});

module.exports = app;
