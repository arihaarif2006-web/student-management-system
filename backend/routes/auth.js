const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const auth = require('../middleware/auth')

const router = express.Router()

// Helper to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      name: user.name,
      email: user.email,
    },
    process.env.JWT_SECRET || 'student-management-secret-key-default-2026',
    { expiresIn: '7d' }
  )
}

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'user', adminKey } = req.body

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: 'Name, email, and password are required',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long',
      })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        message: 'Please provide a valid email address',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = await User.findOne({
      email: normalizedEmail,
    })

    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists',
      })
    }

    // Role handling
    let assignedRole = 'user'
    if (role === 'admin') {
      const validAdminKey = process.env.ADMIN_SETUP_KEY?.trim()
      if (validAdminKey) {
        if (!adminKey || adminKey.trim() !== validAdminKey) {
          return res.status(403).json({
            message: 'Invalid Administrator setup key provided.',
          })
        }
      }
      assignedRole = 'admin'
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: assignedRole,
    })

    const token = generateToken(user)

    res.status(201).json({
      message: `Account registered successfully as ${assignedRole === 'admin' ? 'Administrator' : 'User'}`,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'An account with this email already exists',
      })
    }

    console.error('Registration error:', error.message)
    res.status(500).json({
      message: 'Registration failed due to a server error.',
    })
  }
})

// Log in
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email?.trim() || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      })
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    })

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: 'Invalid email or password',
      })
    }

    const token = generateToken(user)

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Login error:', error.message)
    res.status(500).json({
      message: 'Login failed due to a server error.',
    })
  }
})

// Get currently authenticated user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password')
    if (!user) {
      return res.status(404).json({
        message: 'User account not found',
      })
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Fetch profile error:', error.message)
    res.status(500).json({
      message: 'Failed to retrieve user profile.',
    })
  }
})

module.exports = router
