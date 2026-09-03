CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username VARCHAR(30) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    display_name VARCHAR(80) NOT NULL,
    bio VARCHAR(160) DEFAULT '',
    avatar_url TEXT,

    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT username_length CHECK (char_length(username) >= 3),
    CONSTRAINT email_length CHECK (char_length(email) >= 5)
);

CREATE INDEX IF NOT EXISTS idx_users_username
    ON users (username);

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (email);

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT post_content_length
        CHECK (char_length(btrim(content)) >= 1),

    CONSTRAINT post_content_max_length
        CHECK (char_length(content) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_posts_user_created
    ON posts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_created
    ON posts (created_at DESC);


CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    post_id UUID NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    reaction_type VARCHAR(20) NOT NULL DEFAULT 'like',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reaction_type_not_empty
        CHECK (char_length(btrim(reaction_type)) >= 1),

    CONSTRAINT reaction_type_max_length
        CHECK (char_length(reaction_type) <= 20),

    CONSTRAINT unique_user_post_reaction
        UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_post
    ON reactions (post_id);

CREATE INDEX IF NOT EXISTS idx_reactions_user
    ON reactions (user_id);


-- =========================================
-- COMMENTS
-- =========================================

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    post_id UUID NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT comment_content_not_empty
        CHECK (char_length(btrim(content)) >= 1),

    CONSTRAINT comment_content_max_length
        CHECK (char_length(content) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_comments_post_created
    ON comments (post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_comments_user_created
    ON comments (user_id, created_at DESC);


-- =========================================
-- REPOSTS
-- =========================================

CREATE TABLE IF NOT EXISTS reposts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    post_id UUID NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_user_post_repost
        UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reposts_post_created
    ON reposts (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reposts_user_created
    ON reposts (user_id, created_at DESC);


-- =========================================
-- SAVED POSTS
-- =========================================

CREATE TABLE IF NOT EXISTS saves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    post_id UUID NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_user_post_save
        UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_saves_post_created
    ON saves (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saves_user_created
    ON saves (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT no_self_follow CHECK (follower_id <> following_id),
    CONSTRAINT unique_follow UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower
    ON follows (follower_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_follows_following
    ON follows (following_id, created_at DESC);

/*
 * Reports
 */
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    details VARCHAR(500) DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT report_reason_not_empty
        CHECK (char_length(btrim(reason)) >= 1),

    CONSTRAINT report_status_valid
        CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),

    CONSTRAINT unique_pending_post_report
        UNIQUE (reporter_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_post
    ON reports (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_reporter
    ON reports (reporter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_status
    ON reports (status, created_at DESC);
