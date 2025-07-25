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
      // Send multiple set_override requests for each config property
      const updatePromises = Object.entries(newConfig).map(async ([path, value]) => {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            action: 'set_override',
            path: path,
            value: value
          })
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(`Failed to update ${path}: ${result.error}`)
        }
        return result
      })

      // Wait for all updates to complete
      await Promise.all(updatePromises)
      
      // Refresh configuration data
      fetchConfigData()
      setShowConfigEditor(false)
    } catch (error) {
      console.error('Error updating configuration:', error)
      setConfigData(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to update configuration' 
      }))
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
      if (result.success) {
        // Show validation result
        console.log('Configuration validation:', result.data)
      }
    } catch (error) {
      console.error('Error validating configuration:', error)
    }
  }

  // Reset configuration to defaults
  const resetToDefaults = async () => {
    if (!adminSession) return

    if (!confirm('Are you sure you want to reset all configuration to defaults? This action cannot be undone.')) {
      return
    }

    try {
      // First, get the default configuration structure
      const defaultConfig = {
        'features.aiAnalysis': false,
        'features.backupRecovery': true,
        'features.performanceMonitoring': true,
        'features.debugMode': false,
        'database.connectionPoolSize': 10,
        'database.queryTimeout': 30000,
        'server.port': 3001,
        'server.timeout': 30000,
        'logging.level': 'info',
        'logging.enableConsole': true,
        'security.enableRateLimit': true,
        'security.maxRequestsPerMinute': 100
      }

      // Send multiple set_override requests to reset each config property
      const resetPromises = Object.entries(defaultConfig).map(async ([path, value]) => {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            action: 'set_override',
            path: path,
            value: value
          })
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(`Failed to reset ${path}: ${result.error}`)
        }
        return result
      })

      // Wait for all resets to complete
      await Promise.all(resetPromises)
      
      // Refresh configuration data
      fetchConfigData()
      
      setConfigData(prev => ({ 
        ...prev, 
        error: null 
      }))

      alert('Configuration successfully reset to defaults!')
    } catch (error) {
      console.error('Error resetting configuration:', error)
      setConfigData(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to reset configuration to defaults' 
      }))
    }
  }

  // Export configuration to JSON file
  const exportConfig = () => {
    if (!adminSession) return

    try {
      const exportData = {
        environment: configData.environment,
        config: configData.config,
        features: configData.features,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nanopore-config-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      alert('Configuration exported successfully!')
    } catch (error) {
      console.error('Error exporting configuration:', error)
      setConfigData(prev => ({ 
        ...prev, 
        error: 'Failed to export configuration' 
      }))
    }
  }

  // Import configuration from JSON file
  const importConfig = () => {
    if (!adminSession) return

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const importData = JSON.parse(text)

        // Validate imported data structure
        if (!importData.config || !importData.features) {
          throw new Error('Invalid configuration file format')
        }

        if (!confirm(`Import configuration from ${file.name}? This will override current settings.`)) {
          return
        }

        // Apply imported configuration
        const configEntries = Object.entries(importData.config).concat(
          Object.entries(importData.features).map(([key, value]) => [`features.${key}`, value])
        )

        const importPromises = configEntries.map(async ([path, value]) => {
          const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              action: 'set_override',
              path: path,
              value: value
            })
          })

          const result = await response.json()
          if (!result.success) {
            throw new Error(`Failed to import ${path}: ${result.error}`)
          }
          return result
        })

        // Wait for all imports to complete
        await Promise.all(importPromises)
        
        // Refresh configuration data
        fetchConfigData()

        alert('Configuration imported successfully!')
      } catch (error) {
        console.error('Error importing configuration:', error)
        setConfigData(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : 'Failed to import configuration' 
        }))
      }
    }
    input.click()
  }

  // Load data on component mount
  useEffect(() => {
    if (adminSession) {
      fetchConfigData()
      fetchEnvironmentInfo()
    }
  }, [adminSession])

  // Auto-refresh environment info every 30 seconds
  useEffect(() => {
    if (adminSession) {
      const interval = setInterval(fetchEnvironmentInfo, 30000)
      return () => clearInterval(interval)
    }
  }, [adminSession])

  if (!adminSession) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Configuration Panel</h3>
          <p className="text-gray-600">Admin authentication required</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Application Configuration</h3>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchConfigData}
              disabled={configData.loading}
            >
              {configData.loading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={reloadConfig}
            >
              Reload
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={validateConfig}
            >
              Validate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
            >
              Reset Defaults
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportConfig}
            >
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={importConfig}
            >
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfigEditor(!showConfigEditor)}
            >
              Edit
            </Button>
          </div>
        </div>

        {configData.error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
            <p className="text-red-700 text-sm">{configData.error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-600">Environment:</span>
            <div className="font-mono text-sm">{configData.environment || 'Unknown'}</div>
          </div>
          <div>
            <span className="text-sm text-gray-600">Config Hash:</span>
            <div className="font-mono text-sm">{configData.configHash || 'N/A'}</div>
          </div>
          <div>
            <span className="text-sm text-gray-600">Last Updated:</span>
            <div className="font-mono text-sm">
              {configData.lastUpdated ? configData.lastUpdated.toLocaleString() : 'Never'}
            </div>
          </div>
        </div>

        {/* Feature Flags */}
        <Separator className="my-4" />
        <div>
          <h4 className="text-md font-medium mb-2">Feature Flags</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(configData.features).map(([feature, enabled]) => (
              <Badge 
                key={feature} 
                variant={enabled ? "default" : "secondary"}
                className={enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
              >
                {feature}: {enabled ? 'ON' : 'OFF'}
              </Badge>
            ))}
          </div>
        </div>

        {/* Configuration Editor */}
        {showConfigEditor && (
          <div className="mt-4">
            <Separator className="mb-4" />
            <h4 className="text-md font-medium mb-2">Configuration Editor</h4>
            <div className="space-y-2">
              <Input
                placeholder="Enter JSON configuration..."
                value={editingConfig}
                onChange={(e) => setEditingConfig(e.target.value)}
                className="font-mono text-sm"
              />
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  onClick={() => {
                    try {
                      const newConfig = JSON.parse(editingConfig)
                      updateConfig(newConfig)
                    } catch (error) {
                      console.error('Invalid JSON:', error)
                    }
                  }}
                >
                  Apply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfigEditor(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Environment Information */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Environment Information</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEnvironmentInfo}
          >
            Refresh
          </Button>
        </div>

        {environmentInfo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Node Version:</span>
              <div className="font-mono text-sm">{environmentInfo.nodeVersion}</div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Platform:</span>
              <div className="font-mono text-sm">{environmentInfo.platform}</div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Uptime:</span>
              <div className="font-mono text-sm">{formatUptime(environmentInfo.uptime)}</div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Memory Usage:</span>
              <div className="font-mono text-sm">
                {environmentInfo.memory?.percentage ? `${environmentInfo.memory.percentage}%` : 'N/A'}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">CPU Usage:</span>
              <div className="font-mono text-sm">{environmentInfo.cpu?.usage?.toFixed(1) || 'N/A'}%</div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Disk Usage:</span>
              <div className="font-mono text-sm">
                {environmentInfo.diskSpace?.percentage ? `${environmentInfo.diskSpace.percentage}%` : 'N/A'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading environment information...</p>
          </div>
        )}
      </Card>
    </div>
  )
} 