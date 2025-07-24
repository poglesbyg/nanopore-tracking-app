import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { trpc } from '@/client/trpc'
import type { NanoporeSample } from '@/lib/api-client'
import { TRPCProvider } from '../providers/trpc-provider'
import { 
  Plus,
  TestTube,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

function MinimalDashboardContent() {
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    sampleName: '',
    submitterName: '',
    submitterEmail: '',
    sampleType: 'DNA' as 'DNA' | 'RNA' | 'Protein' | 'Other',
    concentration: '',
    volume: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent'
  })

  // Fetch samples
  const { data: samples = [], isLoading, refetch } = trpc.nanopore.getAll.useQuery()
  
  // Create sample mutation
  const createSampleMutation = trpc.nanopore.create.useMutation({
    onSuccess: () => {
      toast.success('Sample submitted successfully!')
      setShowSubmitForm(false)
      setFormData({
        sampleName: '',
        submitterName: '',
        submitterEmail: '',
        sampleType: 'DNA',
        concentration: '',
        volume: '',
        priority: 'normal'
      })
      refetch()
    },
    onError: (error) => {
      toast.error(`Failed to submit sample: ${error.message}`)
    }
  })

  // Calculate stats
  const stats = {
    total: samples.length,
    submitted: samples.filter((s: NanoporeSample) => s.status === 'submitted').length,
    inProgress: samples.filter((s: NanoporeSample) => ['prep', 'sequencing', 'analysis'].includes(s.status || '')).length,
    completed: samples.filter((s: NanoporeSample) => s.status === 'completed').length
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-yellow-100 text-yellow-800'
      case 'prep': return 'bg-blue-100 text-blue-800'
      case 'sequencing': return 'bg-purple-100 text-purple-800'
      case 'analysis': return 'bg-indigo-100 text-indigo-800'
      case 'completed': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'normal': return 'bg-blue-100 text-blue-800'
      case 'low': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.sampleName || !formData.submitterName || !formData.submitterEmail) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      await createSampleMutation.mutateAsync({
        sampleName: formData.sampleName,
        submitterName: formData.submitterName,
        submitterEmail: formData.submitterEmail,
        sampleType: formData.sampleType,
        concentration: formData.concentration ? parseFloat(formData.concentration) : undefined,
        volume: formData.volume ? parseFloat(formData.volume) : undefined,
        priority: formData.priority,
        chartField: 'HTSF-001' // Default chart field
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <TestTube className="h-8 w-8 text-blue-600" />
          Nanopore Sample Tracking
        </h1>
        <p className="text-gray-600 mt-2">Submit and track your nanopore sequencing samples</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Samples</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Submitted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.submitted}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Submit Button / Form */}
      {!showSubmitForm ? (
        <div className="mb-8">
          <Button onClick={() => setShowSubmitForm(true)} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Submit New Sample
          </Button>
        </div>
      ) : (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Submit New Sample</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sampleName" className="block text-sm font-medium text-gray-700 mb-1">
                    Sample Name *
                  </label>
                  <Input
                    id="sampleName"
                    value={formData.sampleName}
                    onChange={(e) => setFormData({...formData, sampleName: e.target.value})}
                    placeholder="e.g., Sample-001"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="sampleType" className="block text-sm font-medium text-gray-700 mb-1">
                    Sample Type *
                  </label>
                  <select
                    id="sampleType"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.sampleType} 
                    onChange={(e) => setFormData({...formData, sampleType: e.target.value as 'DNA' | 'RNA' | 'Protein' | 'Other'})}
                  >
                    <option value="DNA">DNA</option>
                    <option value="RNA">RNA</option>
                    <option value="Protein">Protein</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="submitterName" className="block text-sm font-medium text-gray-700 mb-1">
                    Submitter Name *
                  </label>
                  <Input
                    id="submitterName"
                    value={formData.submitterName}
                    onChange={(e) => setFormData({...formData, submitterName: e.target.value})}
                    placeholder="Your name"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="submitterEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Submitter Email *
                  </label>
                  <Input
                    id="submitterEmail"
                    type="email"
                    value={formData.submitterEmail}
                    onChange={(e) => setFormData({...formData, submitterEmail: e.target.value})}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="concentration" className="block text-sm font-medium text-gray-700 mb-1">
                    Concentration (ng/μL)
                  </label>
                  <Input
                    id="concentration"
                    type="number"
                    step="0.01"
                    value={formData.concentration}
                    onChange={(e) => setFormData({...formData, concentration: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label htmlFor="volume" className="block text-sm font-medium text-gray-700 mb-1">
                    Volume (μL)
                  </label>
                  <Input
                    id="volume"
                    type="number"
                    step="0.01"
                    value={formData.volume}
                    onChange={(e) => setFormData({...formData, volume: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    id="priority"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.priority} 
                    onChange={(e) => setFormData({...formData, priority: e.target.value as 'low' | 'normal' | 'high' | 'urgent'})}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Sample'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowSubmitForm(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Samples List */}
      <Card>
        <CardHeader>
          <CardTitle>Samples</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading samples...</div>
          ) : samples.length === 0 ? (
            <div className="text-center py-8">
              <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No samples submitted yet</p>
              <Button onClick={() => setShowSubmitForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Submit First Sample
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {samples.map((sample: NanoporeSample) => (
                <div key={sample.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-lg">{sample.sample_name}</h3>
                      <div className="mt-1 space-y-1 text-sm text-gray-600">
                        <p>Submitter: {sample.submitter_name} ({sample.submitter_email})</p>
                        <p>Type: {sample.sample_type} | 
                           {sample.concentration && ` Conc: ${sample.concentration} ng/μL |`}
                           {sample.volume && ` Vol: ${sample.volume} μL`}
                        </p>
                        <p>Submitted: {new Date(sample.submitted_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge className={getStatusColor(sample.status || 'submitted')}>
                        {sample.status || 'submitted'}
                      </Badge>
                      <Badge className={getPriorityColor(sample.priority || 'normal')}>
                        {sample.priority || 'normal'} priority
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function MinimalDashboard() {
  return (
    <TRPCProvider>
      <MinimalDashboardContent />
    </TRPCProvider>
  )
} 