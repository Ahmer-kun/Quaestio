-- Admin: members list.
-- Nothing is inserted into public.admins here; accounts are managed from /admin.
-- Follows the same private (SECURITY DEFINER) + public (SECURITY INVOKER) pattern.

-- Admin: members list --------------------------------------------------------

CREATE OR REPLACE FUNCTION private.admin_members(p_search text DEFAULT NULL, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 100));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_pattern text;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  v_pattern := CASE
    WHEN nullif(trim(p_search), '') IS NULL THEN NULL
    ELSE '%' || replace(replace(replace(trim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  END;

  RETURN (
    SELECT jsonb_build_object(
      'total', (
        SELECT count(*) FROM public.profiles p
        WHERE v_pattern IS NULL OR p.username ILIKE v_pattern ESCAPE '\'
      ),
      'members', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', m.id,
          'username', m.username,
          'created_at', m.created_at,
          'banned', m.ban_id IS NOT NULL,
          'ban_id', m.ban_id,
          'is_admin', m.is_admin
        ) ORDER BY m.created_at DESC), '[]'::jsonb)
        FROM (
          SELECT p.id, p.username, p.created_at, b.id AS ban_id,
                 EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p.id) AS is_admin
          FROM public.profiles p
          LEFT JOIN public.bans b ON b.user_id = p.id
          WHERE v_pattern IS NULL OR p.username ILIKE v_pattern ESCAPE '\'
          ORDER BY p.created_at DESC
          LIMIT v_limit OFFSET v_offset
        ) m
      )
    )
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_members(p_search text DEFAULT NULL, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.admin_members(p_search, p_limit, p_offset) $$;

-- Admin: direct account bans ------------------------------------------------

CREATE OR REPLACE FUNCTION private.admin_ban_user(p_user uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing uuid;
  new_id uuid;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_user IS NULL THEN RAISE EXCEPTION 'Invalid member'; END IF;
  IF p_reason IS NOT NULL AND char_length(p_reason) > 500 THEN RAISE EXCEPTION 'Reason is too long'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user) THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p_user) THEN RAISE EXCEPTION 'Cannot restrict an administrator'; END IF;

  SELECT id INTO existing FROM public.bans WHERE user_id = p_user;
  IF existing IS NOT NULL THEN RETURN existing; END IF;

  INSERT INTO public.bans (user_id, reason, banned_by)
  VALUES (p_user, nullif(trim(p_reason), ''), auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO public.moderation_log (admin_id, action, target_type, target_id, note)
  VALUES (auth.uid(), 'ban_user', 'user', p_user, nullif(trim(p_reason), ''));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_ban_user(p_user uuid, p_reason text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$ SELECT private.admin_ban_user(p_user, p_reason) $$;

-- Admin: bans list (now with the restricted username) ------------------------

CREATE OR REPLACE FUNCTION private.admin_bans()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object('ban_id', b.id, 'username', p.username, 'reason', b.reason, 'banned_at', b.banned_at) ORDER BY b.banned_at DESC), '[]'::jsonb)
    FROM public.bans b
    JOIN public.profiles p ON p.id = b.user_id
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_bans()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.admin_bans() $$;

-- Function grants ------------------------------------------------------------

REVOKE ALL ON FUNCTION private.admin_members(text, integer, integer), private.admin_ban_user(uuid, text), private.admin_bans() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.admin_members(text, integer, integer), private.admin_ban_user(uuid, text), private.admin_bans() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_members(text, integer, integer), public.admin_ban_user(uuid, text), public.admin_bans() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_members(text, integer, integer), public.admin_ban_user(uuid, text), public.admin_bans() TO authenticated;
