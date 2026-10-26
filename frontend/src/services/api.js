// Centralized API client for Midnight Campus Student Management System

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.port === '5173' ? '/api' : 'http://localhost:5000/api')

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`
  const token = localStorage.getItem('token')

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const error = new Error(data.message || `Request failed with status ${response.status}`)
      error.status = response.status
      error.data = data
      throw error
    }

    return data
  } catch (err) {
    if (err.status) {
      throw err
    }
    // Network or connection failure
    const networkError = new Error(
      'Cannot connect to backend server. Please verify the backend is running at http://localhost:5000'
    )
    networkError.isNetwork = true
    throw networkError
  }
}

export const api = {
  // Auth endpoints
  async login(email, password) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  async register(name, email, password, role = 'user', adminKey = '') {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role, adminKey }),
    })
  },

  async getMe() {
    return request('/auth/me')
  },

  // Student endpoints
  async getStudents(params = {}) {
    const query = new URLSearchParams()
    if (params.search) query.append('search', params.search)
    if (params.department) query.append('department', params.department)
    if (params.semester) query.append('semester', params.semester)
    if (params.page) query.append('page', params.page)
    if (params.limit) query.append('limit', params.limit)

    const queryString = query.toString() ? `?${query.toString()}` : ''
    return request(`/students${queryString}`)
  },

  async getStudent(id) {
    return request(`/students/${id}`)
  },

  async addStudent(studentData) {
    return request('/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    })
  },

  async updateStudent(id, studentData) {
    return request(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    })
  },

  async deleteStudent(id) {
    return request(`/students/${id}`, {
      method: 'DELETE',
    })
  },

  async checkHealth() {
    try {
      const res = await fetch(`${BASE_URL.replace(/\/students|\/auth/, '')}/health`)
      return await res.json()
    } catch {
      return { status: 'offline', database: 'disconnected' }
    }
  },
}

export default api
