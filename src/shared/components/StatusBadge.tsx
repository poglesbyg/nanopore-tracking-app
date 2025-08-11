import { Badge } from '@/components/ui/badge'
import { Clock, TestTube, Zap, Activity, CheckCircle, Package, Archive } from 'lucide-react'

const statusConfig = {
  submitted: { color: 'bg-blue-100 text-blue-800', icon: Clock },
  prep: { color: 'bg-yellow-100 text-yellow-800', icon: TestTube },
  sequencing: { color: 'bg-purple-100 text-purple-800', icon: Zap },
  analysis: { color: 'bg-orange-100 text-orange-800', icon: Activity },
  completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  distributed: { color: 'bg-indigo-100 text-indigo-800', icon: Package },
  archived: { color: 'bg-gray-100 text-gray-800', icon: Archive }
}

export type SampleStatus = keyof typeof statusConfig

interface StatusBadgeProps {
  status: string
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('StatusBadge rendering with status:', status)
  }
  
  const config = statusConfig[status as SampleStatus] || statusConfig.submitted
  const Icon = config.icon

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
} 