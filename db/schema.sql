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

-- ========================================
-- VYBE NOTIFICATIONS
-- ========================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    recipient_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    actor_id UUID
        REFERENCES users(id) ON DELETE SET NULL,

    type VARCHAR(30) NOT NULL,

    post_id UUID
        REFERENCES posts(id) ON DELETE CASCADE,

    comment_id UUID
        REFERENCES comments(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    read_at TIMESTAMPTZ,

    CONSTRAINT notification_type_valid
        CHECK (
            type IN (
                'follow',
                'reaction',
                'comment',
                'repost'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
    ON notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
    ON notifications (recipient_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_actor
    ON notifications (actor_id);

-- ========================================
-- VYBE MEDIA
-- ========================================

CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    post_id UUID
        REFERENCES posts(id) ON DELETE CASCADE,

    media_type VARCHAR(10) NOT NULL,

    url TEXT NOT NULL,

    mime_type VARCHAR(100) NOT NULL,

    size_bytes BIGINT NOT NULL,

    width INTEGER,
    height INTEGER,
    duration_ms INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT media_type_valid
        CHECK (media_type IN ('image', 'video')),

    CONSTRAINT media_url_not_empty
        CHECK (char_length(btrim(url)) >= 1),

    CONSTRAINT media_mime_not_empty
        CHECK (char_length(btrim(mime_type)) >= 1),

    CONSTRAINT media_size_valid
        CHECK (size_bytes > 0),

    CONSTRAINT media_dimensions_valid
        CHECK (
            (width IS NULL AND height IS NULL)
            OR
            (width > 0 AND height > 0)
        ),

    CONSTRAINT media_duration_valid
        CHECK (
            duration_ms IS NULL
            OR duration_ms > 0
        )
);

CREATE INDEX IF NOT EXISTS idx_media_user_created
    ON media (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_post_created
    ON media (post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_media_type
    ON media (media_type);


-- ========================================
-- VYBE STORIES
-- ========================================

CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    media_id UUID NOT NULL
        REFERENCES media(id) ON DELETE CASCADE,

    caption VARCHAR(500) DEFAULT '',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL
        DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_stories_user_created
    ON stories (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stories_active
    ON stories (expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_stories_media
    ON stories (media_id);


-- ========================================
-- VYBE STORY VIEWS
-- ========================================

CREATE TABLE IF NOT EXISTS story_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    story_id UUID NOT NULL
        REFERENCES stories(id) ON DELETE CASCADE,

    viewer_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_story_view
        UNIQUE (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story
    ON story_views (story_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_story_views_viewer
    ON story_views (viewer_id, viewed_at DESC);
