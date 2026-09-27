ALTER TABLE test_rows DROP CONSTRAINT test_rows_parent_id_fkey;

ALTER TABLE test_rows ADD CONSTRAINT test_rows_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES test_suites(suite_id) ON DELETE CASCADE;

ALTER TABLE shared_suites DROP CONSTRAINT shared_suites_suite_id_fkey;
ALTER TABLE shared_suites
    ADD CONSTRAINT shared_suites_suite_id_fkey
    FOREIGN KEY (suite_id) REFERENCES test_suites(suite_id) ON DELETE CASCADE;


ALTER TABLE test_suites DROP CONSTRAINT test_suites_owner_id_fkey;
ALTER TABLE test_suites
    ADD CONSTRAINT test_suites_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE shared_suites DROP CONSTRAINT shared_suites_user_id_fkey;
ALTER TABLE shared_suites
    ADD CONSTRAINT shared_suites_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE shared_suites DROP CONSTRAINT shared_suites_provider_id_fkey;
ALTER TABLE shared_suites
    ADD CONSTRAINT shared_suites_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES users(user_id) ON DELETE CASCADE;