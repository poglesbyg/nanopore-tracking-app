import React, { useState, useEffect } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { Input } from '../ui/input'
import { Skeleton } from '../ui/skeleton'

interface ConfigData {
  config: string
  environment: string
  configHash: string
  features: Record<string, boolean>
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface EnvironmentInfo {
  environment: string
  debug: boolean
  version: string
}

export default function ConfigPanel() {
  const [configData, setConfigData] = useState<ConfigData>({
    config: '',
    environment: 'development',
    configHash: '',
    features: {},
    loading: false,
    error: null,
    lastUpdated: null
  })

  const [environmentInfo, setEnvironmentInfo] = useState<EnvironmentInfo>({
    environment: 'development',
    debug: false,
    version: '1.0.0'
  })

  const [overridePath, setOverridePath] = useState('')
  const [overrideValue, setOverrideValue] = useState('')
  const [validationResult, setValidationResult] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)

  // Fetch configuration data
  const fetchConfigData = async () => {
    setConfigData(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const response = await fetch('/api/config?action=get')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        setConfigData(prev => ({
          ...prev,
          config: data.data.config,
          environment: data.data.environment,
          configHash: data.data.configHash,
          features: data.data.features,
          loading: false,
          lastUpdated: new Date()
        }))
      } else {
        throw new Error(data.error || 'Failed to fetch configuration')
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

  // Fetch environment information
  const fetchEnvironmentInfo = async () => {
    try {
      const response = await fetch('/api/config?action=environment')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (data.success) {
        setEnvironmentInfo(data.data)
      }
    } catch (error) {
      console.error('Error fetching environment info:', error)
    }
  }

  // Toggle feature
  const toggleFeature = async (feature: string) => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_feature',
          feature
        })
      })

      const data = await response.json()
      if (data.success) {
        // Update local state
        setConfigData(prev => ({
          ...prev,
          features: {
            ...prev.features,
            [feature]: data.data.enabled
          }
        }))
      } else {
        throw new Error(data.error || 'Failed to toggle feature')
      }
    } catch (error) {
      console.error('Error toggling feature:', error)
      setConfigData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to toggle feature'
      }))
    }
  }

  // Set configuration override
  const setOverride = async () => {
    if (!overridePath || !overrideValue) {
      setConfigData(prev => ({ ...prev, error: 'Path and value are required' }))
      return
    }

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_override',
          path: overridePath,
          value: overrideValue
        })
      })

      const data = await response.json()
      if (data.success) {
        setOverridePath('')
        setOverrideValue('')
        await fetchConfigData() // Refresh configuration
      } else {
        throw new Error(data.error || 'Failed to set override')
      }
    } catch (error) {
      console.error('Error setting override:', error)
      setConfigData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to set override'
      }))
    }
  }

  // Validate configuration
  const validateConfig = async () => {
    setValidationResult(null)
    
    try {
      const response = await fetch('/api/config?action=validate')
      const data = await response.json()
      
      if (data.success) {
        setValidationResult('✅ Configuration validation passed')
      } else {
        setValidationResult(`❌ Validation failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Error validating configuration:', error)
      setValidationResult(`❌ Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Initial load
  useEffect(() => {
    fetchConfigData()
    fetchEnvironmentInfo()
  }, [])

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
            onClick={() => setShowConfig(!showConfig)}
          >
            {showConfig ? 'Hide Config' : 'Show Config'}
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
      {validationResult && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="text-blue-700">
            {validationResult}
          </div>
        </Card>
      )}

      {/* Environment Information */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Environment Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Environment</div>
            <Badge className={`${getEnvironmentColor(environmentInfo.environment)} text-white`}>
              {environmentInfo.environment}
            </Badge>
          </div>
          <div>
            <div className="text-sm text-gray-600">Debug Mode</div>
            <Badge variant={environmentInfo.debug ? 'default' : 'secondary'}>
              {environmentInfo.debug ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <div>
            <div className="text-sm text-gray-600">Version</div>
            <div className="font-mono text-sm">{environmentInfo.version}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Config Hash</div>
            <div className="font-mono text-xs">{configData.configHash.substring(0, 12)}...</div>
          </div>
        </div>
      </Card>

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
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleFeature(feature)}
                disabled={configData.loading}
              >
                Toggle
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Configuration Override */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Configuration Override</h3>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Set runtime configuration overrides. Use dot notation for nested properties (e.g., "server.port", "features.pdfProcessing").
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Configuration Path</label>
              <Input
                placeholder="e.g., server.port"
                value={overridePath}
                onChange={(e) => setOverridePath(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Value</label>
              <Input
                placeholder="e.g., 8080"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
              />
            </div>
          </div>
          <Button 
            onClick={setOverride}
            disabled={!overridePath || !overrideValue}
          >
            Set Override
          </Button>
        </div>
      </Card>

      {/* Configuration Display */}
      {showConfig && (
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
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <pre className="text-xs">
                {configData.config}
              </pre>
            )}
          </div>
        </Card>
      )}

      {/* Configuration Help */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Configuration Help</h3>
        <div className="space-y-2 text-sm">
          <div><strong>Environment Variables:</strong> Configuration can be overridden using environment variables (e.g., DB_HOST, SERVER_PORT)</div>
          <div><strong>Configuration Files:</strong> Files are loaded in order: default.json → {environmentInfo.environment}.json → local.json</div>
          <div><strong>Secrets:</strong> Sensitive data should be stored in the secrets/ directory</div>
          <div><strong>Hot Reload:</strong> Configuration changes are automatically reloaded in development mode</div>
          <div><strong>Validation:</strong> All configuration changes are validated before being applied</div>
        </div>
      </Card>
    </div>
  )
} 