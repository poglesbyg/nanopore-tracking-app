import { useState, useEffect } from 'react'

interface Sample {
  id?: string
  sampleName?: string
  sample_name?: string
  submitterName?: string
  submitter_name?: string
  submitterEmail?: string
  submitter_email?: string
  status: string
}

export default function DashboardOverview() {
  const [stats, setStats] = useState({
    totalSamples: 0,
    recentSamples: [] as Sample[],
    statusCounts: {
      submitted: 0,
      processing: 0,
      completed: 0
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch sample stats
      const response = await fetch('/api/get-samples')
      const data = await response.json()
      
      if (data && data.success && data.data) {
        const samples = data.data as Sample[]
        setStats({
          totalSamples: samples.length,
          recentSamples: samples.slice(-5), // Last 5 samples
          statusCounts: {
            submitted: samples.filter((s: Sample) => s.status === 'submitted').length,
            processing: samples.filter((s: Sample) => s.status === 'processing').length,
            completed: samples.filter((s: Sample) => s.status === 'completed').length
          }
        })
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '20px', fontWeight: 'bold' }}>Dashboard</h1>
        <div style={{ padding: '20px', textAlign: 'center' }}>Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '30px', fontWeight: 'bold' }}>Dashboard</h1>
      
      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px', 
        marginBottom: '40px' 
      }}>
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f8fafc', 
          borderRadius: '8px', 
          border: '1px solid #e2e8f0' 
        }}>
          <h3 style={{ fontSize: '16px', color: '#64748b', marginBottom: '8px' }}>Total Samples</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
            {stats.totalSamples}
          </p>
        </div>
        
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#fef3c7', 
          borderRadius: '8px', 
          border: '1px solid #fcd34d' 
        }}>
          <h3 style={{ fontSize: '16px', color: '#92400e', marginBottom: '8px' }}>Submitted</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#92400e', margin: 0 }}>
            {stats.statusCounts.submitted}
          </p>
        </div>
        
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#dbeafe', 
          borderRadius: '8px', 
          border: '1px solid #60a5fa' 
        }}>
          <h3 style={{ fontSize: '16px', color: '#1d4ed8', marginBottom: '8px' }}>Processing</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#1d4ed8', margin: 0 }}>
            {stats.statusCounts.processing}
          </p>
        </div>
        
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#dcfce7', 
          borderRadius: '8px', 
          border: '1px solid #4ade80' 
        }}>
          <h3 style={{ fontSize: '16px', color: '#166534', marginBottom: '8px' }}>Completed</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#166534', margin: 0 }}>
            {stats.statusCounts.completed}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: '600' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <a 
            href="/submissions" 
            style={{ 
              padding: '12px 24px', 
              backgroundColor: '#3b82f6', 
              color: 'white', 
              textDecoration: 'none', 
              borderRadius: '6px', 
              fontWeight: '500',
              display: 'inline-block'
            }}
          >
            New Submission
          </a>

        </div>
      </div>

      {/* Recent Samples */}
      <div>
        <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: '600' }}>Recent Samples</h2>
        {stats.recentSamples.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center', 
            backgroundColor: '#f8fafc', 
            borderRadius: '8px',
            border: '2px dashed #cbd5e1'
          }}>
            <p style={{ color: '#64748b', fontSize: '16px' }}>No samples yet</p>
            <a 
              href="/submissions"
              style={{ 
                color: '#3b82f6', 
                textDecoration: 'none', 
                fontWeight: '500' 
              }}
            >
              Submit your first sample →
            </a>
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {stats.recentSamples.map((sample, index) => (
              <div 
                key={sample.id || index}
                style={{ 
                  padding: '16px 20px', 
                  borderBottom: index < stats.recentSamples.length - 1 ? '1px solid #e2e8f0' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: '500', fontSize: '16px' }}>
                    {sample.sampleName || sample.sample_name}
                  </p>
                  <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
                    {sample.submitterName || sample.submitter_name} • {sample.submitterEmail || sample.submitter_email}
                  </p>
                </div>
                <span style={{ 
                  padding: '4px 12px', 
                  borderRadius: '20px', 
                  fontSize: '12px', 
                  fontWeight: '500',
                  backgroundColor: sample.status === 'submitted' ? '#fef3c7' : 
                                   sample.status === 'processing' ? '#dbeafe' : '#dcfce7',
                  color: sample.status === 'submitted' ? '#92400e' : 
                         sample.status === 'processing' ? '#1d4ed8' : '#166534'
                }}>
                  {sample.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}