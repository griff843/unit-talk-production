-- Initialize Temporal Database and User
-- This script runs during PostgreSQL container initialization

-- Create temporal user
CREATE USER temporal WITH PASSWORD 'temporal';

-- Create temporal database
CREATE DATABASE temporal OWNER temporal;

-- Grant necessary privileges
GRANT ALL PRIVILEGES ON DATABASE temporal TO temporal;

-- Create visibility database for Temporal
CREATE DATABASE temporal_visibility OWNER temporal;
GRANT ALL PRIVILEGES ON DATABASE temporal_visibility TO temporal;

-- Connect to temporal database and set up schema permissions
\c temporal;
GRANT ALL ON SCHEMA public TO temporal;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO temporal;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO temporal;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO temporal;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO temporal;

-- Connect to visibility database and set up schema permissions
\c temporal_visibility;
GRANT ALL ON SCHEMA public TO temporal;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO temporal;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO temporal;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO temporal;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO temporal;

-- Switch back to main database
\c unit_talk_dev;