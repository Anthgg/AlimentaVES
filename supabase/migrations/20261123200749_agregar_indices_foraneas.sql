-- Indices pour les clés étrangères signalées par l'advisor Supabase.
CREATE INDEX IF NOT EXISTS auth_revoked_tokens_user_id_idx
    ON public.auth_revoked_tokens(user_id);
CREATE INDEX IF NOT EXISTS community_kitchen_claims_kitchen_id_idx
    ON public.community_kitchen_claims(kitchen_id);
CREATE INDEX IF NOT EXISTS community_kitchen_claims_reviewed_by_idx
    ON public.community_kitchen_claims(reviewed_by);
CREATE INDEX IF NOT EXISTS community_kitchen_memberships_approved_by_idx
    ON public.community_kitchen_memberships(approved_by);
CREATE INDEX IF NOT EXISTS community_kitchen_photos_profile_id_idx
    ON public.community_kitchen_photos(profile_id);
CREATE INDEX IF NOT EXISTS community_kitchen_photos_reviewed_by_idx
    ON public.community_kitchen_photos(reviewed_by);
CREATE INDEX IF NOT EXISTS community_kitchen_photos_uploaded_by_idx
    ON public.community_kitchen_photos(uploaded_by);
CREATE INDEX IF NOT EXISTS community_kitchen_profiles_reviewed_by_idx
    ON public.community_kitchen_profiles(reviewed_by);
CREATE INDEX IF NOT EXISTS community_kitchen_profiles_submitted_by_idx
    ON public.community_kitchen_profiles(submitted_by);
CREATE INDEX IF NOT EXISTS donation_requests_reviewed_by_idx
    ON public.donation_requests(reviewed_by);
