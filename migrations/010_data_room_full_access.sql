-- Add full_access flag to data_room_access.
-- When true, grants unrestricted access to all data room files (replaces the old
-- implicit full-access behaviour when view_id was NULL).
-- NULL view_id alone no longer grants access; full_access must be explicitly set.
ALTER TABLE data_room_access ADD COLUMN IF NOT EXISTS full_access BOOLEAN DEFAULT FALSE;
