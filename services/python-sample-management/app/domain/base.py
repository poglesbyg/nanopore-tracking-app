"""
Base Classes and Interfaces for Domain Layer
Provides abstract base classes for repositories and services
"""

from abc import ABC, abstractmethod
from typing import TypeVar, Generic, Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel
import uuid


# Type variables for generic classes
T = TypeVar('T', bound=BaseModel)
ID = TypeVar('ID')


class BaseEntity(BaseModel):
    """Base class for all domain entities"""
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    
    class Config:
        from_attributes = True


class IRepository(ABC, Generic[T, ID]):
    """
    Base repository interface
    Defines standard CRUD operations for all repositories
    """
    
    @abstractmethod
    async def get_by_id(self, id: ID) -> Optional[T]:
        """Get entity by ID"""
        pass
    
    @abstractmethod
    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
    ) -> List[T]:
        """Get all entities with optional filtering and pagination"""
        pass
    
    @abstractmethod
    async def create(self, entity: T) -> T:
        """Create new entity"""
        pass
    
    @abstractmethod
    async def update(self, id: ID, entity: T) -> Optional[T]:
        """Update existing entity"""
        pass
    
    @abstractmethod
    async def delete(self, id: ID) -> bool:
        """Delete entity by ID"""
        pass
    
    @abstractmethod
    async def exists(self, id: ID) -> bool:
        """Check if entity exists"""
        pass
    
    @abstractmethod
    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count entities with optional filtering"""
        pass


class IService(ABC):
    """Base service interface"""
    
    @abstractmethod
    async def validate(self, data: Any) -> bool:
        """Validate data according to business rules"""
        pass


class IUnitOfWork(ABC):
    """
    Unit of Work pattern interface
    Manages database transactions across multiple repositories
    """
    
    @abstractmethod
    async def __aenter__(self):
        """Begin transaction"""
        pass
    
    @abstractmethod
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """End transaction (commit or rollback)"""
        pass
    
    @abstractmethod
    async def commit(self):
        """Commit transaction"""
        pass
    
    @abstractmethod
    async def rollback(self):
        """Rollback transaction"""
        pass


class IAuditableRepository(IRepository[T, ID]):
    """Repository interface for auditable entities"""
    
    @abstractmethod
    async def get_history(self, id: ID) -> List[Dict[str, Any]]:
        """Get audit history for entity"""
        pass
    
    @abstractmethod
    async def get_by_version(self, id: ID, version: int) -> Optional[T]:
        """Get specific version of entity"""
        pass


class IEventPublisher(ABC):
    """Interface for publishing domain events"""
    
    @abstractmethod
    async def publish(self, event_type: str, data: Dict[str, Any]) -> None:
        """Publish domain event"""
        pass


class DomainEvent(BaseModel):
    """Base class for domain events"""
    event_id: Optional[str] = None
    event_type: str
    aggregate_id: str
    aggregate_type: str
    event_data: Dict[str, Any]
    event_timestamp: Optional[datetime] = None
    user_id: Optional[str] = None
    
    def __init__(self, **data):
        if not data.get('event_id'):
            data['event_id'] = str(uuid.uuid4())
        if not data.get('event_timestamp'):
            data['event_timestamp'] = datetime.utcnow()
        super().__init__(**data)


class ValueObject(BaseModel):
    """
    Base class for value objects
    Value objects are immutable and compared by value
    """
    
    class Config:
        frozen = True
        
    def __eq__(self, other):
        if not isinstance(other, self.__class__):
            return False
        return self.model_dump() == other.model_dump()
    
    def __hash__(self):
        return hash(tuple(self.model_dump().values()))


class Specification(ABC, Generic[T]):
    """
    Specification pattern for complex business rules
    """
    
    @abstractmethod
    def is_satisfied_by(self, candidate: T) -> bool:
        """Check if candidate satisfies specification"""
        pass
    
    def and_(self, other: 'Specification[T]') -> 'CompositeSpecification[T]':
        """Combine with AND logic"""
        return AndSpecification(self, other)
    
    def or_(self, other: 'Specification[T]') -> 'CompositeSpecification[T]':
        """Combine with OR logic"""
        return OrSpecification(self, other)
    
    def not_(self) -> 'CompositeSpecification[T]':
        """Negate specification"""
        return NotSpecification(self)


class CompositeSpecification(Specification[T]):
    """Base class for composite specifications"""
    pass


class AndSpecification(CompositeSpecification[T]):
    """AND combination of specifications"""
    
    def __init__(self, left: Specification[T], right: Specification[T]):
        self.left = left
        self.right = right
    
    def is_satisfied_by(self, candidate: T) -> bool:
        return self.left.is_satisfied_by(candidate) and self.right.is_satisfied_by(candidate)


class OrSpecification(CompositeSpecification[T]):
    """OR combination of specifications"""
    
    def __init__(self, left: Specification[T], right: Specification[T]):
        self.left = left
        self.right = right
    
    def is_satisfied_by(self, candidate: T) -> bool:
        return self.left.is_satisfied_by(candidate) or self.right.is_satisfied_by(candidate)


class NotSpecification(CompositeSpecification[T]):
    """NOT specification"""
    
    def __init__(self, spec: Specification[T]):
        self.spec = spec
    
    def is_satisfied_by(self, candidate: T) -> bool:
        return not self.spec.is_satisfied_by(candidate) 