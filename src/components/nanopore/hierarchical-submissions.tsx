import { useState, useEffect } from 'react'

interface Sample {
  id: string
  sample_name: string
  sample_type?: string
  concentration?: number
  volume?: number
  status: string
  sample_number: number
}

interface Submission {
  id: string
  submission_number: string
  pdf_filename: string
  submitter_name: string
  submitter_email: string
  lab_name?: string
  submission_date: string
  status: string
  sample_count: number
  samples_completed: number
  samples: Sample[]
}

export default function HierarchicalSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSubmissions, setExpandedSubmissions] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchSubmissions()
  }, [])

  const fetchSubmissions = async () => {
    try {
      const response = await fetch('/api/submissions/get-all')
      const data = await response.json()
      
      if (data.success) {
        setSubmissions(data.data)
        // Automatically expand submissions with samples
        const withSamples = new Set<string>(data.data.filter((s: Submission) => s.samples.length > 0).map((s: Submission) => s.id))
        setExpandedSubmissions(withSamples)
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (submissionId: string) => {
    const newExpanded = new Set(expandedSubmissions)
    if (newExpanded.has(submissionId)) {
      newExpanded.delete(submissionId)
    } else {
      newExpanded.add(submissionId)
    }
    setExpandedSubmissions(newExpanded)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return '#6c757d'
      case 'processing': return '#ffc107'
      case 'completed': return '#28a745'
      case 'failed': return '#dc3545'
      case 'submitted': return '#007bff'
      default: return '#6c757d'
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading submissions...</div>
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>PDF Submissions</h1>
      
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Total submissions: {submissions.length} | 
        Total samples: {submissions.reduce((sum, s) => sum + s.samples.length, 0)}
      </p>

      {submissions.length === 0 ? (
        <p style={{ color: '#666' }}>No submissions found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {submissions.map((submission) => (
            <div
              key={submission.id}
              style={{
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#fff'
              }}
            >
              {/* Submission Header */}
              <div
                style={{
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderBottom: submission.samples.length > 0 && expandedSubmissions.has(submission.id) ? '1px solid #e0e0e0' : 'none',
                  cursor: submission.samples.length > 0 ? 'pointer' : 'default'
                }}
                onClick={() => submission.samples.length > 0 && toggleExpanded(submission.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '18px', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {submission.samples.length > 0 && (
                        <span style={{ fontSize: '14px' }}>
                          {expandedSubmissions.has(submission.id) ? '▼' : '▶'}
                        </span>
                      )}
                      {submission.submission_number}
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: 'white',
                          backgroundColor: getStatusColor(submission.status)
                        }}
                      >
                        {submission.status}
                      </span>
                    </h2>
                    
                    <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                      <div>PDF: {submission.pdf_filename}</div>
                      <div>Submitter: {submission.submitter_name} ({submission.submitter_email})</div>
                      {submission.lab_name && <div>Lab: {submission.lab_name}</div>}
                      <div>Date: {formatDate(submission.submission_date)}</div>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right', fontSize: '14px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                      {submission.samples.length} samples
                    </div>
                    {submission.samples_completed > 0 && (
                      <div style={{ color: '#666' }}>
                        {submission.samples_completed} completed
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Samples List */}
              {submission.samples.length > 0 && expandedSubmissions.has(submission.id) && (
                <div style={{ padding: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Sample Name</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Conc.</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Vol.</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submission.samples.map((sample) => (
                        <tr key={sample.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '8px' }}>{sample.sample_number}</td>
                          <td style={{ padding: '8px' }}>{sample.sample_name}</td>
                          <td style={{ padding: '8px' }}>{sample.sample_type || '-'}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {sample.concentration ? `${sample.concentration} ng/μL` : '-'}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {sample.volume ? `${sample.volume} μL` : '-'}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '3px',
                                fontSize: '11px',
                                color: 'white',
                                backgroundColor: getStatusColor(sample.status)
                              }}
                            >
                              {sample.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div style={{ marginTop: '30px', display: 'flex', gap: '20px' }}>
        <a href="/nanopore" style={{ color: '#007bff', textDecoration: 'none' }}>
          ← Back to Dashboard
        </a>
        <a href="/submit-pdf" style={{ color: '#007bff', textDecoration: 'none' }}>
          Submit New PDF →
        </a>
      </div>
    </div>
  )
} 