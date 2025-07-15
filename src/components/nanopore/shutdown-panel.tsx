import React, { useState, useEffect } from 'react'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Separator } from '../ui/separator'
import { Progress } from '../ui/progress'
import { Input } from '../ui/input'

interface ShutdownHook {
  name: string
  priority: number
  timeout: number
  required: boolean
}

interface ShutdownStats {
  status: string
  isShuttingDown: boolean
  registeredHooks: number
  elapsedTime: number
}

interface ShutdownData {
  status: string
  isShuttingDown: boolean
  stats: ShutdownStats
  hooks: ShutdownHook[]
  testResults: any
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export default function ShutdownPanel() {
  const [shutdownData, setShutdownData] = useState<ShutdownData>({
    status: 'idle',
    isShuttingDown: false,
    stats: {
      status: 'idle',
      isShuttingDown: false,
      registeredHooks: 0,
      elapsedTime: 0
    },
    hooks: [],
    testResults: null,
    loading: false,
    error: null,
    lastUpdated: null
  })

  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [testInProgress, setTestInProgress] = useState(false)

  // Fetch shutdown data
  const fetchShutdownData = async () => {
    setShutdownData(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const [statusResponse, hooksResponse] = await Promise.all([
        fetch('/api/shutdown?action=status'),
        fetch('/api/shutdown?action=hooks')
      ])

      if (!statusResponse.ok || !hooksResponse.ok) {
        throw new Error(`HTTP error! status: ${statusResponse.status}`)
      }

      const statusData = await statusResponse.json()
      const hooksData = await hooksResponse.json()

      if (statusData.success && hooksData.success) {
        setShutdownData(prev => ({
          ...prev,
          status: statusData.data.status,
          isShuttingDown: statusData.data.isShuttingDown,
          stats: statusData.data.stats,
          hooks: hooksData.data.hooks,
          loading: false,
          lastUpdated: new Date()
        }))
      } else {
        throw new Error(statusData.error || hooksData.error || 'Failed to fetch shutdown data')
      }
    } catch (error) {
      console.error('Error fetching shutdown data:', error)
      setShutdownData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch shutdown data'
      }))
    }
  }

  // Test shutdown hooks
  const testHooks = async () => {
    setTestInProgress(true)
    setShutdownData(prev => ({ ...prev, error: null }))
    
    try {
      const response = await fetch('/api/shutdown?action=test')
      const data = await response.json()
      
      if (data.success) {
        setShutdownData(prev => ({
          ...prev,
          testResults: data.data
        }))
      } else {
        throw new Error(data.error || 'Test failed')
      }
    } catch (error) {
      console.error('Error testing hooks:', error)
      setShutdownData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Test failed'
      }))
    } finally {
      setTestInProgress(false)
    }
  }

  // Initiate graceful shutdown
  const initiateShutdown = async () => {
    if (confirmText !== 'I_UNDERSTAND_THIS_WILL_SHUTDOWN_THE_SERVER') {
      setShutdownData(prev => ({
        ...prev,
        error: 'Please type the exact confirmation text'
      }))
      return
    }

    try {
      const response = await fetch('/api/shutdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'graceful_shutdown',
          confirm: confirmText
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setShowConfirmation(false)
        setConfirmText('')
        // The server will shut down, so we won't be able to update the UI
        alert('Graceful shutdown initiated. The server will terminate after cleanup completes.')
      } else {
        throw new Error(data.error || 'Shutdown failed')
      }
    } catch (error) {
      console.error('Error initiating shutdown:', error)
      setShutdownData(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Shutdown failed'
      }))
    }
  }

  // Auto-refresh status
  useEffect(() => {
    fetchShutdownData()
    
    const interval = setInterval(() => {
      fetchShutdownData()
    }, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [])

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-green-500'
      case 'shutting_down': return 'bg-yellow-500'
      case 'completed': return 'bg-blue-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  // Get hook priority color
  const getPriorityColor = (priority: number) => {
    if (priority < 20) return 'bg-red-500'
    if (priority < 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  // Format elapsed time
  const formatElapsedTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Graceful Shutdown Management</h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchShutdownData}
            disabled={shutdownData.loading}
          >
            {shutdownData.loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button 
            variant="outline" 
            onClick={testHooks}
            disabled={testInProgress || shutdownData.isShuttingDown}
          >
            {testInProgress ? 'Testing...' : 'Test Hooks'}
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => setShowConfirmation(true)}
            disabled={shutdownData.isShuttingDown}
          >
            Initiate Shutdown
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {shutdownData.error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-red-700">
            <strong>Error:</strong> {shutdownData.error}
          </div>
        </Card>
      )}

      {/* Shutdown Status */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Shutdown Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-600">Current Status</div>
            <Badge className={`${getStatusColor(shutdownData.status)} text-white`}>
              {shutdownData.status.toUpperCase()}
            </Badge>
          </div>
          <div>
            <div className="text-sm text-gray-600">Shutdown in Progress</div>
            <Badge variant={shutdownData.isShuttingDown ? 'destructive' : 'secondary'}>
              {shutdownData.isShuttingDown ? 'YES' : 'NO'}
            </Badge>
          </div>
          <div>
            <div className="text-sm text-gray-600">Registered Hooks</div>
            <div className="text-xl font-bold">{shutdownData.stats.registeredHooks}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Elapsed Time</div>
            <div className="text-xl font-bold">
              {shutdownData.stats.elapsedTime > 0 ? formatElapsedTime(shutdownData.stats.elapsedTime) : 'N/A'}
            </div>
          </div>
        </div>
        
        {shutdownData.isShuttingDown && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-2">Shutdown Progress</div>
            <Progress 
              value={Math.min((shutdownData.stats.elapsedTime / 30000) * 100, 100)} 
              className="h-2"
            />
            <div className="text-xs text-gray-500 mt-1">
              Estimated completion: {Math.max(0, 30 - Math.round(shutdownData.stats.elapsedTime / 1000))} seconds
            </div>
          </div>
        )}
      </Card>

      {/* Shutdown Hooks */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Shutdown Hooks</h3>
        <div className="space-y-3">
          {shutdownData.hooks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No shutdown hooks registered.
            </div>
          ) : (
            shutdownData.hooks.map((hook, index) => (
              <div key={hook.name} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-mono text-gray-500">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{hook.name}</div>
                    <div className="text-sm text-gray-600">
                      Priority: {hook.priority} | Timeout: {hook.timeout}ms
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${getPriorityColor(hook.priority)} text-white`}>
                    P{hook.priority}
                  </Badge>
                  <Badge variant={hook.required ? 'destructive' : 'secondary'}>
                    {hook.required ? 'Required' : 'Optional'}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Test Results */}
      {shutdownData.testResults && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-3">Hook Test Results</h3>
          <div className="mb-4">
            <Badge variant={shutdownData.testResults.success ? 'default' : 'destructive'}>
              {shutdownData.testResults.success ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}
            </Badge>
          </div>
          <div className="space-y-2">
            {shutdownData.testResults.results.map((result: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div className="font-medium">{result.name}</div>
                </div>
                <div className="text-sm text-gray-600">
                  {result.success 
                    ? `${result.duration}ms` 
                    : `Failed: ${result.error}`
                  }
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <Card className="p-6 bg-red-50 border-red-200">
          <h3 className="text-lg font-semibold mb-3 text-red-800">
            ⚠️ Confirm Graceful Shutdown
          </h3>
          <div className="space-y-4 text-sm">
            <div className="text-red-700">
              <strong>WARNING:</strong> This action will shut down the server after completing all cleanup procedures.
            </div>
            <div className="text-gray-700">
              <strong>What will happen:</strong>
              <ul className="list-disc ml-5 mt-2">
                <li>All active connections will be gracefully closed</li>
                <li>Database connections will be properly terminated</li>
                <li>Audit logs will be flushed and saved</li>
                <li>Configuration changes will be saved</li>
                <li>The server process will exit cleanly</li>
              </ul>
            </div>
            <div className="text-gray-700">
              <strong>Estimated shutdown time:</strong> 30-60 seconds
            </div>
            <div className="text-red-700">
              <strong>To confirm, type exactly:</strong> <code className="bg-gray-200 px-2 py-1 rounded">I_UNDERSTAND_THIS_WILL_SHUTDOWN_THE_SERVER</code>
            </div>
            <Input
              type="text"
              placeholder="Type confirmation text here..."
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="font-mono"
            />
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={initiateShutdown}
                disabled={confirmText !== 'I_UNDERSTAND_THIS_WILL_SHUTDOWN_THE_SERVER'}
              >
                Confirm Shutdown
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowConfirmation(false)
                  setConfirmText('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Help Information */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Shutdown Process Information</h3>
        <div className="space-y-2 text-sm">
          <div><strong>Graceful Shutdown:</strong> Ensures all resources are properly cleaned up before terminating</div>
          <div><strong>Hook Priority:</strong> Lower numbers execute first (e.g., priority 10 runs before priority 20)</div>
          <div><strong>Required Hooks:</strong> If a required hook fails, the shutdown process will be aborted</div>
          <div><strong>Timeout Handling:</strong> Each hook has a maximum execution time to prevent hanging</div>
          <div><strong>Signal Handling:</strong> The system automatically handles SIGTERM and SIGINT signals</div>
        </div>
      </Card>

      {/* Last Updated */}
      {shutdownData.lastUpdated && (
        <div className="text-sm text-gray-600 text-center">
          Last updated: {shutdownData.lastUpdated.toLocaleString()}
        </div>
      )}
    </div>
  )
} 