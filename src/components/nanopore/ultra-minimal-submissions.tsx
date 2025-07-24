import { useState, useEffect } from 'react'

interface Submission {
  id: number
  sampleName: string
  submitterName: string
  submitterEmail: string
  organism?: string
  sampleType?: string
  concentration?: number
  volume?: number
  buffer?: string
  submittedAt: string
  status: string
  chartField?: string
  priority?: string
  quoteIdentifier?: string
  labName?: string
  metadata?: any
}

export default function UltraMinimalSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSubmissions()
  }, [])

  const fetchSubmissions = async () => {
    try {
      const response = await fetch('/api/trpc/nanopore.getAll')
      const data = await response.json()
      const samples = data.result?.data || []
      
      // Sort by submission date, newest first
      const sorted = samples.sort((a: Submission, b: Submission) => 
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      )
      
      setSubmissions(sorted)
    } catch (error) {
      console.error('Failed to fetch submissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'submitted': return '#007bff'
      case 'in_progress': return '#ffc107'
      case 'completed': return '#28a745'
      case 'failed': return '#dc3545'
      default: return '#6c757d'
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading submissions...</div>
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>All Submissions</h1>
      
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Total submissions: {submissions.length}
      </p>

      {submissions.length === 0 ? (
        <p style={{ color: '#666' }}>No submissions found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {submissions.map((submission) => (
            <div
              key={submission.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#fff'
              }}
            >
              {/* Submission Header */}
              <div style={{ marginBottom: '15px' }}>
                <h2 style={{ fontSize: '18px', marginBottom: '5px' }}>
                  {submission.sampleName}
                </h2>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: 'white',
                    backgroundColor: getStatusColor(submission.status)
                  }}
                >
                  {submission.status}
                </span>
              </div>

              {/* Two Column Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                {/* Left Column - Submitter Info */}
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
                    Submitter Information
                  </h3>
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    <div><strong>Name:</strong> {submission.submitterName}</div>
                    <div><strong>Email:</strong> {submission.submitterEmail}</div>
                    <div><strong>Submitted:</strong> {formatDate(submission.submittedAt)}</div>
                    {submission.labName && (
                      <div><strong>Lab:</strong> {submission.labName}</div>
                    )}
                  </div>
                </div>

                {/* Right Column - Sample Details */}
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
                    Sample Details
                  </h3>
                  <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    {submission.organism && (
                      <div><strong>Organism:</strong> {submission.organism}</div>
                    )}
                    {submission.sampleType && (
                      <div><strong>Type:</strong> {submission.sampleType}</div>
                    )}
                    {submission.concentration && (
                      <div><strong>Concentration:</strong> {submission.concentration} ng/μL</div>
                    )}
                    {submission.volume && (
                      <div><strong>Volume:</strong> {submission.volume} μL</div>
                    )}
                    {submission.buffer && (
                      <div><strong>Buffer:</strong> {submission.buffer}</div>
                    )}
                    {submission.chartField && (
                      <div><strong>Chart Field:</strong> {submission.chartField}</div>
                    )}
                    {submission.priority && (
                      <div><strong>Priority:</strong> {submission.priority}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quote ID if present */}
              {submission.quoteIdentifier && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                  Quote ID: {submission.quoteIdentifier}
                </div>
              )}
              
              {/* Show if extracted from PDF */}
              {submission.metadata?.extractedFrom && (
                <div style={{ marginTop: '5px', fontSize: '11px', color: '#999' }}>
                  Extracted from: {submission.metadata.extractedFrom}
                  {submission.metadata.fromSampleTable && ' (from sample table)'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Back to Dashboard */}
      <div style={{ marginTop: '30px' }}>
        <a href="/nanopore" style={{ color: '#007bff', textDecoration: 'none' }}>
          ← Back to Dashboard
        </a>
      </div>
    </div>
  )
} 