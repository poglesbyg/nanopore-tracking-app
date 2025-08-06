import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { X } from 'lucide-react'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated: (projectId?: string) => void
  initialData?: {
    name?: string
    description?: string
    owner_name?: string
    owner_email?: string
    chart_prefix?: string
  }
}

export default function CreateProjectModal({ isOpen, onClose, onProjectCreated, initialData }: CreateProjectModalProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    owner_name: initialData?.owner_name || '',
    owner_email: initialData?.owner_email || '',
    chart_prefix: initialData?.chart_prefix || 'HTSF'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset form when initialData changes
  React.useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        owner_name: initialData.owner_name || '',
        owner_email: initialData.owner_email || '',
        chart_prefix: initialData.chart_prefix || 'HTSF'
      })
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Failed to create project')
      }

      const result = await response.json()
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        owner_name: '',
        owner_email: '',
        chart_prefix: 'HTSF'
      })
      
      onProjectCreated(result.data?.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Create New Project</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., COVID-19 Variant Analysis"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the project"
              />
            </div>

            <div>
              <Label htmlFor="owner_name">Owner Name *</Label>
              <Input
                id="owner_name"
                type="text"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                required
                placeholder="e.g., Dr. Jane Smith"
              />
            </div>

            <div>
              <Label htmlFor="owner_email">Owner Email *</Label>
              <Input
                id="owner_email"
                type="email"
                value={formData.owner_email}
                onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                required
                placeholder="e.g., jane.smith@university.edu"
              />
            </div>

            <div>
              <Label htmlFor="chart_prefix">Chart Prefix</Label>
              <select
                id="chart_prefix"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.chart_prefix}
                onChange={(e) => setFormData({ ...formData, chart_prefix: e.target.value })}
              >
                <option value="HTSF">HTSF - High-Throughput Sequencing Facility</option>
                <option value="NANO">NANO - Nanopore Sequencing</option>
                <option value="SEQ">SEQ - General Sequencing</option>
                <option value="PROJ">PROJ - General Project</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}