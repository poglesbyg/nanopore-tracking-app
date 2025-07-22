-- Create migrations table for tracking applied migrations
CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    filename VARCHAR(255) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_by VARCHAR(255),
    execution_time_ms INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'completed',
    direction VARCHAR(10) NOT NULL DEFAULT 'up',
    error_message TEXT,
    rollback_version VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_migrations_version ON migrations(version);
CREATE INDEX idx_migrations_status ON migrations(status);
CREATE INDEX idx_migrations_applied_at ON migrations(applied_at DESC);

-- Create migration history table for audit trail
CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    migration_id INTEGER REFERENCES migrations(id),
    action VARCHAR(50) NOT NULL, -- applied, rolled_back, failed, etc.
    performed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    performed_by VARCHAR(255),
    details JSONB,
    error_message TEXT
);

-- Add comments
COMMENT ON TABLE migrations IS 'Tracks all database migrations applied to the system';
COMMENT ON COLUMN migrations.version IS 'Unique version identifier for the migration';
COMMENT ON COLUMN migrations.checksum IS 'SHA-256 hash of the migration file to detect changes';
COMMENT ON COLUMN migrations.status IS 'Current status: pending, running, completed, failed, rolled_back';
COMMENT ON COLUMN migrations.direction IS 'Migration direction: up (apply) or down (rollback)';

COMMENT ON TABLE migration_history IS 'Audit trail of all migration actions'; 