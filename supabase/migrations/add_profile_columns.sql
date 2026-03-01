-- Add profile columns to bettermate_users table
ALTER TABLE bettermate_users
ADD COLUMN bio TEXT,
ADD COLUMN interests TEXT[] DEFAULT '{}',
ADD COLUMN location TEXT,
ADD COLUMN profile_picture_url TEXT,
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on updated_at for sorting
CREATE INDEX idx_bettermate_users_updated_at ON bettermate_users(updated_at DESC);
