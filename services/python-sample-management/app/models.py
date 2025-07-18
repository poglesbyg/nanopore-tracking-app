"""
Database Models for Nanopore Submission and Sample Tracking
Comprehensive schema with all PDF fields as discrete columns
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, DateTime, Integer, Float, Boolean, Text, ForeignKey, JSON
from datetime import datetime
from enum import Enum
from typing import Optional, List

class Base(DeclarativeBase):
    pass

# Enums
class SubmissionStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    RECEIVED = "received"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"

class SampleStatus(str, Enum):
    SUBMITTED = "submitted"
    RECEIVED = "received"
    QC_IN_PROGRESS = "qc_in_progress"
    QC_PASSED = "qc_passed"
    QC_FAILED = "qc_failed"
    LIBRARY_PREP = "library_prep"
    SEQUENCING = "sequencing"
    ANALYSIS = "analysis"
    COMPLETED = "completed"
    FAILED = "failed"
    ON_HOLD = "on_hold"

class QCStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    CONDITIONAL = "conditional"
    NOT_REQUIRED = "not_required"

class Priority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"
    RUSH = "rush"

class SampleType(str, Enum):
    DNA = "dna"
    RNA = "rna"
    CDNA = "cdna"
    AMPLICON = "amplicon"
    METAGENOME = "metagenome"
    OTHER = "other"

class SequencingPlatform(str, Enum):
    PROMETHION = "promethion"
    GRIDION = "gridion"
    MINION = "minion"
    FLONGLE = "flongle"

class DataDeliveryMethod(str, Enum):
    BASESPACE = "basespace"
    HARD_DRIVE = "hard_drive"
    CLOUD_STORAGE = "cloud_storage"
    FTP = "ftp"
    DIRECT_DOWNLOAD = "direct_download"

# Models
class NanoporeSubmission(Base):
    """Submission table - one submission can have multiple samples"""
    __tablename__ = "nanopore_submissions"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    
    # Submission metadata
    submission_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)  # e.g., "HTSF-JL-147"
    submission_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    pdf_filename: Mapped[Optional[str]] = mapped_column(String(255))
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500))
    
    # Submitter information
    submitter_name: Mapped[str] = mapped_column(String(255), nullable=False)
    submitter_email: Mapped[str] = mapped_column(String(255), nullable=False)
    submitter_phone: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Organization information
    organization_name: Mapped[Optional[str]] = mapped_column(String(255))
    department: Mapped[Optional[str]] = mapped_column(String(255))
    lab_name: Mapped[Optional[str]] = mapped_column(String(255))
    pi_name: Mapped[Optional[str]] = mapped_column(String(255))  # Principal Investigator
    
    # Project information
    project_id: Mapped[Optional[str]] = mapped_column(String(100))  # Service Project ID from iLab
    project_name: Mapped[Optional[str]] = mapped_column(String(255))
    grant_number: Mapped[Optional[str]] = mapped_column(String(100))
    po_number: Mapped[Optional[str]] = mapped_column(String(100))  # Purchase Order
    
    # Billing information
    billing_contact_name: Mapped[Optional[str]] = mapped_column(String(255))
    billing_contact_email: Mapped[Optional[str]] = mapped_column(String(255))
    billing_address: Mapped[Optional[str]] = mapped_column(Text)
    account_number: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Service requirements
    service_type: Mapped[Optional[str]] = mapped_column(String(100))  # e.g., "Full Service", "Library Prep Only"
    sequencing_platform: Mapped[Optional[str]] = mapped_column(String(50))
    estimated_samples: Mapped[Optional[int]] = mapped_column(Integer)
    priority: Mapped[str] = mapped_column(String(10), default=Priority.NORMAL.value)
    
    # Special requirements
    special_instructions: Mapped[Optional[str]] = mapped_column(Text)
    hazardous_materials: Mapped[bool] = mapped_column(Boolean, default=False)
    hazard_details: Mapped[Optional[str]] = mapped_column(Text)
    
    # Data delivery
    data_delivery_method: Mapped[Optional[str]] = mapped_column(String(50))
    data_retention_days: Mapped[Optional[int]] = mapped_column(Integer, default=30)
    
    # Processing preferences
    demultiplexing_required: Mapped[bool] = mapped_column(Boolean, default=True)
    basecalling_required: Mapped[bool] = mapped_column(Boolean, default=True)
    alignment_required: Mapped[bool] = mapped_column(Boolean, default=False)
    analysis_required: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Status tracking
    status: Mapped[str] = mapped_column(String(20), default=SubmissionStatus.DRAFT.value)
    received_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # User tracking
    created_by: Mapped[Optional[str]] = mapped_column(String(255))
    updated_by: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Relationships
    samples: Mapped[List["NanoporeSample"]] = relationship(back_populates="submission", cascade="all, delete-orphan")
    attachments: Mapped[List["NanoporeAttachment"]] = relationship(back_populates="submission", cascade="all, delete-orphan")


class NanoporeSample(Base):
    """Sample table - individual samples within a submission"""
    __tablename__ = "nanopore_samples"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    submission_id: Mapped[str] = mapped_column(String, ForeignKey("nanopore_submissions.id"), nullable=False)
    
    # Sample identification
    sample_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sample_id: Mapped[Optional[str]] = mapped_column(String(100))  # Customer's internal ID
    barcode: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Sample type and source
    sample_type: Mapped[str] = mapped_column(String(50), nullable=False)
    organism: Mapped[Optional[str]] = mapped_column(String(255))
    strain: Mapped[Optional[str]] = mapped_column(String(255))
    tissue_type: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Sample properties
    concentration: Mapped[Optional[float]] = mapped_column(Float)  # ng/μL
    concentration_method: Mapped[Optional[str]] = mapped_column(String(100))  # e.g., "Qubit", "NanoDrop"
    volume: Mapped[Optional[float]] = mapped_column(Float)  # μL
    total_amount: Mapped[Optional[float]] = mapped_column(Float)  # ng
    buffer: Mapped[Optional[str]] = mapped_column(String(100))
    
    # Quality metrics
    a260_280: Mapped[Optional[float]] = mapped_column(Float)
    a260_230: Mapped[Optional[float]] = mapped_column(Float)
    rin_score: Mapped[Optional[float]] = mapped_column(Float)  # RNA Integrity Number
    dv200: Mapped[Optional[float]] = mapped_column(Float)  # Percentage of fragments > 200nt
    
    # Library prep details
    library_prep_kit: Mapped[Optional[str]] = mapped_column(String(255))
    library_prep_method: Mapped[Optional[str]] = mapped_column(String(255))
    fragmentation_method: Mapped[Optional[str]] = mapped_column(String(255))
    size_selection: Mapped[Optional[str]] = mapped_column(String(100))
    amplification_cycles: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Sequencing parameters
    flow_cell_type: Mapped[Optional[str]] = mapped_column(String(50))
    flow_cell_count: Mapped[int] = mapped_column(Integer, default=1)
    read_length: Mapped[Optional[str]] = mapped_column(String(50))
    coverage_target: Mapped[Optional[float]] = mapped_column(Float)
    
    # Barcoding
    barcode_kit: Mapped[Optional[str]] = mapped_column(String(100))
    barcode_sequence: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Reference genome
    reference_genome: Mapped[Optional[str]] = mapped_column(String(255))
    reference_version: Mapped[Optional[str]] = mapped_column(String(50))
    
    # Special handling
    priority: Mapped[str] = mapped_column(String(10), default=Priority.NORMAL.value)
    hazardous: Mapped[bool] = mapped_column(Boolean, default=False)
    special_handling: Mapped[Optional[str]] = mapped_column(Text)
    
    # Status tracking
    status: Mapped[str] = mapped_column(String(20), default=SampleStatus.SUBMITTED.value)
    qc_status: Mapped[str] = mapped_column(String(20), default=QCStatus.PENDING.value)
    library_prep_status: Mapped[str] = mapped_column(String(20), default=QCStatus.PENDING.value)
    sequencing_status: Mapped[str] = mapped_column(String(20), default=QCStatus.PENDING.value)
    analysis_status: Mapped[str] = mapped_column(String(20), default=QCStatus.NOT_REQUIRED.value)
    
    # Assignment tracking
    assigned_to: Mapped[Optional[str]] = mapped_column(String(255))
    qc_by: Mapped[Optional[str]] = mapped_column(String(255))
    library_prep_by: Mapped[Optional[str]] = mapped_column(String(255))
    sequencing_by: Mapped[Optional[str]] = mapped_column(String(255))
    
    # Results
    qc_passed: Mapped[Optional[bool]] = mapped_column(Boolean)
    qc_notes: Mapped[Optional[str]] = mapped_column(Text)
    library_yield: Mapped[Optional[float]] = mapped_column(Float)  # ng
    library_size: Mapped[Optional[int]] = mapped_column(Integer)  # bp
    reads_generated: Mapped[Optional[int]] = mapped_column(Integer)
    bases_generated: Mapped[Optional[int]] = mapped_column(Integer)
    mean_read_length: Mapped[Optional[float]] = mapped_column(Float)
    mean_quality_score: Mapped[Optional[float]] = mapped_column(Float)
    
    # Timestamps
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    qc_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    qc_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    library_prep_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    library_prep_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    sequencing_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    sequencing_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    analysis_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    analysis_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Additional data (JSON for flexibility)
    custom_fields: Mapped[Optional[dict]] = mapped_column(JSON)
    
    # Relationships
    submission: Mapped["NanoporeSubmission"] = relationship(back_populates="samples")
    processing_steps: Mapped[List["NanoporeProcessingStep"]] = relationship(back_populates="sample", cascade="all, delete-orphan")
    sample_details: Mapped[List["NanoporeSampleDetail"]] = relationship(back_populates="sample", cascade="all, delete-orphan")


class NanoporeProcessingStep(Base):
    """Processing steps for each sample"""
    __tablename__ = "nanopore_processing_steps"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    sample_id: Mapped[str] = mapped_column(String, ForeignKey("nanopore_samples.id"), nullable=False)
    
    step_name: Mapped[str] = mapped_column(String(100), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    
    assigned_to: Mapped[Optional[str]] = mapped_column(String(255))
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    estimated_duration_hours: Mapped[Optional[int]] = mapped_column(Integer)
    actual_duration_hours: Mapped[Optional[float]] = mapped_column(Float)
    
    notes: Mapped[Optional[str]] = mapped_column(Text)
    results: Mapped[Optional[dict]] = mapped_column(JSON)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    sample: Mapped["NanoporeSample"] = relationship(back_populates="processing_steps")


class NanoporeSampleDetail(Base):
    """Additional sample details from PDF forms"""
    __tablename__ = "nanopore_sample_details"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    sample_id: Mapped[str] = mapped_column(String, ForeignKey("nanopore_samples.id"), nullable=False)
    
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    field_value: Mapped[Optional[str]] = mapped_column(Text)
    field_type: Mapped[Optional[str]] = mapped_column(String(50))  # text, number, date, boolean
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    sample: Mapped["NanoporeSample"] = relationship(back_populates="sample_details")


class NanoporeAttachment(Base):
    """File attachments for submissions"""
    __tablename__ = "nanopore_attachments"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    submission_id: Mapped[str] = mapped_column(String, ForeignKey("nanopore_submissions.id"), nullable=False)
    
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)  # bytes
    
    description: Mapped[Optional[str]] = mapped_column(Text)
    uploaded_by: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    submission: Mapped["NanoporeSubmission"] = relationship(back_populates="attachments") 