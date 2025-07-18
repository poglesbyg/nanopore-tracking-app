// Python API Gateway client for nanopore tracking application

export interface NanoporeSample {
  id: string
  sample_name: string
  project_id: string | null
  submitter_name: string
  submitter_email: string
  lab_name: string | null
  sample_type: string
  status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'archived'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  assigned_to: string | null
  library_prep_by: string | null
  submitted_at: string
  created_at: string
  updated_at: string
  created_by: string
  concentration?: number | null
  volume?: number | null
  flow_cell_type?: string | null
  chart_field: string
}

export interface AuthUser {
  id: string
  username: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  organization?: string
  department?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: AuthUser
  expires_in: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class PythonApiClient {
  private baseUrl: string
  private accessToken: string | null = null

  constructor() {
    // Use environment variable or default to localhost
    this.baseUrl = process.env.PYTHON_API_URL || 'http://localhost:8000'
    
    // Try to load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('access_token')
    }
  }

  private async request<T>(
    endpoint: string, 
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Add authorization header if token exists
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    // Add any additional headers from options
    if (options?.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value
        }
      })
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.detail || data.message || 'API Error',
        }
      }

      return {
        success: true,
        data: data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network Error',
      }
    }
  }

  // Authentication methods
  async login(username: string, password: string): Promise<ApiResponse<AuthResponse>> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })

    if (response.success && response.data) {
      this.accessToken = response.data.access_token
      
      // Store token in localStorage if available
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', response.data.access_token)
        localStorage.setItem('refresh_token', response.data.refresh_token)
      }
    }

    return response
  }

  async logout(): Promise<ApiResponse<void>> {
    const response = await this.request<void>('/auth/logout', {
      method: 'POST',
    })

    // Clear tokens regardless of response
    this.accessToken = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }

    return response
  }

  async getCurrentUser(): Promise<ApiResponse<AuthUser>> {
    return this.request<AuthUser>('/auth/me')
  }

  async refreshToken(): Promise<ApiResponse<AuthResponse>> {
    const refreshToken = typeof window !== 'undefined' 
      ? localStorage.getItem('refresh_token') 
      : null

    if (!refreshToken) {
      return {
        success: false,
        error: 'No refresh token available',
      }
    }

    const response = await this.request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (response.success && response.data) {
      this.accessToken = response.data.access_token
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', response.data.access_token)
        localStorage.setItem('refresh_token', response.data.refresh_token)
      }
    }

    return response
  }

  // Sample management methods
  async listSamples(): Promise<ApiResponse<NanoporeSample[]>> {
    return this.request<NanoporeSample[]>('/samples')
  }

  async getSample(id: string): Promise<ApiResponse<NanoporeSample>> {
    return this.request<NanoporeSample>(`/samples/${id}`)
  }

  async createSample(sample: Partial<NanoporeSample>): Promise<ApiResponse<NanoporeSample>> {
    return this.request<NanoporeSample>('/samples', {
      method: 'POST',
      body: JSON.stringify(sample),
    })
  }

  async updateSample(id: string, sample: Partial<NanoporeSample>): Promise<ApiResponse<NanoporeSample>> {
    return this.request<NanoporeSample>(`/samples/${id}`, {
      method: 'PUT',
      body: JSON.stringify(sample),
    })
  }

  async deleteSample(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/samples/${id}`, {
      method: 'DELETE',
    })
  }

  async updateSampleStatus(id: string, status: string): Promise<ApiResponse<NanoporeSample>> {
    return this.request<NanoporeSample>(`/samples/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  async assignSample(id: string, assignedTo: string): Promise<ApiResponse<NanoporeSample>> {
    return this.request<NanoporeSample>(`/samples/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigned_to: assignedTo }),
    })
  }

  // File processing methods
  async uploadFile(file: File): Promise<ApiResponse<{ file_id: string; filename: string }>> {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const headers: HeadersInit = {}
      
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`
      }

      const response = await fetch(`${this.baseUrl}/files/upload`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.detail || data.message || 'Upload failed',
        }
      }

      return {
        success: true,
        data: data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      }
    }
  }

  async processCSV(file: File): Promise<ApiResponse<{ job_id: string; samples: NanoporeSample[] }>> {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const headers: HeadersInit = {}
      
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`
      }

      const response = await fetch(`${this.baseUrl}/submission/process-csv`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.detail || data.message || 'CSV processing failed',
        }
      }

      return {
        success: true,
        data: data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'CSV processing failed',
      }
    }
  }

  async processPDF(file: File): Promise<ApiResponse<{ job_id: string; extracted_data: any }>> {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const headers: Record<string, string> = {}
      
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`
      }

      const response = await fetch(`${this.baseUrl}/ai/process-pdf`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.detail || data.message || 'PDF processing failed',
        }
      }

      return {
        success: true,
        data: data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF processing failed',
      }
    }
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; services: Record<string, string> }>> {
    return this.request<{ status: string; services: Record<string, string> }>('/health')
  }

  // Utility methods
  isAuthenticated(): boolean {
    return this.accessToken !== null
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url
  }

  getBaseUrl(): string {
    return this.baseUrl
  }
}

// Export singleton instance
export const pythonApiClient = new PythonApiClient()

// Export the class for testing
export { PythonApiClient } 