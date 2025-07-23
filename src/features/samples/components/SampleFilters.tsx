import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useSampleStore } from '@/stores/sampleStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const SampleFilters = () => {
  const { filters, setFilter } = useSampleStore()
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Sample Management</CardTitle>
        <CardDescription>
          Track and manage nanopore sequencing samples through the complete workflow
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search samples, submitters, or labs..."
                value={filters.search}
                onChange={(e) => setFilter('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="prep">Prep</option>
              <option value="sequencing">Sequencing</option>
              <option value="analysis">Analysis</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
            
            <select
              value={filters.priority}
              onChange={(e) => setFilter('priority', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              <option value="all">All Priority</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 