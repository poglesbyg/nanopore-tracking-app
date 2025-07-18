// Unified API client that switches between monolithic and Python microservices APIs

import { apiConfig } from './api-config'
import { pythonApiClient, type NanoporeSample as PythonSample } from './python-api-client'
import { apiClient as monolithicApiClient, type NanoporeSample as MonolithicSample } from './api-client'

// Unified interfaces
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

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Unified API client
class UnifiedApiClient {
  private get currentClient() {
    return apiConfig.isUsingPythonApi() ? pythonApiClient : monolithicApiClient
  }

  // Authentication methods (only available for Python API)
  async login(username: string, password: string): Promise<ApiResponse<any>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.login(username, password)
    } else {
      // Monolithic API doesn't have login endpoint in the current implementation
      return {
        success: false,
        error: 'Authentication not supported in monolithic API mode'
      }
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.logout()
    } else {
      return {
        success: false,
        error: 'Logout not supported in monolithic API mode'
      }
    }
  }

  async getCurrentUser(): Promise<ApiResponse<AuthUser>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.getCurrentUser()
    } else {
      return {
        success: false,
        error: 'User info not supported in monolithic API mode'
      }
    }
  }

  // Sample management methods
  async listSamples(): Promise<ApiResponse<NanoporeSample[]>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.listSamples()
    } else {
      try {
        const samples = await monolithicApiClient.listSamples()
        return {
          success: true,
          data: samples
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch samples'
        }
      }
    }
  }

  async getSample(id: string): Promise<ApiResponse<NanoporeSample>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.getSample(id)
    } else {
      try {
        // Monolithic API doesn't have getSample, so we'll get from list
        const samples = await monolithicApiClient.listSamples()
        const sample = samples.find(s => s.id === id)
        if (!sample) {
          return {
            success: false,
            error: 'Sample not found'
          }
        }
        return {
          success: true,
          data: sample
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch sample'
        }
      }
    }
  }

  async createSample(sample: Partial<NanoporeSample>): Promise<ApiResponse<NanoporeSample>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.createSample(sample)
    } else {
      try {
        const newSample = await monolithicApiClient.createSample(sample)
        return {
          success: true,
          data: newSample
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create sample'
        }
      }
    }
  }

  async updateSample(id: string, sample: Partial<NanoporeSample>): Promise<ApiResponse<NanoporeSample>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.updateSample(id, sample)
    } else {
      try {
        const updatedSample = await monolithicApiClient.updateSample(id, sample)
        return {
          success: true,
          data: updatedSample
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update sample'
        }
      }
    }
  }

  async deleteSample(id: string): Promise<ApiResponse<void>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.deleteSample(id)
    } else {
      try {
        await monolithicApiClient.deleteSample(id)
        return {
          success: true
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete sample'
        }
      }
    }
  }

  async updateSampleStatus(id: string, status: string): Promise<ApiResponse<NanoporeSample>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.updateSampleStatus(id, status)
    } else {
      try {
        const updatedSample = await monolithicApiClient.updateSampleStatus(id, status)
        return {
          success: true,
          data: updatedSample
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update sample status'
        }
      }
    }
  }

  async assignSample(id: string, assignedTo: string): Promise<ApiResponse<NanoporeSample>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.assignSample(id, assignedTo)
    } else {
      try {
        // Use updateSample for assignment in monolithic API
        const updatedSample = await monolithicApiClient.updateSample(id, { assigned_to: assignedTo })
        return {
          success: true,
          data: updatedSample
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to assign sample'
        }
      }
    }
  }

  // File processing methods
  async uploadFile(file: File): Promise<ApiResponse<{ file_id: string; filename: string }>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.uploadFile(file)
    } else {
      return {
        success: false,
        error: 'File upload not supported in monolithic API mode'
      }
    }
  }

  async processCSV(file: File): Promise<ApiResponse<{ job_id: string; samples: NanoporeSample[] }>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.processCSV(file)
    } else {
      return {
        success: false,
        error: 'CSV processing not supported in monolithic API mode'
      }
    }
  }

  async processPDF(file: File): Promise<ApiResponse<{ job_id: string; extracted_data: any }>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.processPDF(file)
    } else {
      return {
        success: false,
        error: 'PDF processing not supported in monolithic API mode'
      }
    }
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; services?: Record<string, string> }>> {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.healthCheck()
    } else {
      return {
        success: true,
        data: {
          status: 'healthy',
          services: {
            'monolithic-api': 'running'
          }
        }
      }
    }
  }

  // Utility methods
  isAuthenticated(): boolean {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.isAuthenticated()
    } else {
      // Monolithic API doesn't have authentication state
      return false
    }
  }

  getCurrentApiType(): 'python' | 'monolithic' {
    return apiConfig.isUsingPythonApi() ? 'python' : 'monolithic'
  }

  getCurrentApiUrl(): string {
    if (apiConfig.isUsingPythonApi()) {
      return pythonApiClient.getBaseUrl()
    } else {
      return apiConfig.getCurrentApiUrl()
    }
  }

  // Switch API mode
  switchToPythonApi(): void {
    apiConfig.setUsePythonApi(true)
  }

  switchToMonolithicApi(): void {
    apiConfig.setUsePythonApi(false)
  }

  // Debug information
  getDebugInfo(): Record<string, any> {
    return {
      currentApiType: this.getCurrentApiType(),
      currentApiUrl: this.getCurrentApiUrl(),
      isAuthenticated: this.isAuthenticated(),
      apiConfig: apiConfig.getDebugInfo()
    }
  }
}

// Export singleton instance
export const unifiedApiClient = new UnifiedApiClient()

// Export the class for testing
export { UnifiedApiClient }

// Types are already exported above as interfaces 