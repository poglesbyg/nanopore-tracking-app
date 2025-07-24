'use client'

import { useState } from 'react'
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { trpc } from '@/client/trpc'
import type { ExtractedData, SubmissionData, SampleData } from '@/types/submission'

interface SubmissionFormProps {
  extractedData: ExtractedData
  onSubmit: (data: SubmissionData) => void
  onBack: () => void
}

export function SubmissionForm({ extractedData, onSubmit, onBack }: SubmissionFormProps) {
  const [formData, setFormData] = useState<SampleData>({
    sampleName: extractedData.sampleName || '',
    submitterName: extractedData.submitterName || '',
    submitterEmail: extractedData.submitterEmail || '',
    organism: extractedData.organism || '',
    concentration: extractedData.concentration || 0,
    volume: extractedData.volume || 0,
    buffer: extractedData.buffer || '',
    sampleType: extractedData.sampleType || '',
    notes: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSampleMutation = trpc.nanopore.create.useMutation({
    onSuccess: (result) => {
      const submissionData: SubmissionData = {
        id: result.id,
        submissionDate: new Date(),
        status: 'completed',
        samples: [{ ...formData, id: result.id }],
        totalSamples: 1,
        metadata: {
          extractionMethod: extractedData.extractionMethod,
          confidence: extractedData.confidence
        }
      }
      onSubmit(submissionData)
    },
    onError: (error) => {
      setError(error.message)
      setIsSubmitting(false)
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    // Validate required fields
    if (!formData.sampleName || !formData.submitterName || !formData.submitterEmail) {
      setError('Please fill in all required fields')
      setIsSubmitting(false)
      return
    }

    // Submit to database
    createSampleMutation.mutate({
      sample_name: formData.sampleName,
      submitter_name: formData.submitterName,
      submitter_email: formData.submitterEmail,
      organism: formData.organism,
      concentration: formData.concentration?.toString(),
      volume: formData.volume?.toString(),
      buffer: formData.buffer,
      sample_type: formData.sampleType,
      additional_notes: formData.notes,
      status: 'submitted',
      submitted_at: new Date().toISOString()
    })
  }

  const handleFieldChange = (field: keyof SampleData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const getConfidenceBadge = () => {
    const confidence = extractedData.confidence || 0
    if (confidence >= 0.8) {
      return <Badge className="bg-green-100 text-green-800">High Confidence</Badge>
    } else if (confidence >= 0.6) {
      return <Badge className="bg-yellow-100 text-yellow-800">Medium Confidence</Badge>
    } else {
      return <Badge className="bg-red-100 text-red-800">Low Confidence</Badge>
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review Extracted Information</CardTitle>
              <CardDescription>
                Please review and correct any information before submitting
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getConfidenceBadge()}
              <Badge variant="outline">
                {extractedData.extractionMethod === 'ai' ? 'AI Enhanced' : 'Pattern Matching'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Sample Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Sample Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sampleName">Sample Name *</Label>
                <Input
                  id="sampleName"
                  value={formData.sampleName}
                  onChange={(e) => handleFieldChange('sampleName', e.target.value)}
                  required
                  className={!extractedData.sampleName ? 'border-yellow-400' : ''}
                />
              </div>
              
              <div>
                <Label htmlFor="organism">Organism</Label>
                <Input
                  id="organism"
                  value={formData.organism}
                  onChange={(e) => handleFieldChange('organism', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="concentration">Concentration (ng/μl)</Label>
                <Input
                  id="concentration"
                  type="number"
                  step="0.1"
                  value={formData.concentration}
                  onChange={(e) => handleFieldChange('concentration', parseFloat(e.target.value))}
                />
              </div>
              
              <div>
                <Label htmlFor="volume">Volume (μl)</Label>
                <Input
                  id="volume"
                  type="number"
                  step="0.1"
                  value={formData.volume}
                  onChange={(e) => handleFieldChange('volume', parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="buffer">Buffer</Label>
                <Input
                  id="buffer"
                  value={formData.buffer}
                  onChange={(e) => handleFieldChange('buffer', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="sampleType">Sample Type</Label>
                <Input
                  id="sampleType"
                  value={formData.sampleType}
                  onChange={(e) => handleFieldChange('sampleType', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Submitter Information */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Submitter Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="submitterName">Name *</Label>
                <Input
                  id="submitterName"
                  value={formData.submitterName}
                  onChange={(e) => handleFieldChange('submitterName', e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="submitterEmail">Email *</Label>
                <Input
                  id="submitterEmail"
                  type="email"
                  value={formData.submitterEmail}
                  onChange={(e) => handleFieldChange('submitterEmail', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="pt-4 border-t">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              rows={3}
              placeholder="Any additional information about the sample..."
            />
          </div>

          {/* Show additional extracted fields if available */}
          {(extractedData.piName || extractedData.department || extractedData.labName) && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Additional Information</h3>
              <div className="space-y-1 text-sm text-gray-600">
                {extractedData.piName && <p>PI: {extractedData.piName}</p>}
                {extractedData.department && <p>Department: {extractedData.department}</p>}
                {extractedData.labName && <p>Lab: {extractedData.labName}</p>}
                {extractedData.flowCell && <p>Flow Cell: {extractedData.flowCell}</p>}
                {extractedData.coverage && <p>Coverage: {extractedData.coverage}</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Submit Sample
            </>
          )}
        </Button>
      </div>
    </form>
  )
}