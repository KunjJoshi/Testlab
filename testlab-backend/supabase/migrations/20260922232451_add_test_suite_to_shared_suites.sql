-- add the missing FK to shared_suites
ALTER TABLE shared_suites
    ADD COLUMN suite_id bigint NOT NULL REFERENCES test_suites(suite_id);

-- make password_hash nullable (no local auth path exists yet)
ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

-- make github_refresh_token nullable (classic OAuth Apps never populate it)
ALTER TABLE users
    ALTER COLUMN github_refresh_token DROP NOT NULL;