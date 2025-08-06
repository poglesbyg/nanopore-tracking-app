import React, { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Upload, FileText, Plus } from 'lucide-react'
import CreateProjectModal from './create-project-modal'

interface Project {
  id: string
  name: string
  owner_name: string
  owner_email: string
}

interface ExtractedData {
  submitter_name?: string
  submitter_email?: string
  chart_field?: string
  department?: string
  project_title?: string
  samples?: Array<{
    sample_id: string
    sample_name: string
    concentration?: string
    concentration_unit?: string
    volume?: string
    volume_unit?: string
    sample_type?: string
  }>
}

export default function SubmissionWithHierarchy() {
  const [projects, setProjects] = useState<Project[]>([])
  const [sampleCount, setSampleCount] = useState(0)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [projectInitialData, setProjectInitialData] = useState<any>(null)
  
  // Form fields
  const [submissionName, setSubmissionName] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')
  const [description, setDescription] = useState('')
  const [uploadedFileName, setUploadedFileName] = useState('')

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [])

  // After projects load, if we have initial project data and still need to open modal
  useEffect(() => {
    if (projects.length === 0 || !projectInitialData) return

    // If a project already selected, nothing to do
    if (selectedProjectId) return

    const exists = projects.find(p => p.name.toLowerCase() === projectInitialData.name.toLowerCase())
    if (exists) {
      setSelectedProjectId(exists.id)
    } else {
      setShowCreateProjectModal(true)
    }
  }, [projects])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      const result = await response.json()
      if (result.success) {
        setProjects(result.data)
        // Don't auto-select - let user choose or create from PDF
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }
  }

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }

    setUploadingPdf(true)
    setError(null)
    setUploadedFileName(file.name)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json().catch(() => ({ success: false, message: 'Invalid JSON response'}))

      if (!response.ok || !result.success) {
        throw new Error(result.message || `Upload failed: ${response.statusText}`)
      }
      
      if (result.success && result.data) {
        const data = result.data
        setExtractedData(data)
        
        // Auto-populate form fields
        if (data.submitter_name) setSubmitterName(data.submitter_name)
        if (data.submitter_email) setSubmitterEmail(data.submitter_email)
        if (data.project_title) setSubmissionName(data.project_title)
        if (data.department) setDescription(`Department: ${data.department}`)
        
        // Prepare project data from PDF
        const projectData = {
          name: data.project_title || 'Untitled Project',
          description: data.department ? `Department: ${data.department}` : '',
          owner_name: data.submitter_name || '',
          owner_email: data.submitter_email || '',
          chart_prefix: data.chart_field?.startsWith('HTSF') ? 'HTSF' : 'NANO'
        }
        
        setProjectInitialData(projectData)
        
        // Check if a project with this name already exists
        const existingProject = projects.find(p => 
          p.name.toLowerCase() === projectData.name.toLowerCase()
        )
        
        if (existingProject) {
          // Select the existing project
          setSelectedProjectId(existingProject.id)
        } else {
          // Always show modal for new project with pre-filled data from PDF
          setShowCreateProjectModal(true)
        }
      }
    } catch (error) {
      console.error('PDF upload error:', error)
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError('Failed to process PDF. Please try again.')
      }
    } finally {
      setUploadingPdf(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedProjectId) {
      setError('Please select or create a project')
      return
    }

    if (!submissionName || !submitterName || !submitterEmail) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create submission
      const submissionResponse = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId,
          name: submissionName,
          description,
          submitter_name: submitterName,
          submitter_email: submitterEmail,
          submission_type: uploadedFileName ? 'pdf' : 'manual',
          priority: 'normal',
          original_filename: uploadedFileName || undefined
        })
      })

      const submissionResult = await submissionResponse.json().catch(() => ({ success:false, message:'Invalid JSON'}))
      if (!submissionResponse.ok || !submissionResult.success) {
        throw new Error(submissionResult.message || 'Failed to create submission')
      }

      const submissionId = submissionResult.data.id

      // Create samples if we have extracted data
      let createdSamples = 0
      if (extractedData?.samples && extractedData.samples.length > 0) {
        for (const sample of extractedData.samples) {
          const sampleResponse = await fetch('/api/samples', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              submission_id: submissionId,
              sample_name: sample.sample_name || sample.sample_id,
              sample_id: sample.sample_id,
              sample_type: sample.sample_type || 'DNA',
              submitter_name: submitterName,
              submitter_email: submitterEmail,
              lab_name: 'Default Lab',
              chart_field: extractedData.chart_field || 'HTSF-001',
              concentration: sample.concentration ? parseFloat(sample.concentration) : undefined,
              concentration_unit: sample.concentration_unit,
              volume: sample.volume ? parseFloat(sample.volume) : undefined,
              volume_unit: sample.volume_unit,
              priority: 'normal',
              status: 'submitted'
            })
          })

          const sampleResult = await sampleResponse.json().catch(()=>({ success:false, message:'Invalid JSON'}))
          if (!sampleResponse.ok || !sampleResult.success) {
            console.error('Failed to create sample:', sample.sample_id, sampleResult.message)
          } else {
            createdSamples++
          }
        }
      }

      // Store sample count before resetting form
      setSampleCount(createdSamples)

      setSuccess(true)
      resetForm()
    } catch (error) {
      console.error('Submission error:', error)
      setError(error instanceof Error ? error.message : 'Failed to create submission')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setSubmissionName('')
    setSubmitterName('')
    setSubmitterEmail('')
    setDescription('')
    setUploadedFileName('')
    setExtractedData(null)
    setSelectedProjectId('')
    setProjectInitialData(null)
    // Retain sample count for success message until next operation
  }

  const handleProjectCreated = (projectId?: string) => {
    fetchProjects()
    setShowCreateProjectModal(false)
    
    // If a project was created from PDF data, automatically select it
    if (projectId) {
      setSelectedProjectId(projectId)
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <div className="text-green-600 text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">Submission Created Successfully!</h2>
          <p className="text-green-700 mb-6">
            Your submission has been created with {sampleCount} sample{sampleCount === 1 ? '' : 's'}.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => setSuccess(false)} variant="default">
              Create Another Submission
            </Button>
            <Button onClick={() => window.location.href = '/'} variant="outline">
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Create New Submission</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Selection */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">1. Select Project</h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="project">Project *</Label>
              <select
                id="project"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
              >
                <option value="">Select a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.owner_name})
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              onClick={() => setShowCreateProjectModal(true)}
              variant="outline"
              className="mt-6"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* PDF Upload */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">2. Upload Quote PDF (Optional)</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="application/pdf"
              onChange={handlePdfUpload}
              className="hidden"
              id="pdf-upload"
              disabled={uploadingPdf}
            />
            <label
              htmlFor="pdf-upload"
              className={`cursor-pointer flex flex-col items-center ${uploadingPdf ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'} rounded-lg p-4 transition-colors`}
            >
              {uploadedFileName ? (
                <>
                  <FileText className="h-12 w-12 text-green-500 mb-2" />
                  <span className="text-green-600 font-medium">{uploadedFileName}</span>
                  <span className="text-sm text-gray-500 mt-1">Click to change file</span>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-gray-400 mb-2" />
                  <span className="text-gray-600">
                    {uploadingPdf ? 'Processing PDF...' : 'Click to upload HTSF quote PDF'}
                  </span>
                  <span className="text-sm text-gray-500 mt-1">
                    PDF will be processed to extract sample information
                  </span>
                </>
              )}
            </label>
          </div>
          
          {extractedData?.samples && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                ✓ Extracted {extractedData.samples.length} samples from PDF
              </p>
            </div>
          )}
        </div>

        {/* Submission Details */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">3. Submission Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="submissionName">Submission Name *</Label>
              <Input
                id="submissionName"
                type="text"
                value={submissionName}
                onChange={(e) => setSubmissionName(e.target.value)}
                placeholder="e.g., COVID-19 Variant Sequencing Batch 1"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="submitterName">Submitter Name *</Label>
              <Input
                id="submitterName"
                type="text"
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="e.g., Dr. Jane Smith"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="submitterEmail">Submitter Email *</Label>
              <Input
                id="submitterEmail"
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                placeholder="e.g., jane.smith@university.edu"
                required
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional notes or description..."
              />
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.href = '/'}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || uploadingPdf}
          >
            {loading ? 'Creating Submission...' : 'Create Submission'}
          </Button>
        </div>
      </form>

      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        onProjectCreated={handleProjectCreated}
        initialData={projectInitialData}
      />
    </div>
  )
}