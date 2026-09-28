CREATE TABLE pending_authorizations (
    correlation_id text PRIMARY KEY,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    code_challenge text NOT NULL,
    original_state text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE oauth_codes (
    code text PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    code_challenge text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW()
);