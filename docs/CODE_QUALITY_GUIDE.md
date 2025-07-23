# Code Quality & Best Practices Guide

## Frontend Best Practices

### 1. Component Architecture

#### ❌ Bad: Monolithic Components
```typescript
// Don't do this - 2000+ line component
export function NanoporeDashboard() {
  const [samples, setSamples] = useState([])
  const [filters, setFilters] = useState({})
  const [selectedSample, setSelectedSample] = useState(null)
  // ... 50 more state variables
  
  // ... 2000 lines of mixed logic
}
```

#### ✅ Good: Modular Components
```typescript
// Separate concerns into focused components
export function NanoporeDashboard() {
  return (
    <DashboardLayout>
      <DashboardHeader />
      <DashboardFilters />
      <SampleList />
      <WorkflowPanel />
    </DashboardLayout>
  )
}

// Each component handles its own state and logic
export function SampleList() {
  const { samples, loading } = useSamples()
  return <SampleTable samples={samples} loading={loading} />
}
```

### 2. State Management

#### ❌ Bad: Prop Drilling
```typescript
function App() {
  const [user, setUser] = useState()
  return <Dashboard user={user} setUser={setUser} />
}

function Dashboard({ user, setUser }) {
  return <SampleList user={user} setUser={setUser} />
}

function SampleList({ user, setUser }) {
  return <SampleItem user={user} setUser={setUser} />
}
```

#### ✅ Good: Context or State Management
```typescript
// Using Zustand
const useAuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))

// Component can access directly
function SampleItem() {
  const user = useAuthStore((state) => state.user)
  return <div>Welcome {user.name}</div>
}
```

### 3. Custom Hooks

#### ✅ Good: Extract Complex Logic
```typescript
// Custom hook for sample operations
export function useSampleOperations(sampleId: string) {
  const queryClient = useQueryClient()
  const { mutate: updateSample } = useMutation({
    mutationFn: (data) => api.updateSample(sampleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['samples'])
      toast.success('Sample updated')
    },
  })
  
  const { mutate: deleteSample } = useMutation({
    mutationFn: () => api.deleteSample(sampleId),
    onSuccess: () => {
      queryClient.invalidateQueries(['samples'])
      toast.success('Sample deleted')
    },
  })
  
  return { updateSample, deleteSample }
}
```

### 4. Type Safety

#### ❌ Bad: Any Types
```typescript
function processSample(data: any) {
  return data.sample_name // No type safety
}
```

#### ✅ Good: Strict Types
```typescript
interface Sample {
  id: string
  sampleName: string
  status: 'submitted' | 'prep' | 'sequencing' | 'analysis' | 'completed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

function processSample(data: Sample): string {
  return data.sampleName // Type safe
}
```

## Backend Best Practices

### 1. Service Layer Pattern

#### ✅ Good: Clean Service Architecture
```python
# services/sample_service.py
from typing import List, Optional
from repositories import SampleRepository
from models import Sample, CreateSampleDTO

class SampleService:
    def __init__(self, repository: SampleRepository):
        self.repository = repository
    
    async def create_sample(self, data: CreateSampleDTO) -> Sample:
        # Business logic validation
        if data.concentration < 0:
            raise ValueError("Concentration must be positive")
        
        # Delegate to repository
        return await self.repository.create(data)
    
    async def get_sample(self, sample_id: str) -> Optional[Sample]:
        return await self.repository.get_by_id(sample_id)
```

### 2. Error Handling

#### ❌ Bad: Generic Exceptions
```python
def process_sample(data):
    try:
        # Some operation
        return result
    except:
        return None  # Swallowing errors
```

#### ✅ Good: Specific Error Handling
```python
from app.exceptions import (
    SampleNotFoundError,
    InvalidSampleDataError,
    ProcessingError
)

async def process_sample(sample_id: str) -> ProcessedSample:
    try:
        sample = await get_sample(sample_id)
        if not sample:
            raise SampleNotFoundError(f"Sample {sample_id} not found")
        
        validated = validate_sample(sample)
        return await process_validated_sample(validated)
        
    except ValidationError as e:
        logger.error(f"Validation failed for sample {sample_id}: {e}")
        raise InvalidSampleDataError(str(e))
    except Exception as e:
        logger.error(f"Unexpected error processing sample {sample_id}: {e}")
        raise ProcessingError("Failed to process sample") from e
```

### 3. API Design

#### ✅ Good: RESTful API with Validation
```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/samples", tags=["samples"])

class CreateSampleRequest(BaseModel):
    sample_name: str = Field(..., min_length=1, max_length=255)
    concentration: float = Field(..., gt=0, description="ng/μL")
    volume: float = Field(..., gt=0, description="μL")
    priority: Literal["low", "normal", "high", "urgent"] = "normal"

@router.post("/", response_model=SampleResponse)
async def create_sample(
    request: CreateSampleRequest,
    service: SampleService = Depends(get_sample_service)
):
    """Create a new sample with validation."""
    try:
        sample = await service.create_sample(request)
        return SampleResponse.from_domain(sample)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

### 4. Database Patterns

#### ✅ Good: Repository Pattern
```python
# repositories/sample_repository.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Optional

class SampleRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, sample_id: str) -> Optional[Sample]:
        stmt = select(Sample).where(Sample.id == sample_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_by_status(self, status: str) -> List[Sample]:
        stmt = select(Sample).where(Sample.status == status)
        result = await self.session.execute(stmt)
        return result.scalars().all()
    
    async def update_status(self, sample_id: str, status: str) -> Optional[Sample]:
        stmt = (
            update(Sample)
            .where(Sample.id == sample_id)
            .values(status=status, updated_at=datetime.utcnow())
            .returning(Sample)
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.scalar_one_or_none()
```

## Testing Best Practices

### 1. Unit Tests

```python
# tests/unit/test_sample_service.py
import pytest
from unittest.mock import AsyncMock
from services import SampleService
from models import CreateSampleDTO

@pytest.mark.asyncio
async def test_create_sample_validates_concentration():
    # Arrange
    mock_repo = AsyncMock()
    service = SampleService(mock_repo)
    invalid_data = CreateSampleDTO(
        sample_name="Test",
        concentration=-1.0  # Invalid
    )
    
    # Act & Assert
    with pytest.raises(ValueError, match="Concentration must be positive"):
        await service.create_sample(invalid_data)

@pytest.mark.asyncio
async def test_create_sample_success():
    # Arrange
    mock_repo = AsyncMock()
    mock_repo.create.return_value = Sample(id="123", sample_name="Test")
    service = SampleService(mock_repo)
    
    # Act
    result = await service.create_sample(
        CreateSampleDTO(sample_name="Test", concentration=50.0)
    )
    
    # Assert
    assert result.id == "123"
    mock_repo.create.assert_called_once()
```

### 2. Integration Tests

```python
# tests/integration/test_sample_api.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_create_sample_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Arrange
        payload = {
            "sample_name": "Integration Test Sample",
            "concentration": 50.0,
            "volume": 100.0,
            "priority": "high"
        }
        
        # Act
        response = await client.post("/api/v1/samples/", json=payload)
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["sample_name"] == payload["sample_name"]
        assert data["status"] == "submitted"
```

## Performance Best Practices

### 1. Frontend Performance

```typescript
// Lazy loading
const SampleDetails = lazy(() => import('./SampleDetails'))

// Memoization
const ExpensiveComponent = memo(({ data }) => {
  const processed = useMemo(() => processData(data), [data])
  return <div>{processed}</div>
})

// Virtual scrolling for large lists
import { FixedSizeList } from 'react-window'

function LargeSampleList({ samples }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={samples.length}
      itemSize={50}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <SampleRow sample={samples[index]} />
        </div>
      )}
    </FixedSizeList>
  )
}
```

### 2. Backend Performance

```python
# Efficient database queries
async def get_samples_with_steps(sample_ids: List[str]) -> List[Sample]:
    # Use joinedload to avoid N+1 queries
    stmt = (
        select(Sample)
        .options(joinedload(Sample.processing_steps))
        .where(Sample.id.in_(sample_ids))
    )
    result = await session.execute(stmt)
    return result.scalars().unique().all()

# Caching
from functools import lru_cache
from aiocache import cached

@cached(ttl=300)  # Cache for 5 minutes
async def get_flow_cell_types() -> List[str]:
    return await repository.get_flow_cell_types()

# Batch processing
async def process_samples_batch(sample_ids: List[str], batch_size: int = 100):
    for i in range(0, len(sample_ids), batch_size):
        batch = sample_ids[i:i + batch_size]
        await process_batch(batch)
```

## Security Best Practices

### 1. Input Validation

```python
# Always validate and sanitize inputs
from pydantic import BaseModel, validator
import re

class SampleInput(BaseModel):
    sample_name: str
    email: EmailStr
    
    @validator('sample_name')
    def validate_sample_name(cls, v):
        if not re.match(r'^[a-zA-Z0-9\s\-_\.]+$', v):
            raise ValueError('Invalid characters in sample name')
        return v
```

### 2. Authentication & Authorization

```typescript
// Frontend route protection
function ProtectedRoute({ children, requiredRole }) {
  const { user, isLoading } = useAuth()
  
  if (isLoading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" />
  if (requiredRole && user.role !== requiredRole) {
    return <AccessDenied />
  }
  
  return children
}

// Backend authorization
@router.delete("/{sample_id}")
async def delete_sample(
    sample_id: str,
    current_user: User = Depends(get_current_user),
    service: SampleService = Depends(get_sample_service)
):
    if not current_user.has_permission("sample:delete"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    return await service.delete_sample(sample_id)
``` 