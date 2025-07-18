import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { 
  Plus, 
  Search, 
  Download, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  User,
  TestTube,
  Zap,
  TrendingUp,
  Activity,
  Calendar,
  Settings,
  LogOut,
  ChevronDown,
  Archive,
  Trash2,
  X,
  Users,
  Edit
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { microserviceClient, type NanoporeSample } from '@/lib/microservice-client'
import PDFUpload from './pdf-upload'
import { ExportModal } from './export-modal'

interface DashboardStats {
  total: number
  submitted: number
  inProgress: number
  completed: number
  urgent: number
}

const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    submitted: { color: 'bg-blue-100 text-blue-800', icon: Clock },
    prep: { color: 'bg-yellow-100 text-yellow-800', icon: TestTube },
    sequencing: { color: 'bg-purple-100 text-purple-800', icon: Zap },
    analysis: { color: 'bg-orange-100 text-orange-800', icon: Activity },
    completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    failed: { color: 'bg-red-100 text-red-800', icon: AlertCircle },
  }

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.submitted
  const Icon = config.icon

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  )
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  const priorityConfig = {
    low: { color: 'bg-gray-100 text-gray-800', icon: TrendingUp },
    medium: { color: 'bg-blue-100 text-blue-800', icon: TrendingUp },
    high: { color: 'bg-orange-100 text-orange-800', icon: TrendingUp },
    urgent: { color: 'bg-red-100 text-red-800', icon: AlertCircle },
  }

  const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.low
  const Icon = config.icon

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {priority}
    </Badge>
  )
}

export default function NanoporeDashboard() {
  const [samples, setSamples] = useState<NanoporeSample[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSample, setEditingSample] = useState<NanoporeSample | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedSample, setSelectedSample] = useState<NanoporeSample | null>(null)
  
  // Stats
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    submitted: 0,
    inProgress: 0,
    completed: 0,
    urgent: 0
  })

  // Load samples
  useEffect(() => {
    loadSamples()
  }, [])

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout reached, forcing loading to false')
        setLoading(false)
      }
    }, 10000) // 10 second timeout

    return () => clearTimeout(timeout)
  }, [loading])

  const loadSamples = async () => {
    try {
      console.log('Starting to load samples...')
      setLoading(true)
      const data = await microserviceClient.getSamples()
      console.log('Samples loaded:', data)
      setSamples(data)
      updateStats(data)
    } catch (error) {
      console.error('Failed to load samples:', error)
      toast.error('Failed to load samples')
      // Set mock samples on error so the UI still renders
      const mockSamples: NanoporeSample[] = [
        {
          id: '1',
          sampleName: 'Sample-001',
          submitterName: 'John Doe',
          submitterEmail: 'john.doe@example.com',
          labName: 'Lab A',
          priority: 'urgent',
          status: 'sequencing',
          concentration: '10 ng/μL',
          volume: '50 μL',
          notes: 'Mock sample data (API unavailable)',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          sampleName: 'Sample-002',
          submitterName: 'Jane Smith',
          submitterEmail: 'jane.smith@example.com',
          labName: 'Lab B',
          priority: 'high',
          status: 'completed',
          concentration: '15 ng/μL',
          volume: '30 μL',
          notes: 'Mock sample data (API unavailable)',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
      setSamples(mockSamples)
      updateStats(mockSamples)
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
    }
  }

  const updateStats = (samples: NanoporeSample[]) => {
    const stats = {
      total: samples.length,
      submitted: samples.filter(s => s.status === 'submitted').length,
      inProgress: samples.filter(s => ['prep', 'sequencing', 'analysis'].includes(s.status)).length,
      completed: samples.filter(s => s.status === 'completed').length,
      urgent: samples.filter(s => s.priority === 'urgent').length
    }
    setStats(stats)
  }

  const filteredSamples = samples.filter(sample => {
    const matchesSearch = (sample.sampleName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (sample.submitterName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (sample.labName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || sample.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || sample.priority === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  const handleCreateSample = async (sampleData: Omit<NanoporeSample, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await microserviceClient.createSample(sampleData)
      await loadSamples()
      setShowCreateModal(false)
      toast.success('Sample created successfully')
    } catch (error) {
      console.error('Failed to create sample:', error)
      toast.error('Failed to create sample')
    }
  }

  const handleUpdateSample = async (id: string, updates: Partial<NanoporeSample>) => {
    try {
      await microserviceClient.updateSample(id, updates)
      await loadSamples()
      toast.success('Sample updated successfully')
    } catch (error) {
      console.error('Failed to update sample:', error)
      toast.error('Failed to update sample')
    }
  }

  const handleDeleteSample = async (id: string) => {
    try {
      await microserviceClient.deleteSample(id)
      await loadSamples()
      toast.success('Sample deleted successfully')
    } catch (error) {
      console.error('Failed to delete sample:', error)
      toast.error('Failed to delete sample')
    }
  }

  const handleEditSample = (sample: NanoporeSample) => {
    setEditingSample(sample)
    setShowEditModal(true)
  }

  const handleSaveEditSample = async (sampleData: Omit<NanoporeSample, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editingSample) return
    
    try {
      await handleUpdateSample(editingSample.id, sampleData)
      setShowEditModal(false)
      setEditingSample(null)
    } catch (error) {
      console.error('Failed to save sample changes:', error)
      toast.error('Failed to save sample changes')
    }
  }

  const handlePDFDataExtracted = async (data: any, file: File) => {
    try {
      console.log('PDF data extracted:', data)
      
      // Extract the first item from the data array if it's an array
      const extractedData = Array.isArray(data) ? data[0] : data
      console.log('Extracted data item:', extractedData)
      
      // Extract comprehensive information from the PDF
      const quoteId = extractedData.quote_identifier || extractedData.identifier || 'Unknown'
      const requesterName = extractedData.requester || extractedData.submitter_name || extractedData.submitterName || 'Unknown'
      const requesterEmail = extractedData.email || extractedData.submitter_email || extractedData.submitterEmail || ''
      const labName = extractedData.lab || extractedData.lab_name || extractedData.labName || 'Unknown Lab'
      const organism = extractedData.organism || extractedData.source_organism || 'Unknown'
      const buffer = extractedData.buffer || extractedData.sample_buffer || 'Unknown'
      const sampleType = extractedData.sample_type || extractedData.type_of_sample || 'Unknown'
      const flowCellType = extractedData.flow_cell || extractedData.flow_cell_type || 'Unknown'
      const genomeSize = extractedData.genome_size || extractedData.approx_genome_size || 'Unknown'
      const coverage = extractedData.coverage || extractedData.approx_coverage || 'Unknown'
      const cost = extractedData.cost || extractedData.projected_cost || 'Unknown'
      const basecalling = extractedData.basecalling || extractedData.basecalling_method || 'Unknown'
      const fileFormat = extractedData.file_format || 'Unknown'
      
      // Extract additional comprehensive fields
      const piName = extractedData.pi_name || extractedData.pi || 'Unknown'
      const department = extractedData.department || 'Unknown'
      const institution = extractedData.institution || 'Unknown'
      const projectDescription = extractedData.project_description || 'Unknown'
      const dataDelivery = extractedData.data_delivery || 'Unknown'
      const billingAccount = extractedData.billing_account || 'Unknown'
      const specialInstructions = extractedData.special_instructions || 'None'
      const expectedYield = extractedData.expected_yield || 'Unknown'
      const libraryPrep = extractedData.library_prep || 'Unknown'
      const multiplexing = extractedData.multiplexing || 'Unknown'
      const phone = extractedData.phone || 'Unknown'
      const serviceRequested = extractedData.service_requested || 'Unknown'
      
      // Extract sample table information if available
      const sampleTable = extractedData.sample_table || extractedData.samples || []
      const sampleCount = Array.isArray(sampleTable) ? sampleTable.length : 0
      
      // Create comprehensive notes with all extracted information
      const detailedNotes = `
Extracted from: ${file.name}

=== QUOTE INFORMATION ===
Quote ID: ${quoteId}
Requester: ${requesterName}
Email: ${requesterEmail}
Phone: ${phone}
Lab: ${labName}
PI: ${piName}
Department: ${department}
Institution: ${institution}

=== PROJECT DETAILS ===
Project Description: ${projectDescription}
Service Requested: ${serviceRequested}
Sample Type: ${sampleType}
Source Organism: ${organism}
Sample Buffer: ${buffer}

=== SEQUENCING SPECIFICATIONS ===
Flow Cell: ${flowCellType}
Genome Size: ${genomeSize}
Coverage: ${coverage}
Library Prep: ${libraryPrep}
Multiplexing: ${multiplexing}
Basecalling: ${basecalling}
File Format: ${fileFormat}
Expected Yield: ${expectedYield}

=== LOGISTICS ===
Cost: ${cost}
Billing Account: ${billingAccount}
Data Delivery: ${dataDelivery}
Special Instructions: ${specialInstructions}

=== SAMPLE INFORMATION ===
Sample Count: ${sampleCount}
${sampleCount > 0 ? `\nSample Details:\n${sampleTable.slice(0, 10).map((s: any, i: number) => 
  `${i + 1}. ${s.sample_name || s.name || `Sample ${i + 1}`}: ${s.volume || 'N/A'}µL, ${s.concentration || s.qubit_conc || 'N/A'}ng/µL${s.nanodrop_conc ? `, NanoDrop: ${s.nanodrop_conc}ng/µL` : ''}`
).join('\n')}${sampleCount > 10 ? `\n... and ${sampleCount - 10} more samples` : ''}` : 'No sample table found'}
      `.trim()
      
      // Map sample type to standard values
      const mappedSampleType = sampleType.toLowerCase().includes('dna') ? 'DNA' : 
                              sampleType.toLowerCase().includes('rna') ? 'RNA' : 
                              sampleType.toLowerCase().includes('amplicon') ? 'DNA' : 
                              sampleType.toLowerCase().includes('plasmid') ? 'DNA' : 'Other'
      
      // Map flow cell type to standard values
      const mappedFlowCellType = flowCellType.includes('R9.4.1') ? 'R9.4.1' :
                                flowCellType.includes('R10.4.1') ? 'R10.4.1' :
                                flowCellType.includes('R10.5.1') ? 'R10.5.1' : 'Other'
      
      // Generate chart field from quote ID if available
      const chartField = quoteId.includes('HTSF') ? quoteId.split('--')[0] : 'HTSF-001'
      
      const sampleData = {
        sampleName: quoteId || file.name.replace('.pdf', ''),
        submitterName: requesterName,
        submitterEmail: requesterEmail,
        labName: labName,
        priority: 'high' as const, // Set to high since this is a formal quote
        status: 'submitted' as const,
        concentration: sampleCount > 0 && sampleTable[0] ? (sampleTable[0].concentration || sampleTable[0].qubit_conc || null) : null,
        volume: sampleCount > 0 && sampleTable[0] ? (sampleTable[0].volume || null) : null,
        notes: `QUOTE: ${quoteId}
SAMPLE TYPE: ${mappedSampleType}
FLOW CELL: ${mappedFlowCellType}
CHART FIELD: ${chartField}
SERVICE: ${serviceRequested}
ORGANISM: ${organism}
BUFFER: ${buffer}
GENOME SIZE: ${genomeSize}
COVERAGE: ${coverage}
BASECALLING: ${basecalling}
FILE FORMAT: ${fileFormat}
COST: ${cost}
PI: ${piName}
DEPARTMENT: ${department}
INSTITUTION: ${institution}
PHONE: ${phone}
PROJECT: ${projectDescription}
DATA DELIVERY: ${dataDelivery}
BILLING: ${billingAccount}
SPECIAL INSTRUCTIONS: ${specialInstructions}
EXPECTED YIELD: ${expectedYield}
LIBRARY PREP: ${libraryPrep}
MULTIPLEXING: ${multiplexing}
SAMPLE COUNT: ${sampleCount}${sampleCount > 0 ? `

SAMPLE DETAILS:
${sampleTable.slice(0, 10).map((s: any, i: number) => 
  `${i + 1}. ${s.sample_name || s.name || `Sample ${i + 1}`}: ${s.volume || 'N/A'}µL, ${s.concentration || s.qubit_conc || 'N/A'}ng/µL${s.nanodrop_conc ? `, NanoDrop: ${s.nanodrop_conc}ng/µL` : ''}`
).join('\n')}${sampleCount > 10 ? `\n... and ${sampleCount - 10} more samples` : ''}` : ''}`,
      }
      
      console.log('Creating sample with comprehensive data:', sampleData)
      await handleCreateSample(sampleData)
      toast.success(`Sample created successfully from PDF data (${sampleCount} samples found)`)
    } catch (error) {
      console.error('Failed to create sample from PDF data:', error)
      toast.error('Failed to create sample from PDF data')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading samples...</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Nanopore Sequencing Dashboard</h1>
          <p className="text-muted-foreground">Manage and track your nanopore sequencing samples</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowExportModal(true)} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Sample
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Samples</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="samples" className="w-full">
        <TabsList>
          <TabsTrigger value="samples">Samples</TabsTrigger>
          <TabsTrigger value="upload">Upload PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="samples" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search samples..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="prep">Prep</SelectItem>
                <SelectItem value="sequencing">Sequencing</SelectItem>
                <SelectItem value="analysis">Analysis</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Samples Table */}
          <Card className="relative">
            <CardHeader>
              <CardTitle>Samples ({filteredSamples.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-visible">
              <div className="space-y-4">
                {filteredSamples.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No samples found matching your criteria
                  </div>
                ) : (
                  filteredSamples.map((sample) => (
                    <div key={sample.id} className="border rounded-lg p-4 space-y-2 relative overflow-visible">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{sample.sampleName}</h3>
                          <p className="text-sm text-muted-foreground">
                            {sample.submitterName} • {sample.labName}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <StatusBadge status={sample.status} />
                          <PriorityBadge priority={sample.priority} />
                        </div>
                      </div>
                      {sample.notes && (
                        <p className="text-sm text-muted-foreground">{sample.notes}</p>
                      )}
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-muted-foreground">
                          Created: {new Date(sample.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex gap-2 items-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSample(sample)}
                          >
                            View
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="p-1 h-8 w-8">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent 
                              align="end" 
                              className="w-48 z-[100]"
                              sideOffset={5}
                            >
                              <DropdownMenuItem onClick={() => handleEditSample(sample)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteSample(sample.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <PDFUpload
            onDataExtracted={handlePDFDataExtracted}
            onFileUploaded={(file) => {
              toast.success(`File ${file.name} uploaded successfully`)
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Sample Detail Modal */}
      <Dialog open={!!selectedSample} onOpenChange={() => setSelectedSample(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sample Details</DialogTitle>
          </DialogHeader>
          {selectedSample && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Sample Name</Label>
                  <p className="text-sm">{selectedSample.sampleName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Submitter</Label>
                  <p className="text-sm">{selectedSample.submitterName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Lab</Label>
                  <p className="text-sm">{selectedSample.labName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm">{selectedSample.submitterEmail}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <StatusBadge status={selectedSample.status} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Priority</Label>
                  <PriorityBadge priority={selectedSample.priority} />
                </div>
                <div>
                  <Label className="text-sm font-medium">Concentration</Label>
                  <p className="text-sm">{selectedSample.concentration || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Volume</Label>
                  <p className="text-sm">{selectedSample.volume || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="text-sm">{new Date(selectedSample.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Updated</Label>
                  <p className="text-sm">{new Date(selectedSample.updatedAt).toLocaleString()}</p>
                </div>
              </div>
              {selectedSample.notes && (
                <div>
                  <Label className="text-sm font-medium">Notes</Label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">{selectedSample.notes}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedSample(null)}>
                  Close
                </Button>
                <Button onClick={() => {
                  if (selectedSample) {
                    handleEditSample(selectedSample)
                    setSelectedSample(null)
                  }
                }}>
                  Edit Sample
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Sample Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Sample</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            const sampleData = {
              sampleName: formData.get('sampleName') as string,
              submitterName: formData.get('submitterName') as string,
              submitterEmail: formData.get('submitterEmail') as string,
              labName: formData.get('labName') as string,
              priority: formData.get('priority') as 'low' | 'medium' | 'high' | 'urgent',
              status: 'submitted' as const,
              concentration: formData.get('concentration') as string,
              volume: formData.get('volume') as string,
              notes: formData.get('notes') as string,
            }
            handleCreateSample(sampleData)
          }}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sampleName">Sample Name *</Label>
                  <Input id="sampleName" name="sampleName" required />
                </div>
                <div>
                  <Label htmlFor="submitterName">Submitter Name *</Label>
                  <Input id="submitterName" name="submitterName" required />
                </div>
                <div>
                  <Label htmlFor="submitterEmail">Submitter Email *</Label>
                  <Input id="submitterEmail" name="submitterEmail" type="email" required />
                </div>
                <div>
                  <Label htmlFor="labName">Lab Name *</Label>
                  <Input id="labName" name="labName" required />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="concentration">Concentration</Label>
                  <Input id="concentration" name="concentration" placeholder="e.g., 10 ng/μL" />
                </div>
                <div>
                  <Label htmlFor="volume">Volume</Label>
                  <Input id="volume" name="volume" placeholder="e.g., 50 μL" />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" placeholder="Additional notes..." />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Sample
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Sample Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Sample</DialogTitle>
          </DialogHeader>
          {editingSample && (
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const sampleData = {
                sampleName: formData.get('sampleName') as string,
                submitterName: formData.get('submitterName') as string,
                submitterEmail: formData.get('submitterEmail') as string,
                labName: formData.get('labName') as string,
                priority: formData.get('priority') as 'low' | 'medium' | 'high' | 'urgent',
                status: formData.get('status') as 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed' | 'failed',
                concentration: formData.get('concentration') as string,
                volume: formData.get('volume') as string,
                notes: formData.get('notes') as string,
              }
              handleSaveEditSample(sampleData)
            }}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-sampleName">Sample Name *</Label>
                    <Input 
                      id="edit-sampleName" 
                      name="sampleName" 
                      defaultValue={editingSample.sampleName}
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-submitterName">Submitter Name *</Label>
                    <Input 
                      id="edit-submitterName" 
                      name="submitterName" 
                      defaultValue={editingSample.submitterName}
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-submitterEmail">Submitter Email *</Label>
                    <Input 
                      id="edit-submitterEmail" 
                      name="submitterEmail" 
                      type="email" 
                      defaultValue={editingSample.submitterEmail}
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-labName">Lab Name *</Label>
                    <Input 
                      id="edit-labName" 
                      name="labName" 
                      defaultValue={editingSample.labName}
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-priority">Priority</Label>
                    <Select name="priority" defaultValue={editingSample.priority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-status">Status</Label>
                    <Select name="status" defaultValue={editingSample.status}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="prep">Prep</SelectItem>
                        <SelectItem value="sequencing">Sequencing</SelectItem>
                        <SelectItem value="analysis">Analysis</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-concentration">Concentration</Label>
                    <Input 
                      id="edit-concentration" 
                      name="concentration" 
                      defaultValue={editingSample.concentration || ''}
                      placeholder="e.g., 10 ng/μL" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-volume">Volume</Label>
                    <Input 
                      id="edit-volume" 
                      name="volume" 
                      defaultValue={editingSample.volume || ''}
                      placeholder="e.g., 50 μL" 
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Input 
                    id="edit-notes" 
                    name="notes" 
                    defaultValue={editingSample.notes || ''}
                    placeholder="Additional notes..." 
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  )
} 