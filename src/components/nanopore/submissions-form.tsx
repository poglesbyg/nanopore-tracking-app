import { useState } from 'react'

export default function SubmissionsForm() {
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  
  // Form state
  const [sampleName, setSampleName] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')
  const [labName, setLabName] = useState('Default Lab')
  const [sampleType, setSampleType] = useState('DNA')
  const [chartField, setChartField] = useState('HTSF-001')
  const [priority, setPriority] = useState('normal')

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }

    setUploadingPdf(true)
    setError(null)

    // For now, just acknowledge the file upload without server processing
    setTimeout(() => {
      setUploadingPdf(false)
      setError('PDF uploaded for reference. Please fill in the form manually.')
    }, 1000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/submit-sample', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sampleName,
          submitterName,
          submitterEmail,
          labName: labName || 'Default Lab',
          sampleType,
          chartField: chartField || 'HTSF-001',
          priority
        }),
      })

      const data = await response.json()
      
      if (data && data.success) {
        setSuccess(true)
        // Reset form
        setSampleName('')
        setSubmitterName('')
        setSubmitterEmail('')
        setLabName('Default Lab')
        setSampleType('DNA')
        setChartField('HTSF-001')
        setPriority('normal')
      } else {
        setError(data?.message || 'Submission failed')
      }
    } catch (error) {
      console.error('Submit error:', error)
      setError('Failed to submit sample. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <div style={{ 
          padding: '30px', 
          backgroundColor: '#dcfce7', 
          borderRadius: '8px', 
          border: '1px solid #4ade80',
          textAlign: 'center' 
        }}>
          <h2 style={{ color: '#166534', fontSize: '24px', marginBottom: '10px' }}>✅ Sample Submitted!</h2>
          <p style={{ color: '#166534', marginBottom: '20px' }}>
            Your sample has been successfully submitted and will be processed shortly.
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button 
              onClick={() => setSuccess(false)}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#166534', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Submit Another
            </button>
            <a 
              href="/"
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#6b7280', 
                color: 'white', 
                textDecoration: 'none', 
                borderRadius: '6px',
                fontWeight: '500',
                display: 'inline-block'
              }}
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '10px', fontWeight: 'bold' }}>Submit New Sample</h1>
        <p style={{ color: '#64748b', marginBottom: '30px' }}>
          Upload a PDF submission form or fill out the form manually below.
        </p>

        {error && (
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#fef2f2', 
            borderRadius: '6px', 
            border: '1px solid #fca5a5',
            marginBottom: '20px'
          }}>
            <p style={{ color: '#dc2626', margin: 0 }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          {/* PDF Upload Section */}
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '2px dashed #cbd5e1' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '15px', fontWeight: '600' }}>📄 PDF Upload</h3>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                Upload PDF Submission Form
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                disabled={uploadingPdf}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '16px',
                  backgroundColor: uploadingPdf ? '#f3f4f6' : 'white'
                }}
              />
            </div>
            {uploadingPdf && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#3b82f6' }}>
                <div style={{ 
                  width: '20px', 
                  height: '20px', 
                  border: '2px solid #3b82f6', 
                  borderTop: '2px solid transparent', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite' 
                }}></div>
                <span>Processing PDF...</span>
              </div>
            )}
            <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px' }}>
              Upload a PDF form to automatically extract sample information, or fill out the form manually below.
            </p>
          </div>

          {/* Required Fields */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>Required Information</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                Sample Name *
              </label>
              <input
                type="text"
                value={sampleName}
                onChange={(e) => setSampleName(e.target.value)}
                required
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
                placeholder="Enter sample name"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                Submitter Name *
              </label>
              <input
                type="text"
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                required
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
                placeholder="Your full name"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                Email Address *
              </label>
              <input
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                required
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '6px',
                  fontSize: '16px'
                }}
                placeholder="your.email@example.com"
              />
            </div>
          </div>

          {/* Optional Fields */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>Additional Details</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Lab Name
                </label>
                <input
                  type="text"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '6px',
                    fontSize: '16px'
                  }}
                  placeholder="Lab name"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Sample Type
                </label>
                <select
                  value={sampleType}
                  onChange={(e) => setSampleType(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '6px',
                    fontSize: '16px'
                  }}
                >
                  <option value="DNA">DNA</option>
                  <option value="RNA">RNA</option>
                  <option value="Protein">Protein</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Chart Field
                </label>
                <input
                  type="text"
                  value={chartField}
                  onChange={(e) => setChartField(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '6px',
                    fontSize: '16px'
                  }}
                  placeholder="HTSF-001"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '6px',
                    fontSize: '16px'
                  }}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
            <a 
              href="/"
              style={{ 
                padding: '12px 24px', 
                backgroundColor: '#f1f5f9', 
                color: '#475569', 
                textDecoration: 'none', 
                borderRadius: '6px',
                fontWeight: '500',
                display: 'inline-block'
              }}
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={submitting || uploadingPdf}
              style={{ 
                padding: '12px 24px', 
                backgroundColor: (submitting || uploadingPdf) ? '#9ca3af' : '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: (submitting || uploadingPdf) ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                fontSize: '16px'
              }}
            >
              {submitting ? 'Submitting...' : uploadingPdf ? 'Processing...' : 'Submit Sample'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}