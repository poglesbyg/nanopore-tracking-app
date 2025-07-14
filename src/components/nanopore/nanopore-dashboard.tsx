import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

type NanoporeSample = {
  id: string
  sampleName: string
  projectId: string | null
  submitterName: string
  submitterEmail: string
  labName: string | null
  sampleType: string
  status: string | null
  priority: string | null
  assignedTo: string | null
  libraryPrepBy: string | null
  submittedAt: Date
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export default function NanoporeDashboard() {
  const [samples] = useState<NanoporeSample[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Nanopore Dashboard</h1>
        <Button onClick={() => setShowCreateForm(true)}>
          Add Sample
        </Button>
      </div>

      {samples.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Samples Found</CardTitle>
            <CardDescription>
              Get started by adding your first nanopore sample.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {samples.map((sample) => (
            <Card key={sample.id}>
              <CardHeader>
                <CardTitle>{sample.sampleName}</CardTitle>
                <CardDescription>
                  Submitted by {sample.submitterName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge variant="outline">{sample.status || 'submitted'}</Badge>
                  <Badge variant="outline">{sample.priority || 'normal'}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add New Sample</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault()
                toast.success('Sample would be created here')
                setShowCreateForm(false)
              }}>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Sample Name"
                    className="w-full p-2 border rounded"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Submitter Name"
                    className="w-full p-2 border rounded"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Submitter Email"
                    className="w-full p-2 border rounded"
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit">Create</Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
