const dns = require('node:dns')
try {
  dns.setServers(['8.8.8.8', '1.1.1.1'])
} catch (e) {
  // Ignore if custom dns cannot be set
}

const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()

const studentRoutes = require('./routes/students')
const authRoutes = require('./routes/auth')

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)
app.use(express.json())

// Health check endpoint
app.get('/api/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1
  res.json({
    status: 'ok',
    server: 'Midnight Campus API',
    database: isDbConnected ? 'connected' : 'disconnected',
    readyState: mongoose.connection.readyState,
    timestamp: new Date().toISOString(),
  })
})

// Student and Auth API routes
app.use('/api/students', studentRoutes)
app.use('/api/auth', authRoutes)

// Root test route
app.get('/', (req, res) => {
  res.json({
    message: 'Midnight Campus API is running!',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      students: '/api/students',
    },
  })
})

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err)
  res.status(500).json({
    message: 'An internal server error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
})

// Start server immediately so frontend can connect even while DB is initializing
const server = app.listen(PORT, () => {
  console.log(`🚀 Midnight Campus Server running on http://localhost:${PORT}`)
})

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('✅ MongoDB connected successfully!')
    })
    .catch((error) => {
      console.error('❌ MongoDB connection failed:', error.message)
      console.warn(
        `⚠️ Server is running on port ${PORT} but database queries will fail until MongoDB connection is established.`
      )
    })
} else {
  console.warn('⚠️ MONGODB_URI not found in environment variables.')
}

module.exports = app
