const express = require('express')
const mongoose = require('mongoose')
const Student = require('../models/Student')
const auth = require('../middleware/auth')
const { adminOnly } = require('../middleware/auth')

const router = express.Router()

// All student routes require authentication
router.use(auth)

// GET: Fetch students with search, filters, pagination, and overview statistics
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      department = '',
      semester = '',
      page = '1',
      limit = '10',
    } = req.query

    const currentPage = Math.max(1, parseInt(page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 10))

    const filter = {}

    if (search && search.trim()) {
      const trimmedSearch = search.trim()
      const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escapedSearch, 'i')

      filter.$or = [
        { name: regex },
        { email: regex },
        { department: regex },
      ]

      if (mongoose.isValidObjectId(trimmedSearch)) {
        filter.$or.push({ _id: trimmedSearch })
      }
    }

    if (department && department.trim()) {
      filter.department = department.trim()
    }

    if (semester !== '' && semester !== undefined && semester !== null) {
      const parsedSemester = Number(String(semester).replace(/(st|nd|rd|th)$/i, ''))
      if (!Number.isNaN(parsedSemester) && parsedSemester >= 1 && parsedSemester <= 8) {
        filter.semester = parsedSemester
      }
    }

    const total = await Student.countDocuments(filter)
    const totalAllStudents = await Student.countDocuments()
    const allDepartments = await Student.distinct('department')

    const students = await Student.find(filter)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)

    res.status(200).json({
      students,
      pagination: {
        total,
        page: currentPage,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
      stats: {
        totalStudents: totalAllStudents,
        totalDepartments: allDepartments.length,
        departments: allDepartments,
      },
    })
  } catch (error) {
    console.error('Error fetching students:', error.message)
    res.status(500).json({
      message: 'Failed to fetch students from database.',
    })
  }
})

// GET /:id: Fetch single student by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid student ID format.' })
    }

    const student = await Student.findById(id)
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' })
    }

    res.status(200).json({ student })
  } catch (error) {
    console.error('Error fetching student details:', error.message)
    res.status(500).json({ message: 'Failed to fetch student details.' })
  }
})

// POST: Add a new student to MongoDB (Admin only)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, email, department, semester } = req.body

    if (!name?.trim() || !email?.trim() || !department?.trim() || semester === undefined || semester === null || semester === '') {
      return res.status(400).json({
        message: 'All fields (Name, Email, Department, Semester) are required.',
      })
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(email.trim())) {
      return res.status(400).json({
        message: 'Please provide a valid email address.',
      })
    }

    const parsedSemester = Number(String(semester).replace(/(st|nd|rd|th)$/i, ''))
    if (Number.isNaN(parsedSemester) || parsedSemester < 1 || parsedSemester > 8) {
      return res.status(400).json({
        message: 'Semester must be a valid number between 1 and 8.',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existingStudent = await Student.findOne({
      email: normalizedEmail,
    })

    if (existingStudent) {
      return res.status(409).json({
        message: 'A student with this email address already exists.',
      })
    }

    const student = await Student.create({
      name: name.trim(),
      email: normalizedEmail,
      department: department.trim(),
      semester: parsedSemester,
    })

    res.status(201).json({
      message: 'Student added successfully!',
      student,
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'A student with this email address already exists.',
      })
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        message: error.message,
      })
    }

    console.error('Error adding student:', error.message)
    res.status(500).json({
      message: 'Failed to add student to database.',
    })
  }
})

// PUT: Update an existing student (Admin only)
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, department, semester } = req.body

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid student ID format.',
      })
    }

    if (!name?.trim() || !email?.trim() || !department?.trim() || semester === undefined || semester === null || semester === '') {
      return res.status(400).json({
        message: 'All fields (Name, Email, Department, Semester) are required.',
      })
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(email.trim())) {
      return res.status(400).json({
        message: 'Please provide a valid email address.',
      })
    }

    const parsedSemester = Number(String(semester).replace(/(st|nd|rd|th)$/i, ''))
    if (Number.isNaN(parsedSemester) || parsedSemester < 1 || parsedSemester > 8) {
      return res.status(400).json({
        message: 'Semester must be a valid number between 1 and 8.',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existingStudent = await Student.findOne({
      email: normalizedEmail,
      _id: { $ne: id },
    })

    if (existingStudent) {
      return res.status(409).json({
        message: 'Another student already has this email address.',
      })
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        email: normalizedEmail,
        department: department.trim(),
        semester: parsedSemester,
      },
      { new: true, runValidators: true }
    )

    if (!updatedStudent) {
      return res.status(404).json({
        message: 'Student record not found.',
      })
    }

    res.status(200).json({
      message: 'Student updated successfully!',
      student: updatedStudent,
    })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Another student already has this email address.',
      })
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        message: error.message,
      })
    }

    console.error('Error updating student:', error.message)
    res.status(500).json({
      message: 'Failed to update student record.',
    })
  }
})

// DELETE: Remove a student from MongoDB (Admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: 'Invalid student ID format.',
      })
    }

    const deletedStudent = await Student.findByIdAndDelete(id)

    if (!deletedStudent) {
      return res.status(404).json({
        message: 'Student record not found.',
      })
    }

    res.status(200).json({
      message: 'Student deleted successfully!',
      student: deletedStudent,
    })
  } catch (error) {
    console.error('Error deleting student:', error.message)
    res.status(500).json({
      message: 'Failed to delete student record.',
    })
  }
})

module.exports = router
