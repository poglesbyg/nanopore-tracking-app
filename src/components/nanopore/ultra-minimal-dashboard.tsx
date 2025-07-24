import { useState, useEffect } from 'react'

export default function UltraMinimalDashboard() {
  const [samples, setSamples] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  
  // Simple form state
  const [sampleName, setSampleName] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')

  // Fetch samples
  useEffect(() => {
    fetchSamples()
  }, [])

  const fetchSamples = async () => {
    try {
      const response = await fetch('/api/trpc/nanopore.getAll')
      const data = await response.json()
      setSamples(data.result?.data || [])
    } catch (error) {
      console.error('Failed to fetch samples:', error)
    } finally {
      setLoading(false)
    }
  }

  // Submit sample
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!sampleName || !submitterName || !submitterEmail) {
      alert('Please fill in all fields')
      return
    }

    setSubmitting(true)
    
    try {
      const response = await fetch('/api/trpc/nanopore.create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: {
            sampleName,
            submitterName,
            submitterEmail,
            sampleType: 'DNA',
            chartField: 'HTSF-001',
            priority: 'normal',
            status: 'submitted'
          }
        }),
      })

      if (response.ok) {
        alert('Sample submitted successfully!')
        setSampleName('')
        setSubmitterName('')
        setSubmitterEmail('')
        setShowForm(false)
        fetchSamples()
      } else {
        alert('Failed to submit sample')
      }
    } catch (error) {
      alert('Error submitting sample')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Nanopore Sample Tracking</h1>
      
      {/* Navigation */}
      <div style={{ marginBottom: '20px' }}>
        <a href="/submissions" style={{ color: '#007bff', textDecoration: 'none', marginRight: '20px' }}>
          View All Submissions →
        </a>
        <a href="/submit-pdf" style={{ color: '#007bff', textDecoration: 'none' }}>
          Submit PDF →
        </a>
      </div>
      
      {/* Stats */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        <p>Total Samples: {samples.length}</p>
      </div>

      {/* Submit Button */}
      {!showForm && (
        <button 
          onClick={() => setShowForm(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          Submit New Sample
        </button>
      )}

      {/* Submit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ 
          marginBottom: '20px', 
          padding: '20px', 
          backgroundColor: '#f5f5f5',
          borderRadius: '5px'
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Submit New Sample</h2>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Sample Name *</label>
            <input
              type="text"
              value={sampleName}
              onChange={(e) => setSampleName(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '3px' }}
              required
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Submitter Name *</label>
            <input
              type="text"
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '3px' }}
              required
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Submitter Email *</label>
            <input
              type="email"
              value={submitterEmail}
              onChange={(e) => setSubmitterEmail(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '3px' }}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1
              }}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Sample List */}
      <div>
        <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>Samples</h2>
        {samples.length === 0 ? (
          <p style={{ color: '#666' }}>No samples submitted yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Sample Name</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Submitter</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={sample.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{sample.sampleName}</td>
                  <td style={{ padding: '10px' }}>{sample.submitterName}</td>
                  <td style={{ padding: '10px' }}>{sample.status || 'submitted'}</td>
                  <td style={{ padding: '10px' }}>
                    {new Date(sample.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
} 