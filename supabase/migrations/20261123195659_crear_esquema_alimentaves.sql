-- Esquema usado por las rutas activas de FastAPI.
-- Se crea de forma aditiva: no elimina ni reemplaza objetos existentes.

CREATE TABLE IF NOT EXISTS public.auth_users (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'donor'
        CHECK (role IN ('donor', 'kitchen', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auth_revoked_tokens (
    jti UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auth_revoked_tokens_expires_idx
    ON public.auth_revoked_tokens(expires_at);

CREATE TABLE IF NOT EXISTS public.donations (
    id UUID PRIMARY KEY,
    donor_name VARCHAR(100) NOT NULL,
    food_name VARCHAR(120) NOT NULL,
    quantity_kg NUMERIC(10,2) NOT NULL CHECK (quantity_kg > 0),
    pickup_address VARCHAR(200) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    notes VARCHAR(500),
    status VARCHAR(12) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'reserved', 'delivered')),
    reserved_by VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS donations_status_idx
    ON public.donations(status);

CREATE TABLE IF NOT EXISTS public.community_kitchens (
    id BIGSERIAL PRIMARY KEY,
    source_object_id BIGINT,
    source_code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(254) NOT NULL,
    district VARCHAR(120) NOT NULL,
    ubigeo CHAR(6) NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    modality VARCHAR(120),
    source_status VARCHAR(120),
    users_count INTEGER CHECK (users_count IS NULL OR users_count >= 0),
    source_url TEXT NOT NULL,
    downloaded_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS community_kitchens_district_idx
    ON public.community_kitchens(district);
CREATE INDEX IF NOT EXISTS community_kitchens_name_idx
    ON public.community_kitchens(name);

CREATE TABLE IF NOT EXISTS public.community_kitchen_claims (
    id UUID PRIMARY KEY,
    kitchen_id BIGINT NOT NULL
        REFERENCES public.community_kitchens(id) ON DELETE RESTRICT,
    account_id UUID NOT NULL
        REFERENCES public.auth_users(id) ON DELETE CASCADE,
    status VARCHAR(12) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS community_kitchen_claims_pending_account_idx
    ON public.community_kitchen_claims(account_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS community_kitchen_claims_status_idx
    ON public.community_kitchen_claims(status, submitted_at);

CREATE TABLE IF NOT EXISTS public.community_kitchen_memberships (
    kitchen_id BIGINT NOT NULL
        REFERENCES public.community_kitchens(id) ON DELETE RESTRICT,
    account_id UUID NOT NULL
        REFERENCES public.auth_users(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL DEFAULT 'kitchen'
        CHECK (role = 'kitchen'),
    status VARCHAR(12) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
    approved_by UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (kitchen_id, account_id)
);
CREATE INDEX IF NOT EXISTS community_kitchen_memberships_account_idx
    ON public.community_kitchen_memberships(account_id, status);

CREATE TABLE IF NOT EXISTS public.community_kitchen_profiles (
    id UUID PRIMARY KEY,
    kitchen_id BIGINT NOT NULL
        REFERENCES public.community_kitchens(id) ON DELETE RESTRICT,
    description VARCHAR(2000),
    operating_hours VARCHAR(500),
    institutional_location VARCHAR(500),
    needs VARCHAR(2000),
    status VARCHAR(12) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'published', 'rejected')),
    submitted_by UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS community_kitchen_profiles_pending_idx
    ON public.community_kitchen_profiles(kitchen_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS community_kitchen_profiles_published_submitted_idx
    ON public.community_kitchen_profiles(kitchen_id, submitted_at DESC)
    WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.donation_requests (
    id UUID PRIMARY KEY,
    donation_id UUID NOT NULL REFERENCES public.donations(id) ON DELETE RESTRICT,
    kitchen_id BIGINT NOT NULL
        REFERENCES public.community_kitchens(id) ON DELETE RESTRICT,
    requested_by UUID NOT NULL
        REFERENCES public.auth_users(id) ON DELETE RESTRICT,
    status VARCHAR(12) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS donation_requests_pending_kitchen_idx
    ON public.donation_requests(donation_id, kitchen_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS donation_requests_approved_donation_idx
    ON public.donation_requests(donation_id) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS donation_requests_requester_history_idx
    ON public.donation_requests(requested_by, submitted_at DESC);
CREATE INDEX IF NOT EXISTS donation_requests_kitchen_history_idx
    ON public.donation_requests(kitchen_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
    notification_type VARCHAR(48) NOT NULL,
    title VARCHAR(160) NOT NULL,
    body VARCHAR(500) NOT NULL,
    related_type VARCHAR(48),
    related_id VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
    ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.community_kitchen_photos (
    id UUID PRIMARY KEY,
    kitchen_id BIGINT NOT NULL
        REFERENCES public.community_kitchens(id) ON DELETE RESTRICT,
    profile_id UUID NOT NULL
        REFERENCES public.community_kitchen_profiles(id) ON DELETE CASCADE,
    category VARCHAR(12) NOT NULL
        CHECK (category IN ('profile', 'cover', 'gallery', 'food')),
    file_path TEXT NOT NULL UNIQUE,
    content_type VARCHAR(32) NOT NULL
        CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    status VARCHAR(12) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'published', 'rejected')),
    uploaded_by UUID NOT NULL REFERENCES public.auth_users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES public.auth_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS community_kitchen_photos_public_idx
    ON public.community_kitchen_photos(kitchen_id, category, uploaded_at DESC)
    WHERE status = 'published';
CREATE INDEX IF NOT EXISTS community_kitchen_photos_review_idx
    ON public.community_kitchen_photos(status, uploaded_at);

-- FastAPI conserva la autenticación JWT propia y usa conexión PostgreSQL privada.
-- La Data API de Supabase no recibe permisos para estas tablas.
ALTER TABLE public.auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_revoked_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_kitchens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_kitchen_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_kitchen_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_kitchen_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_kitchen_photos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.auth_users,
    public.auth_revoked_tokens,
    public.donations,
    public.community_kitchens,
    public.community_kitchen_claims,
    public.community_kitchen_memberships,
    public.community_kitchen_profiles,
    public.donation_requests,
    public.notifications,
    public.community_kitchen_photos
FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.community_kitchens_id_seq FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;
