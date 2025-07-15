-- Nanopore Tracking Database Backup
-- Generated: 2025-07-15T15:14:39.099Z
-- Database: nanopore_tracking

-- Table: users
-- Schema for users

-- Data for users
INSERT INTO users VALUES ('00000000-0000-0000-0000-000000000000', 'system@nanopore.local', 'System', 'Tue Jul 15 2025 09:25:52 GMT-0400 (Eastern Daylight Time)', 'Tue Jul 15 2025 09:25:52 GMT-0400 (Eastern Daylight Time)');

-- Table: nanopore_samples
-- Schema for nanopore_samples

-- Data for nanopore_samples
INSERT INTO nanopore_samples VALUES ('4b240e2b-0ce3-4970-a412-763352cd13bc', 'Test Sample', NULL, 'Test User', 'test@example.com', NULL, 'DNA', NULL, NULL, NULL, NULL, NULL, '1', 'submitted', 'normal', NULL, NULL, 'NANO-001', 'Tue Jul 15 2025 09:26:39 GMT-0400 (Eastern Daylight Time)', NULL, NULL, 'Tue Jul 15 2025 09:26:39 GMT-0400 (Eastern Daylight Time)', 'Tue Jul 15 2025 09:26:39 GMT-0400 (Eastern Daylight Time)', '00000000-0000-0000-0000-000000000000');
INSERT INTO nanopore_samples VALUES ('c37d4309-a08d-4c13-9870-3ccae12184cc', 'Test Sample 2', NULL, 'John Doe', 'john@example.com', NULL, 'DNA', NULL, NULL, NULL, NULL, NULL, '1', 'submitted', 'normal', NULL, NULL, 'NANO-002', 'Tue Jul 15 2025 09:52:48 GMT-0400 (Eastern Daylight Time)', NULL, NULL, 'Tue Jul 15 2025 09:52:48 GMT-0400 (Eastern Daylight Time)', 'Tue Jul 15 2025 09:52:48 GMT-0400 (Eastern Daylight Time)', '00000000-0000-0000-0000-000000000000');
INSERT INTO nanopore_samples VALUES ('d0f6978f-c9e6-45e4-aff1-143661a254d7', 'Structured Logging Test', NULL, 'Test User', 'test@example.com', NULL, 'DNA', NULL, NULL, NULL, NULL, NULL, '1', 'submitted', 'normal', NULL, NULL, 'NANO-003', 'Tue Jul 15 2025 10:30:11 GMT-0400 (Eastern Daylight Time)', NULL, NULL, 'Tue Jul 15 2025 10:30:11 GMT-0400 (Eastern Daylight Time)', 'Tue Jul 15 2025 10:30:11 GMT-0400 (Eastern Daylight Time)', '00000000-0000-0000-0000-000000000000');
INSERT INTO nanopore_samples VALUES ('1493c464-6fad-41fb-a39b-7bfe2d8151ee', 'Monitoring Test Sample', NULL, 'Monitoring User', 'monitor@example.com', NULL, 'RNA', NULL, NULL, NULL, NULL, NULL, '1', 'prep', 'normal', NULL, NULL, 'NANO-004', 'Tue Jul 15 2025 10:34:36 GMT-0400 (Eastern Daylight Time)', 'Tue Jul 15 2025 10:53:33 GMT-0400 (Eastern Daylight Time)', NULL, 'Tue Jul 15 2025 10:34:36 GMT-0400 (Eastern Daylight Time)', 'Tue Jul 15 2025 10:53:33 GMT-0400 (Eastern Daylight Time)', '00000000-0000-0000-0000-000000000000');
INSERT INTO nanopore_samples VALUES ('cd51a497-39af-4b88-8f9d-4788232228dc', 'DB Pool Test', NULL, 'Pool Test User', 'pool@test.com', NULL, 'DNA', NULL, NULL, NULL, NULL, NULL, '1', 'sequencing', 'normal', NULL, NULL, 'NANO-005', 'Tue Jul 15 2025 10:38:17 GMT-0400 (Eastern Daylight Time)', 'Tue Jul 15 2025 10:53:31 GMT-0400 (Eastern Daylight Time)', NULL, 'Tue Jul 15 2025 10:38:17 GMT-0400 (Eastern Daylight Time)', 'Tue Jul 15 2025 10:56:18 GMT-0400 (Eastern Daylight Time)', '00000000-0000-0000-0000-000000000000');

-- Table: nanopore_sample_details
-- Schema for nanopore_sample_details

-- Table: nanopore_processing_steps
-- Schema for nanopore_processing_steps

-- Table: nanopore_attachments
-- Schema for nanopore_attachments
