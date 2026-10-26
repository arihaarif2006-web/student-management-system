import { useState, useEffect, useCallback } from 'react'
import api from './services/api'
import './App.css'

function formatSemester(value) {
  const number = Number(value)
  if (!number) return value || '1st'
  const suffix = number === 1 ? 'st' : number === 2 ? 'nd' : number === 3 ? 'rd' : 'th'
  return `${number}${suffix}`
}

function extractSemesterNumber(value) {
  if (!value) return '1'
  return String(value).replace(/(st|nd|rd|th)$/i, '')
}

function mapStudent(student, index = 0) {
  if (!student) return null
  const id = student._id || student.id
  const rawSemester = student.semester
  const displaySemester =
    typeof rawSemester === 'number'
      ? formatSemester(rawSemester)
      : String(rawSemester).includes('st') ||
        String(rawSemester).includes('nd') ||
        String(rawSemester).includes('rd') ||
        String(rawSemester).includes('th')
      ? rawSemester
      : formatSemester(rawSemester)

  return {
    ...student,
    id,
    _id: id,
    rawSemester,
    displayId: student.displayId || `STU-${String(index + 1).padStart(3, '0')}`,
    semester: displaySemester,
    createdAt: student.createdAt || new Date().toISOString(),
  }
}

export default function App() {
  // Authentication State
  const [token, setToken] = useState(() => localStorage.getItem('token') || '')
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
      return null
    }
  })
  const [authMode, setAuthMode] = useState('login') // 'login' | 'register'
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')

  // Login Form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register Form
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regRole, setRegRole] = useState('user')
  const [regAdminKey, setRegAdminKey] = useState('')

  // Student Data State
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalDepartments: 0,
    departments: [],
  })

  // Filters & Search
  const [search, setSearch] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')
  const [filterSemester, setFilterSemester] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)

  // Modals & Forms
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [submittingStudent, setSubmittingStudent] = useState(false)

  // Student Form Inputs
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    semester: '1',
  })
  const [formErrors, setFormErrors] = useState({})

  // Toasts
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Verify and refresh user profile on initial load
  useEffect(() => {
    if (!token) return

    api
      .getMe()
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user)
          localStorage.setItem('user', JSON.stringify(data.user))
        }
      })
      .catch((err) => {
        if (err.status === 401) {
          handleLogout()
          addToast('Your session has expired. Please log in again.', 'error')
        }
      })
  }, [token, addToast])

  // Fetch students from backend
  const fetchStudents = useCallback(async () => {
    if (!token) return
    setLoadingStudents(true)

    try {
      const data = await api.getStudents({
        search,
        department: filterDepartment,
        semester: filterSemester,
        page,
        limit,
      })

      const list = (data.students || []).map((s, idx) =>
        mapStudent(s, (page - 1) * limit + idx)
      )

      setStudents(list)
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1)
        setTotalRecords(data.pagination.total || list.length)
      } else {
        setTotalRecords(list.length)
      }

      if (data.stats) {
        setStats({
          totalStudents: data.stats.totalStudents || list.length,
          totalDepartments: data.stats.totalDepartments || 0,
          departments: data.stats.departments || [],
        })
      }
    } catch (err) {
      if (err.status === 401) {
        handleLogout()
        addToast('Session expired. Please log in again.', 'error')
      } else {
        addToast(err.message || 'Could not load students.', 'error')
      }
    } finally {
      setLoadingStudents(false)
    }
  }, [token, search, filterDepartment, filterSemester, page, limit, addToast])

  useEffect(() => {
    if (token) {
      fetchStudents()
    }
  }, [fetchStudents, token])

  // Auth Handlers
  async function handleLogin(e) {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    setAuthLoading(true)

    try {
      const data = await api.login(loginEmail.trim(), loginPassword)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setToken(data.token)
      setCurrentUser(data.user)
      setLoginPassword('')
      addToast(`Welcome back, ${data.user.name}!`, 'success')
    } catch (err) {
      setAuthError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')

    if (regName.trim().length < 2) {
      setAuthError('Please enter a valid full name (at least 2 characters).')
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(regEmail.trim())) {
      setAuthError('Please enter a valid email address.')
      return
    }

    if (regPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.')
      return
    }

    setAuthLoading(true)
    try {
      const data = await api.register(
        regName.trim(),
        regEmail.trim(),
        regPassword,
        regRole,
        regAdminKey.trim()
      )

      if (data.token && data.user) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        setToken(data.token)
        setCurrentUser(data.user)
        addToast(data.message || 'Account created successfully!', 'success')
      } else {
        setAuthSuccess('Account registered successfully! You can now log in.')
        setAuthMode('login')
        setLoginEmail(regEmail)
        setLoginPassword('')
      }
    } catch (err) {
      setAuthError(err.message || 'Registration failed. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken('')
    setCurrentUser(null)
    setStudents([])
    setSelectedStudent(null)
    setEditingStudent(null)
    setShowFormModal(false)
    addToast('You have been logged out.', 'success')
  }

  // Student Form Handlers
  function openAddModal() {
    setEditingStudent(null)
    setFormData({
      name: '',
      email: '',
      department: '',
      semester: '1',
    })
    setFormErrors({})
    setShowFormModal(true)
  }

  function openEditModal(student) {
    setEditingStudent(student)
    setFormData({
      name: student.name,
      email: student.email,
      department: student.department,
      semester: extractSemesterNumber(student.rawSemester || student.semester),
    })
    setFormErrors({})
    setShowFormModal(true)
  }

  function handleInputChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  function validateStudentForm() {
    const errors = {}
    if (!formData.name?.trim() || formData.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters.'
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email?.trim() || !emailPattern.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email address.'
    }

    if (!formData.department?.trim()) {
      errors.department = 'Please select an academic department.'
    }

    const semNum = Number(formData.semester)
    if (!formData.semester || Number.isNaN(semNum) || semNum < 1 || semNum > 8) {
      errors.semester = 'Please select a valid semester (1-8).'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleStudentSubmit(e) {
    e.preventDefault()
    if (!validateStudentForm()) return

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      department: formData.department.trim(),
      semester: Number(formData.semester),
    }

    setSubmittingStudent(true)
    const isEditing = Boolean(editingStudent)

    try {
      if (isEditing) {
        const studentId = editingStudent.id || editingStudent._id
        const res = await api.updateStudent(studentId, payload)
        addToast(res.message || 'Student updated successfully!', 'success')

        const updated = mapStudent(res.student || payload)
        setStudents((prev) =>
          prev.map((s) => (s.id === studentId ? { ...s, ...updated } : s))
        )
      } else {
        const res = await api.addStudent(payload)
        addToast(res.message || 'Student added successfully!', 'success')
        fetchStudents()
      }

      setShowFormModal(false)
      setEditingStudent(null)
      setFormData({ name: '', email: '', department: '', semester: '1' })
    } catch (err) {
      addToast(err.message || `Failed to ${isEditing ? 'update' : 'add'} student.`, 'error')
    } finally {
      setSubmittingStudent(false)
    }
  }

  async function handleDeleteStudent(id, studentName) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete student "${studentName}"?`
    )
    if (!confirmed) return

    try {
      const res = await api.deleteStudent(id)
      addToast(res.message || 'Student deleted successfully!', 'success')
      setStudents((prev) => prev.filter((s) => s.id !== id))
      if (selectedStudent?.id === id) {
        setSelectedStudent(null)
      }
      setTotalRecords((prev) => Math.max(0, prev - 1))
    } catch (err) {
      addToast(err.message || 'Failed to delete student.', 'error')
    }
  }

  const isAdmin = currentUser?.role === 'admin'
  const userInitials = (currentUser?.name || 'User')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Distinct departments for filter dropdown
  const departmentOptions = [
    'Computer Science',
    'Software Engineering',
    'Information Technology',
    'Artificial Intelligence',
    'Cyber Security',
    'Data Science',
  ]

  // Render Auth Screen if not logged in
  if (!token) {
    return (
      <div className="auth-wrapper">
        {/* Toast Container */}
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              <span>{toast.message}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => removeToast(toast.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="auth-card">
          <div className="auth-brand">
            <div className="brand-icon">✦</div>
            <div>
              <span className="auth-brand-badge">MIDNIGHT CAMPUS</span>
              <h1 className="auth-title">
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h1>
            </div>
          </div>

          <p className="auth-subtitle">
            {authMode === 'login'
              ? 'Enter your credentials to access the Student Management Portal.'
              : 'Join Midnight Campus to browse or manage university records.'}
          </p>

          {/* Segmented Auth Tabs */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('login')
                setAuthError('')
                setAuthSuccess('')
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('register')
                setAuthError('')
                setAuthSuccess('')
              }}
            >
              Register
            </button>
          </div>

          {authError && (
            <div className="auth-error-banner" role="alert">
              <span>⚠️</span>
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="auth-success-banner" role="status">
              <span>✅</span>
              <span>{authSuccess}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {authMode === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="login-email">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                className="auth-button"
                disabled={authLoading}
              >
                {authLoading ? (
                  <>
                    <span className="loading-spinner" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  'Sign In to Dashboard →'
                )}
              </button>
            </form>
          ) : (
            /* REGISTER FORM */
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name"
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  required
                  minLength={2}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">Email Address</label>
                <input
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="jane@university.edu"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-password">Password (min 6 characters)</label>
                <input
                  id="reg-password"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Create a secure password"
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label>Account Role</label>
                <div className="auth-role-group">
                  <div
                    className={`role-pill ${regRole === 'user' ? 'active' : ''}`}
                    onClick={() => setRegRole('user')}
                    role="button"
                    tabIndex={0}
                  >
                    👤 Student / Viewer
                  </div>
                  <div
                    className={`role-pill ${regRole === 'admin' ? 'active' : ''}`}
                    onClick={() => setRegRole('admin')}
                    role="button"
                    tabIndex={0}
                  >
                    🛡️ Administrator
                  </div>
                </div>
              </div>

              {regRole === 'admin' && (
                <div className="form-group">
                  <label htmlFor="reg-adminkey">Admin Security Key</label>
                  <input
                    id="reg-adminkey"
                    type="password"
                    value={regAdminKey}
                    onChange={(e) => setRegAdminKey(e.target.value)}
                    placeholder="Enter system admin key"
                  />
                  <small style={{ color: '#8296b5', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                    * Required for Administrator authorization.
                  </small>
                </div>
              )}

              <button
                type="submit"
                className="auth-button"
                disabled={authLoading}
              >
                {authLoading ? (
                  <>
                    <span className="loading-spinner" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  'Complete Registration →'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // Dashboard View
  return (
    <div className="app-shell">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => removeToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✦</div>
          <div>
            <h2>
              Midnight<span>Campus</span>
            </h2>
            <p>STUDENT MANAGEMENT</p>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <nav className="navigation">
          <a href="#dashboard" className="nav-item active">
            <span>▦</span> Dashboard
          </a>

          <a href="#students" className="nav-item">
            <span>♙</span> Students
          </a>

          <a href="#departments" className="nav-item">
            <span>▤</span> Departments
          </a>
        </nav>

        {/* User Profile in Sidebar */}
        <div className="sidebar-profile">
          <div className="admin-avatar">{userInitials}</div>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <strong
              style={{
                display: 'block',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
              }}
            >
              {currentUser?.name || 'Campus Member'}
            </strong>
          </div>
          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content" id="dashboard">
        {/* TOP BAR */}
        <header className="topbar">
          <div className="global-search">
            <span>⌕</span>
            <input
              type="text"
              placeholder="Search by name, email, department, or student ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              aria-label="Search students"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: '#8296b5',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            )}
            <kbd>LIVE</kbd>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="topbar-logout-btn"
              onClick={handleLogout}
              title="Log out"
            >
              Log out
            </button>
            <div className="top-admin">
              <div className="admin-avatar">{userInitials}</div>
              <div>
                <strong>{currentUser?.name || 'User'}</strong>
                <p>
                  <span
                    className={`badge-role ${
                      isAdmin ? 'badge-admin' : 'badge-user'
                    }`}
                  >
                    {isAdmin ? 'Administrator' : 'Student / Viewer'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Viewer Mode Banner */}
        {!isAdmin && (
          <div className="viewer-notice-banner">
            <span>ℹ️</span>
            <span>
              <strong>Viewer Mode:</strong> You are logged in with read-only
              permissions. Switch to an Administrator account to add, edit, or
              delete student records.
            </span>
          </div>
        )}

        {/* HERO / WELCOME BANNER */}
        <section className="page-intro">
          <div className="intro-copy">
            <p className="eyebrow">YOUR CAMPUS, AT A GLANCE</p>
            <h1>
              Student <span>Dashboard.</span>
            </h1>
            <p className="intro-description">
              Welcome back, {currentUser?.name || 'Administrator'}. Here is the
              latest academic status and enrollment directory across your
              campus.
            </p>
            <div className="intro-meta">
              <span className="online-dot" /> SYSTEM OPERATIONAL
              <span className="meta-divider">/</span>
              ACADEMIC SESSION 2026
            </div>
          </div>

          <div className="campus-art">
            <div className="art-glow" />
            <div className="art-content">
              <span className="art-symbol">✳</span>
              <p>LEARN.</p>
              <p>GROW.</p>
              <h2>LEAD.</h2>
              <div className="art-line" />
              <span className="art-caption">THE FUTURE STARTS HERE</span>
            </div>
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
          </div>
        </section>

        {/* STATISTIC CARDS */}
        <section className="stats-grid">
          <article className="stat-card featured-stat">
            <div className="stat-card-top">
              <span className="stat-label">TOTAL STUDENTS</span>
              <span className="stat-icon lime-icon">♙</span>
            </div>
            <h2>
              {String(stats.totalStudents || totalRecords || students.length).padStart(
                2,
                '0'
              )}
            </h2>
            <div className="stat-bottom">
              <span>Registered students</span>
              <span className="stat-trend">↗ LIVE SYNC</span>
            </div>
          </article>

          <article className="stat-card" id="departments">
            <div className="stat-card-top">
              <span className="stat-label">DEPARTMENTS</span>
              <span className="stat-icon blue-icon">▤</span>
            </div>
            <h2>
              {String(
                stats.totalDepartments || departmentOptions.length
              ).padStart(2, '0')}
            </h2>
            <div className="stat-bottom">
              <span>Academic departments</span>
              <span className="stat-symbol blue-text">↗</span>
            </div>
          </article>

          <article className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">CURRENT SEMESTER</span>
              <span className="stat-icon violet-icon">▦</span>
            </div>
            <h2 className="semester-value">Spring</h2>
            <div className="stat-bottom">
              <span>Academic session</span>
              <span className="stat-symbol violet-text">✳</span>
            </div>
            <div className="semester-tag">2026 / 2027</div>
          </article>

          <article className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">DISPLAYED RECORDS</span>
              <span className="stat-icon orange-icon">↗</span>
            </div>
            <h2>{String(students.length).padStart(2, '0')}</h2>
            <div className="stat-bottom">
              <span>Current page count</span>
              <span className="stat-symbol orange-text">✦</span>
            </div>
          </article>
        </section>

        {/* STUDENT DIRECTORY PANEL */}
        <section className="students-panel" id="students">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">CAMPUS DIRECTORY</p>
              <h2>
                All Students<span className="heading-period">.</span>
              </h2>
              <p className="panel-subtitle">
                Manage, monitor, and maintain active university student records.
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                className="add-button"
                onClick={openAddModal}
              >
                <span>+</span> Add Student
              </button>
            )}
          </div>

          {/* TABLE TOOLBAR WITH FILTERS */}
          <div className="table-toolbar">
            <div className="table-search">
              <span>⌕</span>
              <input
                type="text"
                placeholder="Search name, email, department..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                aria-label="Filter student records"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setPage(1)
                  }}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="table-filter-group">
              <select
                className="filter-select"
                value={filterDepartment}
                onChange={(e) => {
                  setFilterDepartment(e.target.value)
                  setPage(1)
                }}
                aria-label="Filter by department"
              >
                <option value="">All Departments</option>
                {departmentOptions.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={filterSemester}
                onChange={(e) => {
                  setFilterSemester(e.target.value)
                  setPage(1)
                }}
                aria-label="Filter by semester"
              >
                <option value="">All Semesters</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={String(s)}>
                    {formatSemester(s)} Semester
                  </option>
                ))}
              </select>

              {(search || filterDepartment || filterSemester) && (
                <button
                  type="button"
                  className="clear-filters-btn"
                  onClick={() => {
                    setSearch('')
                    setFilterDepartment('')
                    setFilterSemester('')
                    setPage(1)
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="record-count">
              TOTAL <strong>{totalRecords}</strong> RECORD
              {totalRecords === 1 ? '' : 'S'}
            </div>
          </div>

          {/* TABLE DATA */}
          <div className="table-wrapper">
            {loadingStudents ? (
              <div className="table-loading-container">
                <div className="loading-spinner" />
                <p>Loading campus records...</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>STUDENT</th>
                    <th>STUDENT ID</th>
                    <th>DEPARTMENT</th>
                    <th>SEMESTER</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {students.map((student, index) => {
                    const initials = (student.name || 'S')
                      .split(' ')
                      .filter(Boolean)
                      .map((word) => word[0])
                      .slice(0, 2)
                      .join('')

                    return (
                      <tr key={student.id || index}>
                        <td>
                          <div className="student-cell">
                            <div
                              className={`student-avatar avatar-${index % 6}`}
                            >
                              {initials}
                            </div>
                            <div className="student-details">
                              <strong>{student.name}</strong>
                              <span>{student.email}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="student-id">
                            {student.displayId ||
                              `STU-${String(student.id).slice(-3).padStart(3, '0')}`}
                          </span>
                        </td>

                        <td>
                          <span className="department-name">
                            {student.department}
                          </span>
                        </td>

                        <td>{student.semester}</td>

                        <td>
                          <span className="status-badge">
                            <span /> Active
                          </span>
                        </td>

                        <td>
                          <div className="action-group">
                            <button
                              type="button"
                              className="view-button"
                              onClick={() => setSelectedStudent(student)}
                              title="View full profile"
                            >
                              View
                            </button>

                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  className="view-button"
                                  onClick={() => openEditModal(student)}
                                  title="Edit student"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  className="delete-button"
                                  title={`Delete ${student.name}`}
                                  aria-label={`Delete ${student.name}`}
                                  onClick={() =>
                                    handleDeleteStudent(student.id, student.name)
                                  }
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {students.length === 0 && (
                    <tr>
                      <td colSpan="6" className="empty-state">
                        <span>⌕</span>
                        <strong>No students found</strong>
                        <p>
                          {search || filterDepartment || filterSemester
                            ? 'No records match your filters. Try adjusting your query.'
                            : 'The directory is currently empty. Add your first student!'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* PAGINATION BAR */}
          <div className="pagination-container">
            <div className="pagination-info">
              Showing{' '}
              <strong>
                {totalRecords > 0 ? (page - 1) * limit + 1 : 0}
              </strong>{' '}
              to{' '}
              <strong>
                {Math.min(page * limit, totalRecords)}
              </strong>{' '}
              of <strong>{totalRecords}</strong> students
            </div>

            <div className="pagination-actions">
              <button
                type="button"
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - page) <= 1
                )
                .map((pageNum, idx, arr) => {
                  const showEllipsisBefore =
                    idx > 0 && pageNum - arr[idx - 1] > 1

                  return (
                    <span key={pageNum} style={{ display: 'inline-flex' }}>
                      {showEllipsisBefore && (
                        <span
                          style={{
                            padding: '6px 8px',
                            color: '#8296b5',
                            fontSize: '12px',
                          }}
                        >
                          ...
                        </span>
                      )}
                      <button
                        type="button"
                        className={`pagination-btn ${
                          pageNum === page ? 'active' : ''
                        }`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    </span>
                  )
                })}

              <button
                type="button"
                className="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>

              <select
                className="pagination-limit-select"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value))
                  setPage(1)
                }}
                aria-label="Rows per page"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>

          <div className="table-footer">
            <span>
              <span className="online-dot" /> ALL RECORDS UP TO DATE
            </span>
            <span>
              STUDENT MANAGEMENT SYSTEM <strong>· 2026</strong>
            </span>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="page-footer">
          <span>
            Midnight Campus <strong>© 2026</strong>
          </span>
          <span>
            BUILT FOR BETTER EDUCATION <span className="footer-star">✳</span>
          </span>
        </footer>
      </main>

      {/* ADD / EDIT STUDENT MODAL */}
      {showFormModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowFormModal(false)}
        >
          <div
            className="student-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">CAMPUS DIRECTORY</p>
                <h2>
                  {editingStudent ? 'Edit Student Record' : 'Add New Student'}
                  <span className="heading-period">.</span>
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setShowFormModal(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleStudentSubmit}>
              <div className="form-group">
                <label htmlFor="student-name">Full Name</label>
                <input
                  id="student-name"
                  type="text"
                  name="name"
                  placeholder="e.g. Alexander Hamilton"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={formErrors.name ? 'input-error' : ''}
                  required
                />
                {formErrors.name && (
                  <span className="field-error">{formErrors.name}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="student-email">Email Address</label>
                <input
                  id="student-email"
                  type="email"
                  name="email"
                  placeholder="student@university.edu"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={formErrors.email ? 'input-error' : ''}
                  required
                />
                {formErrors.email && (
                  <span className="field-error">{formErrors.email}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="student-department">Department</label>
                <select
                  id="student-department"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className={formErrors.department ? 'input-error' : ''}
                  required
                >
                  <option value="">Select academic department</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                {formErrors.department && (
                  <span className="field-error">{formErrors.department}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="student-semester">Semester</label>
                <select
                  id="student-semester"
                  name="semester"
                  value={formData.semester}
                  onChange={handleInputChange}
                  className={formErrors.semester ? 'input-error' : ''}
                  required
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={String(s)}>
                      {formatSemester(s)} Semester
                    </option>
                  ))}
                </select>
                {formErrors.semester && (
                  <span className="field-error">{formErrors.semester}</span>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowFormModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="add-button"
                  disabled={submittingStudent}
                >
                  {submittingStudent ? (
                    <>
                      <span className="loading-spinner" />
                      <span>Saving...</span>
                    </>
                  ) : editingStudent ? (
                    'Update Student'
                  ) : (
                    'Save Student'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT PROFILE DETAILS MODAL */}
      {selectedStudent && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="student-modal details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">STUDENT PROFILE</p>
                <h2>
                  Student Details<span className="heading-period">.</span>
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedStudent(null)}
                aria-label="Close details"
              >
                ×
              </button>
            </div>

            <div className="detail-avatar">
              {(selectedStudent.name || 'S')
                .split(' ')
                .filter(Boolean)
                .map((w) => w[0])
                .slice(0, 2)
                .join('')}
            </div>

            <h3 className="detail-name">{selectedStudent.name}</h3>
            <p className="detail-email">{selectedStudent.email}</p>

            <div className="detail-list">
              <div>
                <span>Student ID</span>
                <strong>
                  {selectedStudent.displayId ||
                    `STU-${String(selectedStudent.id).slice(-3).padStart(3, '0')}`}
                </strong>
              </div>

              <div>
                <span>Department</span>
                <strong>{selectedStudent.department}</strong>
              </div>

              <div>
                <span>Semester</span>
                <strong>{selectedStudent.semester}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong className="detail-active">● Active</strong>
              </div>

              <div>
                <span>Database ID</span>
                <strong style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                  {selectedStudent.id || selectedStudent._id}
                </strong>
              </div>

              <div>
                <span>Registered Date</span>
                <strong>
                  {selectedStudent.createdAt
                    ? new Date(selectedStudent.createdAt).toLocaleDateString(
                        undefined,
                        { year: 'numeric', month: 'short', day: 'numeric' }
                      )
                    : 'Current Term'}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              {isAdmin && (
                <button
                  type="button"
                  className="add-button"
                  style={{ flex: 1 }}
                  onClick={() => {
                    const stu = selectedStudent
                    setSelectedStudent(null)
                    openEditModal(stu)
                  }}
                >
                  Edit Profile
                </button>
              )}
              <button
                type="button"
                className="cancel-button"
                style={{ flex: 1 }}
                onClick={() => setSelectedStudent(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
