"""
Repository classes for Nanopore Submission and Sample Management
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

from models import (
    NanoporeSubmission, NanoporeSample, NanoporeProcessingStep,
    NanoporeSampleDetail, NanoporeAttachment,
    SubmissionStatus, SampleStatus, QCStatus, Priority
)


class SubmissionRepository:
    """Repository for managing nanopore submissions"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_submission(
        self,
        submission_data: Dict[str, Any],
        created_by: str
    ) -> NanoporeSubmission:
        """Create a new submission with samples"""
        # Generate submission ID
        submission_id = str(uuid.uuid4())
        
        # Extract samples data if present
        samples_data = submission_data.pop('samples', [])
        
        # Create submission
        submission = NanoporeSubmission(
            id=submission_id,
            created_by=created_by,
            updated_by=created_by,
            **submission_data
        )
        
        # Add samples if provided
        for sample_data in samples_data:
            sample_id = str(uuid.uuid4())
            sample = NanoporeSample(
                id=sample_id,
                submission_id=submission_id,
                **sample_data
            )
            submission.samples.append(sample)
        
        self.db.add(submission)
        await self.db.commit()
        await self.db.refresh(submission)
        
        return submission
    
    async def get_submission(
        self,
        submission_id: str,
        include_samples: bool = True
    ) -> Optional[NanoporeSubmission]:
        """Get a submission by ID"""
        query = select(NanoporeSubmission).where(
            NanoporeSubmission.id == submission_id
        )
        
        if include_samples:
            query = query.options(
                selectinload(NanoporeSubmission.samples),
                selectinload(NanoporeSubmission.attachments)
            )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_submission_by_number(
        self,
        submission_number: str
    ) -> Optional[NanoporeSubmission]:
        """Get a submission by submission number"""
        query = select(NanoporeSubmission).where(
            NanoporeSubmission.submission_number == submission_number
        ).options(
            selectinload(NanoporeSubmission.samples),
            selectinload(NanoporeSubmission.attachments)
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def list_submissions(
        self,
        skip: int = 0,
        limit: int = 100,
        status: Optional[SubmissionStatus] = None,
        submitter_email: Optional[str] = None,
        project_id: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None
    ) -> List[NanoporeSubmission]:
        """List submissions with filters"""
        query = select(NanoporeSubmission)
        
        # Apply filters
        if status:
            query = query.where(NanoporeSubmission.status == status.value)
        if submitter_email:
            query = query.where(NanoporeSubmission.submitter_email == submitter_email)
        if project_id:
            query = query.where(NanoporeSubmission.project_id == project_id)
        if from_date:
            query = query.where(NanoporeSubmission.created_at >= from_date)
        if to_date:
            query = query.where(NanoporeSubmission.created_at <= to_date)
        
        # Add ordering and pagination
        query = query.order_by(NanoporeSubmission.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        # Include related data
        query = query.options(
            selectinload(NanoporeSubmission.samples),
            selectinload(NanoporeSubmission.attachments)
        )
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def update_submission(
        self,
        submission_id: str,
        update_data: Dict[str, Any],
        updated_by: str
    ) -> Optional[NanoporeSubmission]:
        """Update a submission"""
        # Get existing submission
        submission = await self.get_submission(submission_id)
        if not submission:
            return None
        
        # Update fields
        update_data['updated_by'] = updated_by
        update_data['updated_at'] = datetime.utcnow()
        
        await self.db.execute(
            update(NanoporeSubmission)
            .where(NanoporeSubmission.id == submission_id)
            .values(**update_data)
        )
        
        await self.db.commit()
        await self.db.refresh(submission)
        
        return submission
    
    async def delete_submission(self, submission_id: str) -> bool:
        """Delete a submission (cascades to samples)"""
        result = await self.db.execute(
            delete(NanoporeSubmission).where(NanoporeSubmission.id == submission_id)
        )
        
        if result.rowcount > 0:
            await self.db.commit()
            return True
        return False
    
    async def get_submission_statistics(self) -> Dict[str, Any]:
        """Get submission statistics"""
        # Count by status
        status_counts = {}
        for status in SubmissionStatus:
            result = await self.db.execute(
                select(func.count(NanoporeSubmission.id))
                .where(NanoporeSubmission.status == status.value)
            )
            status_counts[status.value] = result.scalar()
        
        # Count total samples
        total_samples_result = await self.db.execute(
            select(func.count(NanoporeSample.id))
        )
        total_samples = total_samples_result.scalar()
        
        # Average samples per submission
        avg_samples_result = await self.db.execute(
            select(func.avg(func.count(NanoporeSample.id)))
            .select_from(NanoporeSubmission)
            .outerjoin(NanoporeSample)
            .group_by(NanoporeSubmission.id)
        )
        avg_samples = avg_samples_result.scalar() or 0
        
        return {
            "total_submissions": sum(status_counts.values()),
            "status_breakdown": status_counts,
            "total_samples": total_samples,
            "average_samples_per_submission": float(avg_samples)
        }


class SampleRepository:
    """Repository for managing nanopore samples"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_sample(
        self,
        submission_id: str,
        sample_data: Dict[str, Any]
    ) -> NanoporeSample:
        """Create a new sample"""
        sample_id = str(uuid.uuid4())
        
        sample = NanoporeSample(
            id=sample_id,
            submission_id=submission_id,
            **sample_data
        )
        
        self.db.add(sample)
        await self.db.commit()
        await self.db.refresh(sample)
        
        return sample
    
    async def get_sample(
        self,
        sample_id: str,
        include_details: bool = True
    ) -> Optional[NanoporeSample]:
        """Get a sample by ID"""
        query = select(NanoporeSample).where(NanoporeSample.id == sample_id)
        
        if include_details:
            query = query.options(
                selectinload(NanoporeSample.submission),
                selectinload(NanoporeSample.processing_steps),
                selectinload(NanoporeSample.sample_details)
            )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def list_samples(
        self,
        skip: int = 0,
        limit: int = 100,
        submission_id: Optional[str] = None,
        status: Optional[SampleStatus] = None,
        qc_status: Optional[QCStatus] = None,
        assigned_to: Optional[str] = None,
        sample_type: Optional[str] = None,
        priority: Optional[Priority] = None
    ) -> List[NanoporeSample]:
        """List samples with filters"""
        query = select(NanoporeSample)
        
        # Apply filters
        if submission_id:
            query = query.where(NanoporeSample.submission_id == submission_id)
        if status:
            query = query.where(NanoporeSample.status == status.value)
        if qc_status:
            query = query.where(NanoporeSample.qc_status == qc_status.value)
        if assigned_to:
            query = query.where(NanoporeSample.assigned_to == assigned_to)
        if sample_type:
            query = query.where(NanoporeSample.sample_type == sample_type)
        if priority:
            query = query.where(NanoporeSample.priority == priority.value)
        
        # Add ordering and pagination
        query = query.order_by(NanoporeSample.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        # Include related data
        query = query.options(
            selectinload(NanoporeSample.submission),
            selectinload(NanoporeSample.processing_steps)
        )
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def update_sample(
        self,
        sample_id: str,
        update_data: Dict[str, Any]
    ) -> Optional[NanoporeSample]:
        """Update a sample"""
        # Get existing sample
        sample = await self.get_sample(sample_id)
        if not sample:
            return None
        
        # Update fields
        update_data['updated_at'] = datetime.utcnow()
        
        await self.db.execute(
            update(NanoporeSample)
            .where(NanoporeSample.id == sample_id)
            .values(**update_data)
        )
        
        await self.db.commit()
        await self.db.refresh(sample)
        
        return sample
    
    async def update_sample_status(
        self,
        sample_id: str,
        status: SampleStatus,
        notes: Optional[str] = None
    ) -> Optional[NanoporeSample]:
        """Update sample status with timestamp tracking"""
        update_data = {
            'status': status.value,
            'updated_at': datetime.utcnow()
        }
        
        # Track status-specific timestamps
        if status == SampleStatus.RECEIVED:
            update_data['received_at'] = datetime.utcnow()
        elif status == SampleStatus.QC_IN_PROGRESS:
            update_data['qc_started_at'] = datetime.utcnow()
        elif status in [SampleStatus.QC_PASSED, SampleStatus.QC_FAILED]:
            update_data['qc_completed_at'] = datetime.utcnow()
            update_data['qc_passed'] = (status == SampleStatus.QC_PASSED)
            if notes:
                update_data['qc_notes'] = notes
        elif status == SampleStatus.LIBRARY_PREP:
            update_data['library_prep_started_at'] = datetime.utcnow()
        elif status == SampleStatus.SEQUENCING:
            update_data['sequencing_started_at'] = datetime.utcnow()
        elif status == SampleStatus.ANALYSIS:
            update_data['analysis_started_at'] = datetime.utcnow()
        elif status == SampleStatus.COMPLETED:
            # Set completion timestamps for any unfinished stages
            sample = await self.get_sample(sample_id)
            if sample:
                if not sample.qc_completed_at:
                    update_data['qc_completed_at'] = datetime.utcnow()
                if not sample.library_prep_completed_at:
                    update_data['library_prep_completed_at'] = datetime.utcnow()
                if not sample.sequencing_completed_at:
                    update_data['sequencing_completed_at'] = datetime.utcnow()
                if sample.analysis_status != QCStatus.NOT_REQUIRED.value and not sample.analysis_completed_at:
                    update_data['analysis_completed_at'] = datetime.utcnow()
        
        return await self.update_sample(sample_id, update_data)
    
    async def delete_sample(self, sample_id: str) -> bool:
        """Delete a sample"""
        result = await self.db.execute(
            delete(NanoporeSample).where(NanoporeSample.id == sample_id)
        )
        
        if result.rowcount > 0:
            await self.db.commit()
            return True
        return False
    
    async def add_processing_step(
        self,
        sample_id: str,
        step_name: str,
        step_order: int,
        assigned_to: Optional[str] = None,
        estimated_duration_hours: Optional[int] = None
    ) -> NanoporeProcessingStep:
        """Add a processing step to a sample"""
        step_id = str(uuid.uuid4())
        
        step = NanoporeProcessingStep(
            id=step_id,
            sample_id=sample_id,
            step_name=step_name,
            step_order=step_order,
            assigned_to=assigned_to,
            estimated_duration_hours=estimated_duration_hours
        )
        
        self.db.add(step)
        await self.db.commit()
        await self.db.refresh(step)
        
        return step
    
    async def update_processing_step(
        self,
        step_id: str,
        update_data: Dict[str, Any]
    ) -> Optional[NanoporeProcessingStep]:
        """Update a processing step"""
        # Handle status changes
        if 'status' in update_data:
            if update_data['status'] == 'in_progress':
                update_data['started_at'] = datetime.utcnow()
            elif update_data['status'] == 'completed':
                update_data['completed_at'] = datetime.utcnow()
                
                # Calculate actual duration if started_at exists
                result = await self.db.execute(
                    select(NanoporeProcessingStep).where(NanoporeProcessingStep.id == step_id)
                )
                step = result.scalar_one_or_none()
                if step and step.started_at:
                    duration = (update_data['completed_at'] - step.started_at).total_seconds() / 3600
                    update_data['actual_duration_hours'] = duration
        
        update_data['updated_at'] = datetime.utcnow()
        
        await self.db.execute(
            update(NanoporeProcessingStep)
            .where(NanoporeProcessingStep.id == step_id)
            .values(**update_data)
        )
        
        await self.db.commit()
        
        # Return updated step
        result = await self.db.execute(
            select(NanoporeProcessingStep).where(NanoporeProcessingStep.id == step_id)
        )
        return result.scalar_one_or_none()
    
    async def add_sample_detail(
        self,
        sample_id: str,
        field_name: str,
        field_value: str,
        field_type: Optional[str] = None
    ) -> NanoporeSampleDetail:
        """Add a custom detail to a sample"""
        detail_id = str(uuid.uuid4())
        
        detail = NanoporeSampleDetail(
            id=detail_id,
            sample_id=sample_id,
            field_name=field_name,
            field_value=field_value,
            field_type=field_type
        )
        
        self.db.add(detail)
        await self.db.commit()
        await self.db.refresh(detail)
        
        return detail
    
    async def get_sample_statistics(self) -> Dict[str, Any]:
        """Get sample statistics"""
        # Count by status
        status_counts = {}
        for status in SampleStatus:
            result = await self.db.execute(
                select(func.count(NanoporeSample.id))
                .where(NanoporeSample.status == status.value)
            )
            status_counts[status.value] = result.scalar()
        
        # Count by QC status
        qc_status_counts = {}
        for qc_status in QCStatus:
            result = await self.db.execute(
                select(func.count(NanoporeSample.id))
                .where(NanoporeSample.qc_status == qc_status.value)
            )
            qc_status_counts[qc_status.value] = result.scalar()
        
        # Count by priority
        priority_counts = {}
        for priority in Priority:
            result = await self.db.execute(
                select(func.count(NanoporeSample.id))
                .where(NanoporeSample.priority == priority.value)
            )
            priority_counts[priority.value] = result.scalar()
        
        # Average turnaround time (completed samples only)
        turnaround_result = await self.db.execute(
            select(func.avg(
                func.extract('epoch', NanoporeSample.sequencing_completed_at - NanoporeSample.received_at) / 3600
            ))
            .where(NanoporeSample.status == SampleStatus.COMPLETED.value)
            .where(NanoporeSample.received_at.isnot(None))
            .where(NanoporeSample.sequencing_completed_at.isnot(None))
        )
        avg_turnaround_hours = turnaround_result.scalar() or 0
        
        return {
            "total_samples": sum(status_counts.values()),
            "status_breakdown": status_counts,
            "qc_status_breakdown": qc_status_counts,
            "priority_breakdown": priority_counts,
            "average_turnaround_hours": float(avg_turnaround_hours),
            "average_turnaround_days": float(avg_turnaround_hours) / 24
        } 