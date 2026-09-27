CREATE TABLE users (
    user_id bigint generated always as identity primary key,
    username text not NULL,
    email text not NULL,
    password_hash text not NULL,
    github_user_id text unique not NULL,
    github_access_token text not NULL,
    github_refresh_token text not NULL,
    github_token_expires_at timestamptz,
    created_at timestamptz not NULL default NOW(),
    updated_at timestamptz not NULL default NOW()
);

CREATE TABLE test_suites(
    suite_id bigint generated always as identity primary key,
    suite_name text not NULL,
    owner_id bigint not NULL references users(user_id),
    suite_description text,
    created_at timestamptz not NULL default NOW(),
    updated_at timestamptz not NULL default NOW()
);

create type test_status as enum ('untested', 'in_progress', 'passed', 'failed');

CREATE TABLE test_rows(
    row_id bigint generated always as identity primary key,
    test_name text not NULL,
    parent_id bigint not NULL references test_suites(suite_id),
    test_description text not NULL,
    expected_output text not NULL,
    test_status test_status not NULL default 'untested',
    response_status smallint,
    response text,
    expected_response_status smallint not NULL,
    created_at timestamptz not NULL default NOW(),
    updated_at timestamptz not NULL default NOW()
);

create type access_scope as enum('read', 'write', 'admin');
CREATE TABLE shared_suites(
    sharing_id bigint generated always as identity primary key,
    user_id bigint not NULL references users(user_id),
    provider_id bigint not NULL references users(user_id),
    access_scope access_scope not NULL default 'read',
    created_at timestamptz not NULL default NOW(),
    updated_at timestamptz not NULL default NOW()
);