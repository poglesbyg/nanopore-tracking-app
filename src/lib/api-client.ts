// Simple API client for browser use - no tRPC to avoid bundling issues

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

class ApiClient {
  private baseUrl = '/api'

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }

    return response.json()
  }

  // Nanopore samples
  async listSamples(): Promise<NanoporeSample[]> {
    // For now, return mock data to test the UI
    return [
      {
        id: '1',
        sample_name: 'Sample-001',
        project_id: 'PROJ-2024-001',
        submitter_name: 'Dr. Jane Smith',
        submitter_email: 'jane.smith@example.com',
        lab_name: 'Genomics Lab',
        sample_type: 'DNA',
        status: 'prep',
        priority: 'normal',
        assigned_to: 'John Doe',
        library_prep_by: 'Jane Smith',
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-1',
        concentration: 50.5,
        volume: 100,
        flow_cell_type: 'MinION',
        chart_field: 'NANO-001'
      },
      {
        id: '2',
        sample_name: 'Sample-002',
        project_id: 'PROJ-2024-002',
        submitter_name: 'Dr. Bob Johnson',
        submitter_email: 'bob.johnson@example.com',
        lab_name: 'Research Lab',
        sample_type: 'RNA',
        status: 'sequencing',
        priority: 'high',
        assigned_to: 'Jane Smith',
        library_prep_by: 'John Doe',
        submitted_at: new Date(Date.now() - 86400000).toISOString(),
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user-2',
        concentration: 75.2,
        volume: 150,
        flow_cell_type: 'GridION',
        chart_field: 'HTSF-002'
      }
    ]
  }

  async createSample(data: any): Promise<NanoporeSample> {
    // Mock implementation
    return {
      id: Math.random().toString(36).substr(2, 9),
      ...data,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'current-user'
    }
  }

  async updateSample(id: string, data: any): Promise<NanoporeSample> {
    // Mock implementation
    const samples = await this.listSamples()
    const sample = samples.find(s => s.id === id)
    if (!sample) throw new Error('Sample not found')
    
    return {
      ...sample,
      ...data,
      updated_at: new Date().toISOString()
    }
  }

  async exportSamples(params: any): Promise<{ data: string, filename: string, mimeType: string }> {
    // Mock implementation
    return {
      data: 'sample,status\nSample-001,prep\nSample-002,sequencing',
      filename: 'export.csv',
      mimeType: 'text/csv'
    }
  }
}

export const apiClient = new ApiClient() 