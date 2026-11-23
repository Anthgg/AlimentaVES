-- Índices completos para claves foráneas usadas fuera de los subconjuntos parciales.
CREATE INDEX IF NOT EXISTS community_kitchen_claims_account_id_idx
    ON public.community_kitchen_claims(account_id);
CREATE INDEX IF NOT EXISTS community_kitchen_profiles_kitchen_id_idx
    ON public.community_kitchen_profiles(kitchen_id);
CREATE INDEX IF NOT EXISTS donation_requests_donation_id_idx
    ON public.donation_requests(donation_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx
    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS community_kitchen_photos_kitchen_id_idx
    ON public.community_kitchen_photos(kitchen_id);
