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
    // Detect if we're running in local development vs production
    const isLocalDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    const isProduction = typeof window !== 'undefined' && window.location.protocol === 'https:' && !isLocalDev
    
    this.baseUrls = {
      sampleManagement: process.env.SAMPLE_MANAGEMENT_URL || 
        (isLocalDev ? 'http://localhost:3002' : 
         isProduction ? 'https://nanopore-api-dept-barc.apps.cloudapps.unc.edu' : 'http://python-gateway:8000'),
      submission: process.env.SUBMISSION_SERVICE_URL || 
        (isLocalDev ? 'http://localhost:8000' : 'https://submission-service-dept-barc.apps.cloudapps.unc.edu'),
      auth: process.env.AUTH_SERVICE_URL || 
        (isLocalDev ? 'http://localhost:3002' :
         isProduction ? 'https://nanopore-api-dept-barc.apps.cloudapps.unc.edu' : 'http://python-gateway:8000'),
      fileStorage: process.env.FILE_STORAGE_URL || 
        (isLocalDev ? 'http://localhost:3002' :
         isProduction ? 'https://nanopore-api-dept-barc.apps.cloudapps.unc.edu' : 'http://python-gateway:8000'),
      audit: process.env.AUDIT_SERVICE_URL || 
        (isLocalDev ? 'http://localhost:3002' :
         isProduction ? 'https://nanopore-api-dept-barc.apps.cloudapps.unc.edu' : 'http://python-gateway:8000'),
      aiProcessing: process.env.AI_PROCESSING_URL || 
        (isLocalDev ? 'http://localhost:3002' :
         isProduction ? 'https://ai-service-optimized-route-dept-barc.apps.cloudapps.unc.edu' : 'http://python-gateway:8000'),
    }
  }

  private async request<T>(service: string, endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrls[service]}${endpoint}`
    
    console.log(`Making request to: ${url}`)
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      console.error(`Request failed: ${response.status} ${response.statusText}`)
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // Sample Management Service
  async getSamples(): Promise<NanoporeSample[]> {
    try {
      const response = await this.request<any[]>('sampleManagement', '/api/v1/samples')
      
      // Transform API response to match NanoporeSample interface
      return response.map(sample => {
        // Convert numeric priority to string priority
        let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
        if (typeof sample.priority === 'number') {
          if (sample.priority === 1) priority = 'urgent'
          else if (sample.priority === 2) priority = 'high'
          else if (sample.priority === 3) priority = 'medium'
          else priority = 'low'
        } else if (typeof sample.priority === 'string') {
          priority = sample.priority as 'low' | 'medium' | 'high' | 'urgent'
        }

        return {
          id: sample.id?.toString() || '',
          sampleName: sample.name || sample.sampleName || '',
          submitterName: sample.submitter_name || sample.submitterName || '',
          submitterEmail: sample.submitter_email || sample.submitterEmail || '',
          labName: sample.project_id || sample.labName || '',
          priority,
          status: sample.status || 'submitted',
          concentration: sample.concentration,
          volume: sample.volume,
          notes: sample.notes,
          createdAt: sample.created_at ? new Date(sample.created_at) : new Date(),
          updatedAt: sample.updated_at ? new Date(sample.updated_at) : new Date(),
          assignedUser: sample.assigned_user || sample.assignedUser,
          workflowHistory: sample.workflow_history || sample.workflowHistory,
          chart: sample.chart
        }
      })
    } catch (error) {
      console.error('Error fetching samples:', error)
      throw error
    }
  }

  async getSample(id: string): Promise<NanoporeSample> {
    return this.request<NanoporeSample>('sampleManagement', `/api/v1/samples/${id}`)
  }

  async createSample(sample: Omit<NanoporeSample, 'id' | 'createdAt' | 'updatedAt'>): Promise<NanoporeSample> {
    return this.request<NanoporeSample>('sampleManagement', '/api/v1/samples', {
      method: 'POST',
      body: JSON.stringify(sample),
    })
  }

  async updateSample(id: string, updates: Partial<NanoporeSample>): Promise<NanoporeSample> {
    return this.request<NanoporeSample>('sampleManagement', `/api/v1/samples/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteSample(id: string): Promise<void> {
    await this.request<void>('sampleManagement', `/api/v1/samples/${id}`, {
      method: 'DELETE',
    })
  }

  async exportSamples(params: ExportParams): Promise<ExportResult> {
    return this.request<ExportResult>('sampleManagement', '/api/v1/samples/export', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  // Submission Service
  async processPDF(file: File): Promise<ProcessingResult> {
    try {
      console.log('Starting PDF processing for file:', file.name)
      const formData = new FormData()
      formData.append('file', file)

      const url = `${this.baseUrls.submission}/api/v1/process-pdf`
      console.log('Making PDF processing request to:', url)

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      })

      console.log('PDF processing response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('PDF processing error response:', errorText)
        throw new Error(`PDF processing failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('PDF processing result:', result)
      
      // Transform the response to match the expected ProcessingResult interface
      const transformedResult: ProcessingResult = {
        success: result.status === 'completed',
        message: result.message,
        data: result.data
      }
      
      return transformedResult
    } catch (error) {
      console.error('PDF processing error:', error)
      throw error
    }
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
    return this.request<{ token: string; user: any }>('auth', '/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  async logout(): Promise<void> {
    await this.request<void>('auth', '/api/v1/auth/logout', {
      method: 'POST',
    })
  }

  async getCurrentUser(): Promise<any> {
    return this.request<any>('auth', '/api/v1/auth/session')
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