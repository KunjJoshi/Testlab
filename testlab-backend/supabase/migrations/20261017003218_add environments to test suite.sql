CREATE TABLE environment (
    environment_id bigint generated always as identity primary key,
    slug text not null,
    user_id bigint references users(user_id),
    created_at timestamptz not null default now()
);

ALTER TABLE test_suites
ADD COLUMN environment_id bigint REFERENCES environment(environment_id);