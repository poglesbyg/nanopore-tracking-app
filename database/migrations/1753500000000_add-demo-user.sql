-- Add demo user for ultra-minimal mode (no authentication)
-- This user is used when creating samples without authentication

INSERT INTO users (id, email, name, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'demo@nanopore-tracking.local',
  'Demo User',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING; 