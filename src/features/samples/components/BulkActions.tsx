import { Users, Activity, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSampleStore } from '@/stores/sampleStore'
import { useSampleOperations } from '../hooks/useSampleOperations'

interface BulkActionsProps {
  onBulkAssign: () => void
}

export const BulkActions = ({ onBulkAssign }: BulkActionsProps) => {
  const { selectedSamples, clearSelection } = useSampleStore()
  const { bulkUpdateStatus, bulkDelete, isLoading } = useSampleOperations()
  
  const selectedCount = selectedSamples.size
  const selectedIds = Array.from(selectedSamples)
  
  if (selectedCount === 0) return null
  
  const handleBulkStatusUpdate = async (status: string) => {
    await bulkUpdateStatus(selectedIds, status)
    clearSelection()
  }
  
  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedCount} selected samples?`)) {
      return
    }
    await bulkDelete(selectedIds)
    clearSelection()
  }
  
  return (
    <Card className="mb-4 bg-blue-50 border-blue-200">
      <CardContent className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-blue-900">
              {selectedCount} sample{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkAssign}
              disabled={isLoading}
            >
              <Users className="h-4 w-4 mr-2" />
              Bulk Assign
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatusUpdate('prep')}
              disabled={isLoading}
            >
              <Activity className="h-4 w-4 mr-2" />
              → Prep
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatusUpdate('sequencing')}
              disabled={isLoading}
            >
              <Activity className="h-4 w-4 mr-2" />
              → Sequencing
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isLoading}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSelection}
          >
            Clear Selection
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 