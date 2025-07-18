export interface NanoporeSample {
  id: string
  sampleName: string
  submitterName: string
  submitterEmail: string
  labName: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'failed'
  concentration?: string
  volume?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
  assignedUser?: string
  workflowHistory?: WorkflowStep[]
  chart?: string
}

export interface WorkflowStep {
  id: string
  status: string
  timestamp: Date
  user?: string
  notes?: string
}

export interface ExportParams {
  startDate: Date
  endDate: Date
  format: 'csv' | 'json'
  includeAllUsers: boolean
}

export interface ExportResult {
  data: string
  filename: string
  mimeType: string
}

export interface ProcessingResult {
  success: boolean
  message?: string
  data?: any
}

class MicroserviceClient {
  private baseUrls: Record<string, string>

  constructor() {
    // Get service URLs from environment variables or use defaults
    this.baseUrls = {
      sampleManagement: process.env.SAMPLE_MANAGEMENT_URL || 'http://sample-management:3002',
      submission: process.env.SUBMISSION_SERVICE_URL || 'https://submission-service-dept-barc.apps.cloudapps.unc.edu',
      auth: process.env.AUTH_SERVICE_URL || 'http://authentication:3003',
      fileStorage: process.env.FILE_STORAGE_URL || 'http://file-storage:3004',
      audit: process.env.AUDIT_SERVICE_URL || 'http://audit:3005',
      aiProcessing: process.env.AI_PROCESSING_URL || 'http://ai-processing:3006',
    }
  }

  private async request<T>(service: string, endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrls[service]}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Sample Management Service
  async getSamples(): Promise<NanoporeSample[]> {
    return this.request<NanoporeSample[]>('sampleManagement', '/api/samples')
  }

  async getSample(id: string): Promise<NanoporeSample> {
    return this.request<NanoporeSample>('sampleManagement', `/api/samples/${id}`)
  }

  async createSample(sample: Omit<NanoporeSample, 'id' | 'createdAt' | 'updatedAt'>): Promise<NanoporeSample> {
    return this.request<NanoporeSample>('sampleManagement', '/api/samples', {
      method: 'POST',
      body: JSON.stringify(sample),
    })
  }

  async updateSample(id: string, updates: Partial<NanoporeSample>): Promise<NanoporeSample> {
    return this.request<NanoporeSample>('sampleManagement', `/api/samples/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteSample(id: string): Promise<void> {
    await this.request<void>('sampleManagement', `/api/samples/${id}`, {
      method: 'DELETE',
    })
  }

  async exportSamples(params: ExportParams): Promise<ExportResult> {
    return this.request<ExportResult>('sampleManagement', '/api/samples/export', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  // Submission Service
  async processPDF(file: File): Promise<ProcessingResult> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrls.submission}/api/v1/process-pdf`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`PDF processing failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async isSubmissionServiceAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrls.submission}/api/v1/health`)
      return response.ok
    } catch {
      return false
    }
  }

  // Authentication Service
  async login(credentials: { username: string; password: string }): Promise<{ token: string; user: any }> {
    return this.request<{ token: string; user: any }>('auth', '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  async logout(): Promise<void> {
    await this.request<void>('auth', '/api/auth/logout', {
      method: 'POST',
    })
  }

  async getCurrentUser(): Promise<any> {
    return this.request<any>('auth', '/api/auth/me')
  }

  // File Storage Service
  async uploadFile(file: File): Promise<{ url: string; id: string }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${this.baseUrls.fileStorage}/api/files/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`File upload failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async deleteFile(id: string): Promise<void> {
    await this.request<void>('fileStorage', `/api/files/${id}`, {
      method: 'DELETE',
    })
  }

  // Audit Service
  async getAuditTrail(sampleId?: string): Promise<any[]> {
    const endpoint = sampleId ? `/api/audit?sampleId=${sampleId}` : '/api/audit'
    return this.request<any[]>('audit', endpoint)
  }

  // AI Processing Service
  async processWithAI(data: any): Promise<any> {
    return this.request<any>('aiProcessing', '/api/ai/process', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getAIStatus(): Promise<{ available: boolean; models: string[] }> {
    return this.request<{ available: boolean; models: string[] }>('aiProcessing', '/api/ai/status')
  }
}

export const microserviceClient = new MicroserviceClient()
export default microserviceClient 