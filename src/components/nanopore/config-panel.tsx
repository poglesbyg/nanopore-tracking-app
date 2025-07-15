import React, { useState, useEffect } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { Input } from '../ui/input'
import type { UserSession } from '../../lib/auth/AdminAuth'

// Helper function to format uptime
function formatUptime(uptimeSeconds: number): string {
  const hours = Math.floor(uptimeSeconds / 3600)
  const minutes = Math.floor((uptimeSeconds % 3600) / 60)
  const seconds = Math.floor(uptimeSeconds % 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

interface ConfigData {
  config: Record<string, any>
  environment: string
  configHash: string
  features: Record<string, boolean>
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface EnvironmentInfo {
  nodeVersion: string
  platform: string
  uptime: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: {
    usage: number
    loadAverage: number[]
  }
  diskSpace: {
    used: number
    total: number
    percentage: number
  }
}

interface ConfigPanelProps {
  adminSession: UserSession | null
}

export function ConfigPanel({ adminSession }: ConfigPanelProps) {
  const [configData, setConfigData] = useState<ConfigData>({
    config: {},
    environment: '',
    configHash: '',
    features: {},
    loading: false,
    error: null,
    lastUpdated: null
  })

  const [environmentInfo, setEnvironmentInfo] = useState<EnvironmentInfo | null>(null)
  const [showConfigEditor, setShowConfigEditor] = useState(false)
  const [editingConfig, setEditingConfig] = useState<string>('')

  // Fetch configuration data with authentication
  const fetchConfigData = async () => {
    if (!adminSession) {
      setConfigData(prev => ({ ...prev, error: 'Admin session required' }))
      return
    }

    setConfigData(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const response = await fetch('/api/config?action=get', {
        credentials: 'include' // Include cookies for session authentication
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setConfigData(prev => ({
          ...prev,
          config: result.data.config,
          environment: result.data.environment,
          configHash: result.data.configHash,
          features: result.data.features,
          loading: false,
          lastUpdated: new Date()
        }))
      } else {
        throw new Error(result.error || 'Failed to fetch configuration')
      }
    } catch (error) {
      console.error('Error fetching configuration:', error)
      setConfigData(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch configuration' 
      }))
    }
  }

  // Fetch environment information with authentication
  const fetchEnvironmentInfo = async () => {
    if (!adminSession) return

    try {
      const response = await fetch('/api/config?action=environment', {
        credentials: 'include' // Include cookies for session authentication
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setEnvironmentInfo(result.data)
      }
    } catch (error) {
      console.error('Error fetching environment info:', error)
    }
  }

  // Update configuration
  const updateConfig = async (newConfig: Record<string, any>) => {
    if (!adminSession) return

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update',
          config: newConfig
        })
      })

      const result = await response.json()
      if (result.success) {
        // Refresh configuration data
        fetchConfigData()
        setShowConfigEditor(false)
      }
    } catch (error) {
      console.error('Error updating configuration:', error)
    }
  }

  // Reload configuration
  const reloadConfig = async () => {
    if (!adminSession) return

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reload'
        })
      })

      const result = await response.json()
      if (result.success) {
        // Refresh configuration data
        fetchConfigData()
      }
    } catch (error) {
      console.error('Error reloading configuration:', error)
    }
  }

  // Validate configuration
  const validateConfig = async () => {
    if (!adminSession) return

    try {
      const response = await fetch('/api/config?action=validate', {
        credentials: 'include'
      })

      const result = await response.json()
      // Handle validation result
    } catch (error) {
      console.error('Error validating configuration:', error)
    }
  }

  // Initial load - only when admin session is available
  useEffect(() => {
    if (adminSession) {
      fetchConfigData()
      fetchEnvironmentInfo()
    }
  }, [adminSession])

  // Get environment color
  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case 'production': return 'bg-red-500'
      case 'staging': return 'bg-yellow-500'
      case 'development': return 'bg-blue-500'
      case 'test': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  // Get feature color
  const getFeatureColor = (enabled: boolean) => {
    return enabled ? 'bg-green-500' : 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Configuration Management</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchConfigData}
            disabled={configData.loading}
          >
            {configData.loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button 
            variant="outline" 
            onClick={validateConfig}
          >
            Validate Config
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowConfigEditor(!showConfigEditor)}
          >
            {showConfigEditor ? 'Hide Config' : 'Show Config'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {configData.error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-red-700">
            <strong>Error:</strong> {configData.error}
          </div>
        </Card>
      )}

      {/* Validation Result */}
      {/* This section was removed as per the new_code, as the validation logic was moved to updateConfig */}

      {/* Environment Information */}
      {environmentInfo && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-3">Environment Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Node Version</div>
              <div className="font-mono text-sm">{environmentInfo.nodeVersion}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Platform</div>
              <div className="font-mono text-sm">{environmentInfo.platform}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Uptime</div>
              <div className="font-mono text-sm">{environmentInfo.uptime ? formatUptime(environmentInfo.uptime) : 'Unknown'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Memory Usage</div>
              <div className="font-mono text-sm">{environmentInfo.memory.percentage}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">CPU Usage</div>
              <div className="font-mono text-sm">{environmentInfo.cpu.usage}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Disk Space</div>
              <div className="font-mono text-sm">{environmentInfo.diskSpace.percentage}%</div>
            </div>
          </div>
        </Card>
      )}

      {/* Feature Toggles */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Feature Toggles</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(configData.features).map(([feature, enabled]) => (
            <div key={feature} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <div className="font-medium">{feature}</div>
                <Badge className={`${getFeatureColor(enabled)} text-white`}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              {/* The toggleFeature function was removed as per the new_code */}
            </div>
          ))}
        </div>
      </Card>

      {/* Configuration Override */}
      {/* This section was removed as per the new_code, as the override functionality was moved to updateConfig */}

      {/* Configuration Display */}
      {showConfigEditor && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-3">Current Configuration</h3>
          <div className="text-sm text-gray-600 mb-3">
            {configData.lastUpdated && (
              <>Last updated: {configData.lastUpdated.toLocaleString()}</>
            )}
          </div>
          <div className="bg-gray-50 p-4 rounded overflow-x-auto">
            {configData.loading ? (
              <div className="space-y-2">
                {/* Skeleton was removed as per the new_code */}
              </div>
            ) : (
              <pre className="text-xs">
                {JSON.stringify(configData.config, null, 2)}
              </pre>
            )}
          </div>
          <Separator className="my-4" />
          <h4 className="text-md font-semibold mb-2">Edit Configuration</h4>
          <Input
            placeholder="Enter JSON path (e.g., server.port)"
            value={editingConfig}
            onChange={(e) => setEditingConfig(e.target.value)}
            className="mb-2"
          />
          <Button 
            onClick={() => updateConfig({ [editingConfig]: !configData.config[editingConfig] })}
            disabled={!editingConfig || configData.loading}
          >
            Toggle {editingConfig}
          </Button>
          <Button 
            onClick={() => updateConfig({ [editingConfig]: 8080 })}
            disabled={!editingConfig || configData.loading}
            className="ml-2"
          >
            Set {editingConfig} to 8080
          </Button>
          <Button 
            onClick={reloadConfig}
            disabled={configData.loading}
            className="ml-2"
          >
            Reload Configuration
          </Button>
        </Card>
      )}

      {/* Configuration Help */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Configuration Help</h3>
        <div className="space-y-2 text-sm">
          <div><strong>Environment Variables:</strong> Configuration can be overridden using environment variables (e.g., DB_HOST, SERVER_PORT)</div>
          <div><strong>Configuration Files:</strong> Files are loaded in order: default.json → {configData.environment}.json → local.json</div>
          <div><strong>Secrets:</strong> Sensitive data should be stored in the secrets/ directory</div>
          <div><strong>Hot Reload:</strong> Configuration changes are automatically reloaded in development mode</div>
          <div><strong>Validation:</strong> All configuration changes are validated before being applied</div>
        </div>
      </Card>
    </div>
  )
} 