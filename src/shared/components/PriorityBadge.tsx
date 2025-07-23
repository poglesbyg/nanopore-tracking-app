import { Badge } from '@/components/ui/badge'

const priorityConfig = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700'
}

export type SamplePriority = keyof typeof priorityConfig

interface PriorityBadgeProps {
  priority: string
}

export const PriorityBadge = ({ priority }: PriorityBadgeProps) => {
  const className = priorityConfig[priority as SamplePriority] || priorityConfig.normal

  return (
    <Badge className={className}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  )
} 