const jwt = require('jsonwebtoken')

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Access denied. Please log in.',
    })
  }

  const token = authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      message: 'Access denied. Token missing.',
    })
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'student-management-secret-key-default-2026'
    )
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({
      message: 'Invalid or expired session. Please log in again.',
    })
  }
}

// Restrict certain routes to administrators
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      message: 'Access denied. Administrator privileges required for this action.',
    })
  }

  next()
}

module.exports = auth
module.exports.adminOnly = adminOnly
