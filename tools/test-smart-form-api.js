// Simple test script to verify smart form API workflow
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3004;

// Middleware
app.use(
  cors({
    origin: ['http://localhost:3001'], // Smart form dev server
    credentials: true,
  })
);
app.use(express.json());

// Test endpoint for smart form processing
app.post('/api/smart-form/process', async (req, res) => {
  const { ticketId, source } = req.body;

  console.log('✅ Smart form processing request received:', {
    ticketId,
    source,
    timestamp: new Date().toISOString(),
  });

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('🚀 Smart form processing completed successfully');

  res.json({
    success: true,
    ticketId,
    message: 'Smart form processed successfully (test mode)',
    correlationId: `test-${Date.now()}`,
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Unit Talk Platform API (Test Mode)',
    version: '1.0.0-test',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Test API Server started on port ${PORT}`);
  console.log(`Test endpoints:`);
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  http://localhost:${PORT}/api/health`);
  console.log(`  POST http://localhost:${PORT}/api/smart-form/process`);
});
