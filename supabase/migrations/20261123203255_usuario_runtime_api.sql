-- Rol privado del backend FastAPI; la credencial se fija fuera del repositorio.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'alimentaves_api') THEN
        CREATE ROLE alimentaves_api LOGIN
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
    ELSE
        ALTER ROLE alimentaves_api LOGIN
            NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
    END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
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
TO alimentaves_api;
GRANT USAGE, SELECT ON SEQUENCE public.community_kitchens_id_seq TO alimentaves_api;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'auth_users',
        'auth_revoked_tokens',
        'donations',
        'community_kitchens',
        'community_kitchen_claims',
        'community_kitchen_memberships',
        'community_kitchen_profiles',
        'donation_requests',
        'notifications',
        'community_kitchen_photos'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = table_name
              AND policyname = 'alimentaves_api_access'
        ) THEN
            EXECUTE format(
                'CREATE POLICY alimentaves_api_access ON public.%I '
                'FOR ALL TO alimentaves_api USING (true) WITH CHECK (true)',
                table_name
            );
        END IF;
    END LOOP;
END
$$;
