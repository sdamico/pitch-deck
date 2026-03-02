-- Add grant_dr flag to invite_links: when false, redemption skips data_room_access grant
ALTER TABLE invite_links ADD COLUMN grant_dr BOOLEAN NOT NULL DEFAULT true;
