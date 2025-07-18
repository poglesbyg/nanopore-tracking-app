// API Configuration for switching between monolithic and microservices APIs

export interface ApiConfig {
  usePythonApi: boolean
  pythonApiUrl: string
  monolithicApiUrl: string
  environment: 'development' | 'production' | 'staging'
}

// Default configuration
const defaultConfig: ApiConfig = {
  usePythonApi: process.env.USE_PYTHON_API === 'true' || false,
  pythonApiUrl: process.env.PYTHON_API_URL || 'http://localhost:8000',
  monolithicApiUrl: process.env.MONOLITHIC_API_URL || '/api',
  environment: (process.env.NODE_ENV as any) || 'development',
}

// Configuration manager
class ApiConfigManager {
  private config: ApiConfig = defaultConfig

  constructor() {
    // Load configuration from environment variables
    this.loadFromEnvironment()
  }

  private loadFromEnvironment(): void {
    this.config = {
      usePythonApi: process.env.USE_PYTHON_API === 'true',
      pythonApiUrl: process.env.PYTHON_API_URL || 'http://localhost:8000',
      monolithicApiUrl: process.env.MONOLITHIC_API_URL || '/api',
      environment: (process.env.NODE_ENV as any) || 'development',
    }
  }

  getConfig(): ApiConfig {
    return { ...this.config }
  }

  setUsePythonApi(usePython: boolean): void {
    this.config.usePythonApi = usePython
  }

  setPythonApiUrl(url: string): void {
    this.config.pythonApiUrl = url
  }

  setMonolithicApiUrl(url: string): void {
    this.config.monolithicApiUrl = url
  }

  setEnvironment(env: 'development' | 'production' | 'staging'): void {
    this.config.environment = env
  }

  getCurrentApiUrl(): string {
    return this.config.usePythonApi 
      ? this.config.pythonApiUrl 
      : this.config.monolithicApiUrl
  }

  isUsingPythonApi(): boolean {
    return this.config.usePythonApi
  }

  isUsingMonolithicApi(): boolean {
    return !this.config.usePythonApi
  }

  // Helper method to get API configuration based on environment
  getApiUrlForEnvironment(): string {
    const { environment, usePythonApi } = this.config
    
    if (usePythonApi) {
      switch (environment) {
        case 'production':
          return process.env.PYTHON_API_URL_PROD || 'https://api.nanopore.prod'
        case 'staging':
          return process.env.PYTHON_API_URL_STAGING || 'https://api.nanopore.staging'
        default:
          return process.env.PYTHON_API_URL || 'http://localhost:8000'
      }
    } else {
      switch (environment) {
        case 'production':
          return process.env.MONOLITHIC_API_URL_PROD || '/api'
        case 'staging':
          return process.env.MONOLITHIC_API_URL_STAGING || '/api'
        default:
          return process.env.MONOLITHIC_API_URL || '/api'
      }
    }
  }

  // Debug information
  getDebugInfo(): Record<string, any> {
    return {
      config: this.config,
      currentApiUrl: this.getCurrentApiUrl(),
      environmentApiUrl: this.getApiUrlForEnvironment(),
      environmentVariables: {
        USE_PYTHON_API: process.env.USE_PYTHON_API,
        PYTHON_API_URL: process.env.PYTHON_API_URL,
        MONOLITHIC_API_URL: process.env.MONOLITHIC_API_URL,
        NODE_ENV: process.env.NODE_ENV,
      }
    }
  }
}

// Export singleton instance
export const apiConfig = new ApiConfigManager()

// Export utility functions
export const isUsingPythonApi = () => apiConfig.isUsingPythonApi()
export const isUsingMonolithicApi = () => apiConfig.isUsingMonolithicApi()
export const getCurrentApiUrl = () => apiConfig.getCurrentApiUrl()
export const getApiConfig = () => apiConfig.getConfig()
export const setUsePythonApi = (usePython: boolean) => apiConfig.setUsePythonApi(usePython)

// Export the ApiConfig type (already exported as interface above) 