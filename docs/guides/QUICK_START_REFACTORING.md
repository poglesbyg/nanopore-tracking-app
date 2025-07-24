# Quick Start: Beginning the Refactoring Process

## Step 1: Install Required Dependencies

```bash
# State management
pnpm add zustand immer

# Performance optimization
pnpm add react-window react-intersection-observer

# Development tools
pnpm add -D @types/react-window
```

## Step 2: Create Basic Store Structure

Create `src/stores/index.ts`:

```typescript
export * from './authStore'
export * from './sampleStore'
export * from './workflowStore'
export * from './uiStore'
```

Create `src/stores/sampleStore.ts`:

```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface SampleStore {
  // State
  selectedSamples: Set<string>
  filters: {
    search: string
    status: string
    priority: string
  }
  
  // Actions
  setFilter: (key: string, value: string) => void
  toggleSampleSelection: (sampleId: string) => void
  clearSelection: () => void
}

export const useSampleStore = create<SampleStore>()(
  devtools(
    (set) => ({
      selectedSamples: new Set(),
      filters: {
        search: '',
        status: 'all',
        priority: 'all',
      },
      
      setFilter: (key, value) =>
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        })),
        
      toggleSampleSelection: (sampleId) =>
        set((state) => {
          const newSet = new Set(state.selectedSamples)
          if (newSet.has(sampleId)) {
            newSet.delete(sampleId)
          } else {
            newSet.add(sampleId)
          }
          return { selectedSamples: newSet }
        }),
        
      clearSelection: () =>
        set({ selectedSamples: new Set() }),
    }),
    { name: 'sample-store' }
  )
)
```

## Step 3: Extract First Component

Start with a simple component extraction from `nanopore-dashboard.tsx`:

Create `src/features/samples/components/SampleFilters.tsx`:

```typescript
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useSampleStore } from '@/stores/sampleStore'

export function SampleFilters() {
  const { filters, setFilter } = useSampleStore()
  
  return (
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
  )
}
```

## Step 4: Create Custom Hook for Data Fetching

Create `src/features/samples/hooks/useSamples.ts`:

```typescript
import { trpc } from '@/client/trpc'
import { useSampleStore } from '@/stores/sampleStore'
import { useMemo } from 'react'

export function useSamples() {
  const filters = useSampleStore((state) => state.filters)
  
  const { data, isLoading, error, refetch } = trpc.nanopore.getAllPaginated.useQuery({
    search: filters.search || undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    priority: filters.priority === 'all' ? undefined : filters.priority,
    page: 1,
    limit: 20,
  })
  
  const samples = useMemo(() => data?.data || [], [data])
  const pagination = useMemo(() => data?.pagination, [data])
  
  return {
    samples,
    pagination,
    isLoading,
    error,
    refetch,
  }
}
```

## Step 5: Extract Status Badge Component

Create `src/features/samples/components/StatusBadge.tsx`:

```typescript
import { Badge } from '@/components/ui/badge'
import { Clock, TestTube, Zap, Activity, CheckCircle, Archive } from 'lucide-react'

const statusConfig = {
  submitted: { color: 'bg-blue-100 text-blue-800', icon: Clock },
  prep: { color: 'bg-yellow-100 text-yellow-800', icon: TestTube },
  sequencing: { color: 'bg-purple-100 text-purple-800', icon: Zap },
  analysis: { color: 'bg-orange-100 text-orange-800', icon: Activity },
  completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  archived: { color: 'bg-gray-100 text-gray-800', icon: Archive },
}

interface StatusBadgeProps {
  status: keyof typeof statusConfig
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.submitted
  const Icon = config.icon
  
  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}
```

## Step 6: Start Using New Components

In your main dashboard, start replacing inline code with the new components:

```typescript
import { SampleFilters } from '@/features/samples/components/SampleFilters'
import { StatusBadge } from '@/features/samples/components/StatusBadge'
import { useSamples } from '@/features/samples/hooks/useSamples'

export function NanoporeDashboard() {
  const { samples, isLoading } = useSamples()
  
  return (
    <div className="space-y-6">
      {/* Replace the filter section */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Management</CardTitle>
        </CardHeader>
        <CardContent>
          <SampleFilters />
        </CardContent>
      </Card>
      
      {/* Use the StatusBadge component */}
      {samples.map((sample) => (
        <div key={sample.id}>
          <StatusBadge status={sample.status} />
          {/* ... rest of sample display */}
        </div>
      ))}
    </div>
  )
}
```

## Next Steps

1. Continue extracting components one by one
2. Move business logic to custom hooks
3. Create feature-specific stores
4. Add tests for each new component
5. Remove code from the original dashboard as you go

## Tips for Successful Refactoring

1. **Start Small**: Extract one component at a time
2. **Test as You Go**: Write tests for new components immediately
3. **Keep It Working**: Don't break existing functionality
4. **Document Changes**: Update documentation as you refactor
5. **Commit Often**: Make small, focused commits

## Common Pitfalls to Avoid

1. **Don't Rush**: Take time to plan each extraction
2. **Avoid Over-Engineering**: Keep components simple
3. **Don't Break Types**: Maintain TypeScript coverage
4. **Watch Bundle Size**: Monitor impact of new dependencies
5. **Keep Performance**: Profile before and after changes 