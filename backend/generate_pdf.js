const fs = require('fs')
const path = require('path')

class SimplePDF {
  constructor() {
    this.pages = []
    this.currentPage = null
  }

  addPage() {
    this.currentPage = {
      content: [],
    }
    this.pages.push(this.currentPage)
    return this
  }

  // Draw rectangle (x, y, w, h, strokeColor, fillColor)
  rect(x, y, w, h, stroke = [0.8, 0.8, 0.8], fill = null) {
    let cmd = ''
    if (fill) {
      cmd += `${fill[0]} ${fill[1]} ${fill[2]} rg\n`
    }
    if (stroke) {
      cmd += `${stroke[0]} ${stroke[1]} ${stroke[2]} RG\n`
    }
    cmd += `${x} ${y} ${w} ${h} re\n`
    if (fill && stroke) {
      cmd += 'B\n'
    } else if (fill) {
      cmd += 'f\n'
    } else if (stroke) {
      cmd += 'S\n'
    }
    this.currentPage.content.push(cmd)
    return this
  }

  line(x1, y1, x2, y2, color = [0.8, 0.8, 0.8], width = 1) {
    const cmd = `${width} w\n${color[0]} ${color[1]} ${color[2]} RG\n${x1} ${y1} m\n${x2} ${y2} l\nS\n`
    this.currentPage.content.push(cmd)
    return this
  }

  text(str, x, y, options = {}) {
    const font = options.font || 'F1' // F1 = Helvetica, F2 = Helvetica-Bold
    const size = options.size || 10
    const color = options.color || [0.1, 0.1, 0.1]

    // Escape parenthesis and backslashes
    const cleanStr = String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')

    const cmd = `BT\n/${font} ${size} Tf\n${color[0]} ${color[1]} ${color[2]} rg\n${x} ${y} Td\n(${cleanStr}) Tj\nET\n`
    this.currentPage.content.push(cmd)
    return this
  }

  build() {
    const objects = []
    let objId = 1

    const catalogId = objId++
    const pagesId = objId++
    const fontF1Id = objId++
    const fontF2Id = objId++
    const fontF3Id = objId++ // Courier

    const pageObjectIds = []
    const contentObjectIds = []

    this.pages.forEach(() => {
      pageObjectIds.push(objId++)
      contentObjectIds.push(objId++)
    })

    // 1: Catalog
    objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`

    // 2: Pages
    objects[pagesId] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${this.pages.length} >>`

    // Fonts
    objects[fontF1Id] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`
    objects[fontF2Id] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`
    objects[fontF3Id] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`

    // Page and Content objects
    this.pages.forEach((page, idx) => {
      const pId = pageObjectIds[idx]
      const cId = contentObjectIds[idx]

      objects[pId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontF1Id} 0 R /F2 ${fontF2Id} 0 R /F3 ${fontF3Id} 0 R >> >> /Contents ${cId} 0 R >>`

      const streamContent = page.content.join('\n')
      objects[cId] = `<< /Length ${Buffer.byteLength(streamContent)} >>\nstream\n${streamContent}\nendstream`
    })

    // Assemble file
    let pdf = `%PDF-1.4\n`
    const xrefOffsets = []

    for (let i = 1; i < objId; i++) {
      xrefOffsets[i] = Buffer.byteLength(pdf)
      pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`
    }

    const startXref = Buffer.byteLength(pdf)
    pdf += `xref\n0 ${objId}\n0000000000 65535 f \n`

    for (let i = 1; i < objId; i++) {
      const offset = String(xrefOffsets[i]).padStart(10, '0')
      pdf += `${offset} 00000 n \n`
    }

    pdf += `trailer\n<< /Size ${objId} /Root ${catalogId} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`

    return Buffer.from(pdf)
  }
}

// Instantiate and generate PDF
const pdf = new SimplePDF()

// ==========================================
// PAGE 1: TITLE PAGE
// ==========================================
pdf.addPage()
// Border
pdf.rect(30, 30, 535, 780, [0.06, 0.09, 0.16], [0.97, 0.98, 0.99])
pdf.rect(45, 755, 175, 26, null, [0.06, 0.09, 0.16])
pdf.text('INTERNSHIP PROJECT REPORT', 55, 764, { font: 'F2', size: 9, color: [0.65, 0.95, 0.36] })

pdf.text('Student Management System', 50, 680, { font: 'F2', size: 28, color: [0.06, 0.09, 0.16] })
pdf.text('Midnight Campus — Full-Stack Web Application', 50, 650, { font: 'F1', size: 14, color: [0.28, 0.33, 0.41] })
pdf.text('MERN Stack (React 19 + Express 5 + MongoDB Atlas) with JWT Role-Based Access Control', 50, 630, { font: 'F1', size: 10, color: [0.39, 0.45, 0.55] })

// Meta Card
pdf.rect(50, 320, 495, 270, [0.8, 0.83, 0.88], [1, 1, 1])

pdf.text('PROJECT METADATA & SUBMISSION DETAILS', 70, 560, { font: 'F2', size: 11, color: [0.06, 0.09, 0.16] })
pdf.line(70, 548, 525, 548, [0.85, 0.88, 0.92], 1)

pdf.text('Student Name:', 70, 520, { font: 'F2', size: 11, color: [0.39, 0.45, 0.55] })
pdf.text('Areeha Arif', 230, 520, { font: 'F2', size: 13, color: [0.09, 0.5, 0.24] })

pdf.text('Internship Domain:', 70, 485, { font: 'F2', size: 11, color: [0.39, 0.45, 0.55] })
pdf.text('Web Development', 230, 485, { font: 'F2', size: 12, color: [0.06, 0.09, 0.16] })

pdf.text('Task Number:', 70, 450, { font: 'F2', size: 11, color: [0.39, 0.45, 0.55] })
pdf.text('Task 03', 230, 450, { font: 'F2', size: 12, color: [0.06, 0.09, 0.16] })

pdf.text('Academic Session:', 70, 415, { font: 'F2', size: 11, color: [0.39, 0.45, 0.55] })
pdf.text('2026 / 2027', 230, 415, { font: 'F1', size: 11, color: [0.06, 0.09, 0.16] })

pdf.text('Technology Stack:', 70, 380, { font: 'F2', size: 11, color: [0.39, 0.45, 0.55] })
pdf.text('React 19, Vite 8, Express 5, Node.js, MongoDB Atlas', 230, 380, { font: 'F1', size: 10.5, color: [0.06, 0.09, 0.16] })

pdf.text('Status:', 70, 345, { font: 'F2', size: 11, color: [0.39, 0.45, 0.55] })
pdf.text('Completed & Fully Tested (All Bugs Resolved)', 230, 345, { font: 'F2', size: 11, color: [0.09, 0.5, 0.24] })

// Footer
pdf.line(50, 70, 545, 70, [0.8, 0.83, 0.88], 1)
pdf.text('Midnight Campus Student Management System — Task 3 Report', 50, 52, { font: 'F1', size: 9, color: [0.39, 0.45, 0.55] })
pdf.text('Author: Areeha Arif', 450, 52, { font: 'F2', size: 9, color: [0.06, 0.09, 0.16] })

// ==========================================
// PAGE 2: OBJECTIVE & TECHNOLOGIES USED
// ==========================================
pdf.addPage()
pdf.text('01. Project Objective', 50, 780, { font: 'F2', size: 16, color: [0.06, 0.09, 0.16] })
pdf.line(50, 770, 545, 770, [0.06, 0.09, 0.16], 1.5)

const objDesc = [
  'The primary objective of Task 3 is to develop, test, debug, and document a robust, production-grade',
  'Student Management System (SMS). The system eliminates manual academic spreadsheets and transient',
  'mock stores by providing permanent cloud database persistence with MongoDB Atlas.',
  '',
  'Core Project Objectives:',
  '  1. Permanent Storage: Store student records persistently in MongoDB with timestamps & validation.',
  '  2. Authentication & Security: Implement JWT authentication, bcrypt hashing, and auto-session recovery.',
  '  3. Role-Based Access Control: Differentiate between Administrator (CRUD) and Student/Viewer (Read-only).',
  '  4. Search, Filters & Pagination: Deliver live multi-field search with department and semester filters.',
  '  5. Defect Resolution: Systematically diagnose and resolve all reported connection and form handling errors.',
]
let y = 745
objDesc.forEach((line) => {
  pdf.text(line, 50, y, { font: line.startsWith('  ') ? 'F1' : line.endsWith(':') ? 'F2' : 'F1', size: 10, color: [0.15, 0.2, 0.28] })
  y -= 16
})

pdf.text('02. Technologies Used', 50, 580, { font: 'F2', size: 16, color: [0.06, 0.09, 0.16] })
pdf.line(50, 570, 545, 570, [0.06, 0.09, 0.16], 1.5)

// Table of Tech
const techRows = [
  ['Category', 'Technology', 'Version', 'Role & Implementation Details'],
  ['Frontend UI', 'React', '19.3.1', 'Component architecture, state hooks, and virtual DOM rendering'],
  ['Build Tool', 'Vite', '8.3.4', 'Fast HMR dev server and client build tool with /api reverse proxy'],
  ['Styling', 'Modern CSS3', 'Custom', 'Midnight Campus dark theme with Grid, Flexbox & CSS variables'],
  ['Backend API', 'Node.js / Express', 'v24 / 5.3', 'RESTful API routing, JSON body parser, and CORS middleware'],
  ['Database', 'MongoDB Atlas', 'Cloud', 'Persistent cloud NoSQL storage for users and student documents'],
  ['ODM Library', 'Mongoose', '9.11.2', 'Schema modeling, data validation, and database queries'],
  ['Security', 'JSON Web Token', '9.0.3', 'Stateless Bearer token authentication and role claims'],
  ['Password Hash', 'Bcrypt.js', '3.0.3', 'Cryptographic irreversible salt-hashing (12 rounds)'],
]

let ty = 540
techRows.forEach((row, idx) => {
  const isHead = idx === 0
  if (isHead) {
    pdf.rect(50, ty - 6, 495, 20, null, [0.06, 0.09, 0.16])
  } else if (idx % 2 === 0) {
    pdf.rect(50, ty - 6, 495, 20, null, [0.96, 0.97, 0.98])
  }
  pdf.line(50, ty - 6, 545, ty - 6, [0.8, 0.83, 0.88], 0.5)

  pdf.text(row[0], 55, ty + 4, { font: isHead ? 'F2' : 'F2', size: 9, color: isHead ? [1, 1, 1] : [0.06, 0.09, 0.16] })
  pdf.text(row[1], 140, ty + 4, { font: isHead ? 'F2' : 'F1', size: 9, color: isHead ? [1, 1, 1] : [0.06, 0.09, 0.16] })
  pdf.text(row[2], 240, ty + 4, { font: isHead ? 'F2' : 'F1', size: 9, color: isHead ? [1, 1, 1] : [0.35, 0.4, 0.48] })
  pdf.text(row[3], 295, ty + 4, { font: isHead ? 'F2' : 'F1', size: 8.5, color: isHead ? [1, 1, 1] : [0.15, 0.2, 0.28] })

  ty -= 22
})

// Page footer
pdf.text('Page 2 | Midnight Campus Documentation', 50, 40, { font: 'F1', size: 8.5, color: [0.5, 0.5, 0.5] })

// ==========================================
// PAGE 3: WEBSITE STRUCTURE & DESIGN APPROACH
// ==========================================
pdf.addPage()
pdf.text('03. Website Structure', 50, 780, { font: 'F2', size: 16, color: [0.06, 0.09, 0.16] })
pdf.line(50, 770, 545, 770, [0.06, 0.09, 0.16], 1.5)

// Structure tree
pdf.rect(50, 520, 495, 230, [0.8, 0.83, 0.88], [0.06, 0.09, 0.16])
const treeLines = [
  'student-management-system/',
  '├── backend/',
  '│   ├── middleware/auth.js      --> JWT verification & adminOnly guard',
  '│   ├── models/Student.js       --> Student schema (name, email, department, semester)',
  '│   ├── models/User.js          --> User schema (name, email, password, role)',
  '│   ├── routes/auth.js          --> /register, /login, /me endpoints',
  '│   ├── routes/students.js      --> GET, POST, PUT, DELETE with pagination & search',
  '│   ├── .env                    --> PORT, MONGODB_URI, JWT_SECRET, ADMIN_SETUP_KEY',
  '│   └── server.js               --> Express bootstrap & MongoDB Atlas connection',
  '├── frontend/',
  '│   ├── src/services/api.js     --> Centralized API client & error handling',
  '│   ├── src/App.jsx             --> Main application component & auth state',
  '│   ├── src/App.css             --> Midnight Campus dark theme & responsive rules',
  '│   └── vite.config.js          --> Vite reverse proxy configuration',
  '└── README.md & PROJECT_DOCUMENTATION.pdf',
]

let treeY = 730
treeLines.forEach((t) => {
  pdf.text(t, 60, treeY, { font: 'F3', size: 8.5, color: t.includes('-->') ? [0.65, 0.95, 0.36] : [0.9, 0.95, 1] })
  treeY -= 14
})

pdf.text('04. Design Approach', 50, 490, { font: 'F2', size: 16, color: [0.06, 0.09, 0.16] })
pdf.line(50, 480, 545, 480, [0.06, 0.09, 0.16], 1.5)

const designNotes = [
  '1. UI/UX Paradigm: The "Midnight Campus" Design System',
  '   - Theme: Deep charcoal-navy canvas (#070e1b) accented with electric lime (#a5f15b) and soft cyan.',
  '   - Layout: Sticky left sidebar navigation, top status bar, hero banner, metrics grid, and directory.',
  '   - Non-Intrusive Feedback: Replaced native alert() dialogs with animated floating toast notifications.',
  '',
  '2. Role-Based Access Control (RBAC) Architecture',
  '   - Administrator: Onboarded using ADMIN_SETUP_KEY. Full CRUD rights (Add, Edit, Delete students).',
  '   - Student / Viewer: Read-only access to browse records, search, filter, and inspect detailed profiles.',
  '',
  '3. Defensive Error Segregation & Data Validation',
  '   - Client-side validation: Checks name length (>=2), email regex, department, and semester (1-8).',
  '   - Centralized API layer: Catches network disconnects separately from application runtime errors.',
]

let dy = 455
designNotes.forEach((dn) => {
  const isHeader = dn.startsWith('1.') || dn.startsWith('2.') || dn.startsWith('3.')
  pdf.text(dn, 50, dy, { font: isHeader ? 'F2' : 'F1', size: isHeader ? 10.5 : 9.5, color: isHeader ? [0.06, 0.09, 0.16] : [0.2, 0.25, 0.35] })
  dy -= 17
})

pdf.text('Page 3 | Midnight Campus Documentation', 50, 40, { font: 'F1', size: 8.5, color: [0.5, 0.5, 0.5] })

// ==========================================
// PAGE 4: WEBSITE FEATURES
// ==========================================
pdf.addPage()
pdf.text('05. Website Features', 50, 780, { font: 'F2', size: 16, color: [0.06, 0.09, 0.16] })
pdf.line(50, 770, 545, 770, [0.06, 0.09, 0.16], 1.5)

const features = [
  ['1. Authentication & Session Persistence', 'Dual-mode card allowing users to Sign In or Register. Stored JWT tokens persist login across page refreshes via GET /api/auth/me.'],
  ['2. Administrator Role Verification', 'Prospective admins provide the system ADMIN_SETUP_KEY during registration, unlocking full database management privileges.'],
  ['3. Add Student Form Validation', 'Interactive modal validating full name (min 2 chars), valid email regex, academic department, and semester (1st-8th) with inline feedback.'],
  ['4. Edit Student Profile (Null-Safe)', 'Pre-populates existing data into form controls and dispatches PUT requests to MongoDB with immediate UI reflection.'],
  ['5. Secure Record Deletion', 'Permanent deletion guarded by confirmation prompts to prevent accidental student record loss.'],
  ['6. Student Profile Details Modal', 'Detailed profile modal displaying formatted Student ID (STU-001), MongoDB document _id, department, semester, and join timestamp.'],
  ['7. Live Search & Multi-Filters', 'Real-time client filtering across name, email, department, and ID, paired with Department and Semester dropdown selectors.'],
  ['8. Synchronized Pagination', 'Page number buttons, previous/next controls, and configurable rows-per-page selector (5, 10, 20, 50).'],
  ['9. Real-Time Campus Dashboard Cards', 'Live summary metrics for Total Students, Active Departments, and Academic Session status.'],
  ['10. Animated Toast Notifications', 'Non-blocking floating toasts (success, error, warning) that automatically dismiss after 4 seconds.'],
]

let fy = 740
features.forEach(([title, desc]) => {
  pdf.rect(50, fy - 22, 495, 34, [0.85, 0.88, 0.92], [0.98, 0.99, 1])
  pdf.text(title, 60, fy + 2, { font: 'F2', size: 10, color: [0.06, 0.09, 0.16] })
  pdf.text(desc, 60, fy - 12, { font: 'F1', size: 8.5, color: [0.28, 0.33, 0.41] })
  fy -= 42
})

pdf.text('Page 4 | Midnight Campus Documentation', 50, 40, { font: 'F1', size: 8.5, color: [0.5, 0.5, 0.5] })

// ==========================================
// PAGE 5: CODE SCREENSHOTS & DEBUGGING LOG
// ==========================================
pdf.addPage()
pdf.text('06. Code Screenshots & Debugging Highlights', 50, 780, { font: 'F2', size: 16, color: [0.06, 0.09, 0.16] })
pdf.line(50, 770, 545, 770, [0.06, 0.09, 0.16], 1.5)

pdf.text('A. Resolution of Backend Connection Error (Centralized api.js)', 50, 750, { font: 'F2', size: 11, color: [0.06, 0.09, 0.16] })
pdf.rect(50, 630, 495, 105, [0.8, 0.83, 0.88], [0.06, 0.09, 0.16])
const code1 = [
  '// frontend/src/services/api.js: Centralized request wrapper',
  'const BASE_URL = window.location.port === "5173" ? "/api" : "http://localhost:5000/api";',
  'async function request(endpoint, options = {}) {',
  '  const token = localStorage.getItem("token");',
  '  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };',
  '  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });',
  '  const data = await res.json();',
  '  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);',
  '  return data;',
  '}',
]
let c1Y = 720
code1.forEach((c) => {
  pdf.text(c, 60, c1Y, { font: 'F3', size: 8, color: c.startsWith('//') ? [0.65, 0.95, 0.36] : [0.95, 0.95, 0.95] })
  c1Y -= 10
})

pdf.text('B. Resolution of Edit Student Null Reference Exception', 50, 600, { font: 'F2', size: 11, color: [0.06, 0.09, 0.16] })
pdf.rect(50, 490, 495, 95, [0.8, 0.83, 0.88], [0.06, 0.09, 0.16])
const code2 = [
  '// In App.jsx: Fixed null dereference when updating student',
  'const isEditing = Boolean(editingStudent);',
  'if (isEditing) {',
  '  const studentId = editingStudent.id || editingStudent._id; // Corrected from selectedStudent.id',
  '  const res = await api.updateStudent(studentId, payload);',
  '  addToast(res.message || "Student updated successfully!", "success");',
  '  setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...mapStudent(res.student) } : s));',
  '}',
]
let c2Y = 570
code2.forEach((c) => {
  pdf.text(c, 60, c2Y, { font: 'F3', size: 8, color: c.startsWith('//') ? [0.65, 0.95, 0.36] : [0.95, 0.95, 0.95] })
  c2Y -= 10
})

pdf.text('C. Role Authorization Middleware Guard (adminOnly)', 50, 460, { font: 'F2', size: 11, color: [0.06, 0.09, 0.16] })
pdf.rect(50, 360, 495, 85, [0.8, 0.83, 0.88], [0.06, 0.09, 0.16])
const code3 = [
  '// backend/middleware/auth.js: Admin role gatekeeper',
  'const adminOnly = (req, res, next) => {',
  '  if (!req.user || req.user.role !== "admin") {',
  '    return res.status(403).json({ message: "Access denied. Administrator privileges required." });',
  '  }',
  '  next();',
  '};',
]
let c3Y = 430
code3.forEach((c) => {
  pdf.text(c, 60, c3Y, { font: 'F3', size: 8, color: c.startsWith('//') ? [0.65, 0.95, 0.36] : [0.95, 0.95, 0.95] })
  c3Y -= 10
})

pdf.text('Page 5 | Midnight Campus Documentation', 50, 40, { font: 'F1', size: 8.5, color: [0.5, 0.5, 0.5] })

// ==========================================
// PAGE 6: DESKTOP & MOBILE SCREENSHOTS
// ==========================================
pdf.addPage()
pdf.text('07. Desktop Screenshots', 50, 780, { font: 'F2', size: 16, color: [0.06, 0.09, 0.16] })
pdf.line(50, 770, 545, 770, [0.06, 0.09, 0.16], 1.5)

// Desktop Mockup 1
pdf.rect(50, 610, 495, 145, [0.75, 0.78, 0.85], [0.97, 0.98, 0.99])
pdf.rect(50, 725, 495, 30, [0.06, 0.09, 0.16], [0.06, 0.09, 0.16])
pdf.text('DESKTOP SCREENSHOT 1: CAMPUS DASHBOARD & METRICS', 60, 737, { font: 'F2', size: 9.5, color: [0.65, 0.95, 0.36] })
pdf.text('[ Desktop Screenshot: Total Students (05), Active Departments (05), Spring 2026 Session ]', 100, 675, { font: 'F2', size: 10, color: [0.2, 0.25, 0.35] })
pdf.text('Illustrates the main metrics cards, sidebar brand, top search bar, and system operational badge.', 100, 655, { font: 'F1', size: 9, color: [0.45, 0.5, 0.58] })

// Desktop Mockup 2
pdf.rect(50, 440, 495, 145, [0.75, 0.78, 0.85], [0.97, 0.98, 0.99])
pdf.rect(50, 555, 495, 30, [0.06, 0.09, 0.16], [0.06, 0.09, 0.16])
pdf.text('DESKTOP SCREENSHOT 2: STUDENT DIRECTORY TABLE & ACTIONS', 60, 567, { font: 'F2', size: 9.5, color: [0.65, 0.95, 0.36] })
pdf.text('[ Desktop Screenshot: Filtered Student Records with View, Edit, and Delete Buttons ]', 110, 505, { font: 'F2', size: 10, color: [0.2, 0.25, 0.35] })
pdf.text('Displays student initial avatars, student IDs, department tags, active semester, and action buttons.', 100, 485, { font: 'F1', size: 9, color: [0.45, 0.5, 0.58] })

pdf.text('08. Mobile Screenshots', 50, 400, { font: 'F2', size: 16, color: [0.06, 0.09, 0.16] })
pdf.line(50, 390, 545, 390, [0.06, 0.09, 0.16], 1.5)

// Mobile Mockup 1 & 2
pdf.rect(50, 180, 235, 190, [0.75, 0.78, 0.85], [0.97, 0.98, 0.99])
pdf.rect(50, 345, 235, 25, [0.06, 0.09, 0.16], [0.06, 0.09, 0.16])
pdf.text('MOBILE VIEW: AUTHENTICATION', 60, 355, { font: 'F2', size: 8, color: [0.65, 0.95, 0.36] })
pdf.text('[ Mobile Login & Register ]', 90, 275, { font: 'F2', size: 10, color: [0.2, 0.25, 0.35] })
pdf.text('Compact layout with tabs', 100, 255, { font: 'F1', size: 8.5, color: [0.45, 0.5, 0.58] })

pdf.rect(310, 180, 235, 190, [0.75, 0.78, 0.85], [0.97, 0.98, 0.99])
pdf.rect(310, 345, 235, 25, [0.06, 0.09, 0.16], [0.06, 0.09, 0.16])
pdf.text('MOBILE VIEW: DIRECTORY', 320, 355, { font: 'F2', size: 8, color: [0.65, 0.95, 0.36] })
pdf.text('[ Mobile Student Directory ]', 350, 275, { font: 'F2', size: 10, color: [0.2, 0.25, 0.35] })
pdf.text('Horizontal scrollable table', 360, 255, { font: 'F1', size: 8.5, color: [0.45, 0.5, 0.58] })

pdf.text('Page 6 | Midnight Campus Documentation', 50, 40, { font: 'F1', size: 8.5, color: [0.5, 0.5, 0.5] })

// ==========================================
// PAGE 7: PROJECT SCREENSHOTS
// ==========================================
pdf.addPage()
pdf.text('09. Project Feature Screenshots', 50, 780, { font: 'F2', size: 16, color: [0.06, 0.09, 0.16] })
pdf.line(50, 770, 545, 770, [0.06, 0.09, 0.16], 1.5)

// Feature 1
pdf.rect(50, 570, 495, 180, [0.75, 0.78, 0.85], [0.97, 0.98, 0.99])
pdf.rect(50, 725, 495, 25, [0.06, 0.09, 0.16], [0.06, 0.09, 0.16])
pdf.text('FEATURE SCREENSHOT 1: ADD & EDIT STUDENT MODAL WITH VALIDATION', 60, 735, { font: 'F2', size: 8.5, color: [0.65, 0.95, 0.36] })
pdf.text('[ Screenshot: Interactive Modal Form for Adding & Updating Students ]', 110, 665, { font: 'F2', size: 10, color: [0.2, 0.25, 0.35] })
pdf.text('Shows full name, email, department dropdown, semester selector, and real-time validation warnings.', 95, 645, { font: 'F1', size: 9, color: [0.45, 0.5, 0.58] })

// Feature 2
pdf.rect(50, 360, 495, 180, [0.75, 0.78, 0.85], [0.97, 0.98, 0.99])
pdf.rect(50, 515, 495, 25, [0.06, 0.09, 0.16], [0.06, 0.09, 0.16])
pdf.text('FEATURE SCREENSHOT 2: COMPREHENSIVE STUDENT PROFILE DETAILS VIEW', 60, 525, { font: 'F2', size: 8.5, color: [0.65, 0.95, 0.36] })
pdf.text('[ Screenshot: Detailed Student Profile Card (Avatar, Student ID, DB ID, Timestamp) ]', 95, 455, { font: 'F2', size: 10, color: [0.2, 0.25, 0.35] })
pdf.text('Displays student initial avatar, system ID (STU-001), MongoDB _id, active status, and join date.', 100, 435, { font: 'F1', size: 9, color: [0.45, 0.5, 0.58] })

// Feature 3
pdf.rect(50, 150, 495, 180, [0.75, 0.78, 0.85], [0.97, 0.98, 0.99])
pdf.rect(50, 305, 495, 25, [0.06, 0.09, 0.16], [0.06, 0.09, 0.16])
pdf.text('FEATURE SCREENSHOT 3: VIEWER MODE READ-ONLY NOTICE & RESTRICTION', 60, 315, { font: 'F2', size: 8.5, color: [0.65, 0.95, 0.36] })
pdf.text('[ Screenshot: Read-Only Access Banner & Disabled Actions for Standard Users ]', 105, 245, { font: 'F2', size: 10, color: [0.2, 0.25, 0.35] })
pdf.text('Illustrates how the UI safely prevents mutations while retaining directory browsing for standard accounts.', 95, 225, { font: 'F1', size: 9, color: [0.45, 0.5, 0.58] })

pdf.text('Page 7 | Midnight Campus Documentation', 50, 40, { font: 'F1', size: 8.5, color: [0.5, 0.5, 0.5] })

// ==========================================
// PAGE 8: CONCLUSION & GITHUB REPO LINK
// ==========================================
pdf.addPage()
pdf.text('10. Conclusion', 50, 780, { font: 'F2', size: 16, color: [0.06, 0.09, 0.16] })
pdf.line(50, 770, 545, 770, [0.06, 0.09, 0.16], 1.5)

const conclusionText = [
  'The Midnight Campus Student Management System successfully fulfills all functional, security,',
  'and architectural criteria specified for Internship Task 3.',
  '',
  'Key Accomplishments:',
  '  • Fully resolved the three major defects (backend connection alert, add failure, and edit null exception).',
  '  • Developed a cohesive, responsive React 19 frontend styled with custom Midnight Campus dark aesthetics.',
  '  • Deployed robust JWT authentication with role authorization and automatic session recovery.',
  '  • Implemented live multi-field search, multi-criteria filtering, and synchronized pagination.',
  '  • Established permanent, resilient cloud storage via MongoDB Atlas.',
  '',
  'The final application represents a scalable, user-centric foundation capable of supporting university academic',
  'operations with high efficiency and data integrity.',
]

let cy = 740
conclusionText.forEach((c) => {
  pdf.text(c, 50, cy, { font: c.startsWith('  •') ? 'F1' : c.endsWith(':') ? 'F2' : 'F1', size: 10, color: [0.15, 0.2, 0.28] })
  cy -= 18
})

pdf.text('11. GitHub Repository Link', 50, 530, { font: 'F2', size: 16, color: [0.06, 0.09, 0.16] })
pdf.line(50, 520, 545, 520, [0.06, 0.09, 0.16], 1.5)

pdf.rect(50, 420, 495, 75, [0.06, 0.09, 0.16], [0.06, 0.09, 0.16])
pdf.text('SOURCE CODE REPOSITORY (PUBLIC):', 65, 470, { font: 'F2', size: 9, color: [0.65, 0.95, 0.36] })
pdf.text('[GitHub Repository Link - To be added]', 65, 445, { font: 'F3', size: 12, color: [1, 1, 1] })

// Signature box
pdf.rect(50, 200, 495, 140, [0.8, 0.83, 0.88], [0.98, 0.99, 1])
pdf.text('SUBMISSION VERIFICATION', 65, 315, { font: 'F2', size: 11, color: [0.06, 0.09, 0.16] })
pdf.line(65, 305, 525, 305, [0.85, 0.88, 0.92], 1)

pdf.text('Student Name:', 65, 280, { font: 'F2', size: 10, color: [0.35, 0.4, 0.48] })
pdf.text('Areeha Arif', 200, 280, { font: 'F2', size: 11, color: [0.06, 0.09, 0.16] })

pdf.text('Internship Domain:', 65, 255, { font: 'F2', size: 10, color: [0.35, 0.4, 0.48] })
pdf.text('Web Development', 200, 255, { font: 'F1', size: 10, color: [0.06, 0.09, 0.16] })

pdf.text('Task Assignment:', 65, 230, { font: 'F2', size: 10, color: [0.35, 0.4, 0.48] })
pdf.text('Task 3 — Student Management System', 200, 230, { font: 'F1', size: 10, color: [0.06, 0.09, 0.16] })

pdf.text('Date of Submission:', 65, 205, { font: 'F2', size: 10, color: [0.35, 0.4, 0.48] })
pdf.text('October 2026', 200, 205, { font: 'F1', size: 10, color: [0.06, 0.09, 0.16] })

pdf.text('Page 8 | Midnight Campus Documentation', 50, 40, { font: 'F1', size: 8.5, color: [0.5, 0.5, 0.5] })

// Write to file
const buffer = pdf.build()
const outputPath = path.resolve(__dirname, '..', 'PROJECT_DOCUMENTATION.pdf')
fs.writeFileSync(outputPath, buffer)
console.log(`Successfully generated PDF report at: ${outputPath} (${buffer.length} bytes)`)
