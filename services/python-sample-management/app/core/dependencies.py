"""
Dependency Injection Container
Provides a clean way to manage dependencies and their lifecycle
"""

from typing import TypeVar, Type, Dict, Any, Callable, Optional, Protocol
from functools import lru_cache
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
import asyncio


T = TypeVar('T')


class ServiceProtocol(Protocol):
    """Base protocol for all services"""
    async def startup(self) -> None:
        """Initialize service resources"""
        ...
    
    async def shutdown(self) -> None:
        """Clean up service resources"""
        ...


class DIContainer:
    """
    Dependency Injection Container
    Manages service instances and their lifecycle
    """
    
    def __init__(self):
        self._services: Dict[Type, Any] = {}
        self._factories: Dict[Type, Callable] = {}
        self._singletons: Dict[Type, Any] = {}
        self._startup_handlers: list[Callable] = []
        self._shutdown_handlers: list[Callable] = []
    
    def register_singleton(self, service_type: Type[T], instance: T) -> None:
        """Register a singleton service instance"""
        self._singletons[service_type] = instance
        self._services[service_type] = instance
    
    def register_factory(self, service_type: Type[T], factory: Callable[..., T]) -> None:
        """Register a factory function for creating service instances"""
        self._factories[service_type] = factory
    
    def register_scoped(self, service_type: Type[T], factory: Callable[..., T]) -> None:
        """Register a scoped service (new instance per request)"""
        self._factories[service_type] = factory
    
    async def get(self, service_type: Type[T]) -> T:
        """Get a service instance"""
        # Check if singleton exists
        if service_type in self._singletons:
            return self._singletons[service_type]
        
        # Check if factory exists
        if service_type in self._factories:
            instance = await self._create_instance(service_type)
            return instance
        
        # Check if already instantiated
        if service_type in self._services:
            return self._services[service_type]
        
        raise ValueError(f"Service {service_type} not registered")
    
    async def _create_instance(self, service_type: Type[T]) -> T:
        """Create a new service instance using factory"""
        factory = self._factories[service_type]
        
        # Get factory parameters
        import inspect
        sig = inspect.signature(factory)
        kwargs = {}
        
        for param_name, param in sig.parameters.items():
            if param.annotation != param.empty:
                # Try to resolve dependency
                try:
                    dependency = await self.get(param.annotation)
                    kwargs[param_name] = dependency
                except ValueError:
                    # Skip if not found
                    pass
        
        # Create instance
        if asyncio.iscoroutinefunction(factory):
            instance = await factory(**kwargs)
        else:
            instance = factory(**kwargs)
        
        return instance
    
    def add_startup(self, handler: Callable) -> None:
        """Add a startup handler"""
        self._startup_handlers.append(handler)
    
    def add_shutdown(self, handler: Callable) -> None:
        """Add a shutdown handler"""
        self._shutdown_handlers.append(handler)
    
    async def startup(self) -> None:
        """Run all startup handlers"""
        for handler in self._startup_handlers:
            if asyncio.iscoroutinefunction(handler):
                await handler()
            else:
                handler()
        
        # Call startup on all singleton services
        for service in self._singletons.values():
            if hasattr(service, 'startup'):
                await service.startup()
    
    async def shutdown(self) -> None:
        """Run all shutdown handlers"""
        # Call shutdown on all singleton services
        for service in self._singletons.values():
            if hasattr(service, 'shutdown'):
                await service.shutdown()
        
        for handler in self._shutdown_handlers:
            if asyncio.iscoroutinefunction(handler):
                await handler()
            else:
                handler()


# Global container instance
_container: Optional[DIContainer] = None


def get_container() -> DIContainer:
    """Get the global DI container"""
    global _container
    if _container is None:
        _container = DIContainer()
    return _container


# Dependency injection decorators
def injectable(cls: Type[T]) -> Type[T]:
    """Mark a class as injectable"""
    cls._injectable = True
    return cls


def inject(service_type: Type[T]) -> T:
    """Inject a dependency (for use in FastAPI)"""
    async def dependency():
        container = get_container()
        return await container.get(service_type)
    return dependency


# Database session management
class DatabaseSessionManager:
    """Manages database sessions"""
    
    def __init__(self, database_url: str):
        self.engine = create_async_engine(
            database_url,
            echo=False,
            pool_pre_ping=True,
            pool_size=20,
            max_overflow=10,
        )
        self.async_session = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
    
    async def startup(self):
        """Initialize database"""
        # You can add database initialization here
        pass
    
    async def shutdown(self):
        """Close database connections"""
        await self.engine.dispose()
    
    @asynccontextmanager
    async def get_session(self):
        """Get a database session"""
        async with self.async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()


# FastAPI dependency for database session
async def get_db_session(
    session_manager: DatabaseSessionManager = inject(DatabaseSessionManager)
) -> AsyncSession:
    """Get database session for FastAPI"""
    async with session_manager.get_session() as session:
        yield session


# Service registration helpers
def register_services(container: DIContainer, settings: Any):
    """Register all services in the container"""
    from app.repositories import SubmissionRepository, SampleRepository
    from app.core.config import get_settings
    
    # Register settings
    container.register_singleton(type(settings), settings)
    
    # Register database session manager
    db_manager = DatabaseSessionManager(settings.database.url)
    container.register_singleton(DatabaseSessionManager, db_manager)
    
    # Register repositories as factories
    container.register_factory(
        SubmissionRepository,
        lambda db: SubmissionRepository(db)
    )
    container.register_factory(
        SampleRepository,
        lambda db: SampleRepository(db)
    )
    
    # Add startup/shutdown handlers
    container.add_startup(db_manager.startup)
    container.add_shutdown(db_manager.shutdown)


# Convenience functions
container = get_container() 