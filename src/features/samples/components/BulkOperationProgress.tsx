import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useSampleStore } from '@/stores/sampleStore'

export const BulkOperationProgress = () => {
  const { bulkOperationProgress } = useSampleStore()
  
  if (!bulkOperationProgress.isActive) return null
  
  const { total, completed, operation, errors } = bulkOperationProgress
  const progressPercentage = (completed / total) * 100
  
  return (
    <div className="mb-6">
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {operation}
                </span>
              </div>
              <span className="text-sm text-blue-700">
                {completed} of {total} completed
              </span>
            </div>
            <Progress 
              value={progressPercentage} 
              className="h-2 bg-blue-200" 
            />
            {errors.length > 0 && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                <span className="font-medium">Errors ({errors.length}):</span>
                <div className="mt-1 max-h-20 overflow-y-auto">
                  {errors.slice(0, 3).map((error, i) => (
                    <div key={i} className="truncate">{error}</div>
                  ))}
                  {errors.length > 3 && (
                    <div className="text-gray-500">...and {errors.length - 3} more</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 