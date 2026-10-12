-- Admin & moderation system.
-- Nothing is inserted into public.admins here: seed your own admin row by hand
-- in the Supabase SQL Editor before using the moderation tools.

-- Tables ---------------------------------------------------------------------
-- Every new table: RLS on, no policies (service_role only), default grants to
-- anon/authenticated explicitly revoked.

CREATE TABLE public.admins (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admins FROM anon, authenticated;
GRANT ALL ON public.admins TO service_role;

CREATE TABLE public.bans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
 banned_at timestamptz NOT NULL DEFAULT now(),
 banned_by uuid
);
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bans FROM anon, authenticated;
GRANT ALL ON public.bans TO service_role;

CREATE TABLE public.reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 target_type text NOT NULL CHECK (target_type IN ('post', 'comment')),
 target_id uuid NOT NULL,
 reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 category text NOT NULL CHECK (category IN ('harassment', 'spam', 'hate', 'unsafe_content', 'someone_at_risk', 'other')),
 note text CHECK (note IS NULL OR char_length(note) <= 500),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (target_type, target_id, reporter_id)
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reports FROM anon, authenticated;
GRANT ALL ON public.reports TO service_role;
CREATE INDEX reports_status_time_idx ON public.reports (status, created_at DESC);
CREATE INDEX reports_target_idx ON public.reports (target_type, target_id);

CREATE TABLE public.moderation_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 admin_id uuid,
 action text NOT NULL,
 target_type text,
 target_id uuid,
 note text,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_log FROM anon, authenticated;
GRANT ALL ON public.moderation_log TO service_role;

-- Authorization helpers ------------------------------------------------------

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.is_admin() $$;

CREATE OR REPLACE FUNCTION private.is_banned(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.bans b WHERE b.user_id = uid);
$$;

CREATE OR REPLACE FUNCTION private.am_i_banned()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.is_banned(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.am_i_banned()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.am_i_banned() $$;

-- Member reporting -----------------------------------------------------------

CREATE OR REPLACE FUNCTION private.report_content(p_type text, p_target uuid, p_category text, p_note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  changed integer;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF private.is_banned(me) THEN RAISE EXCEPTION 'Account restricted'; END IF;
  IF p_type NOT IN ('post', 'comment') THEN RAISE EXCEPTION 'Invalid target'; END IF;
  IF p_category NOT IN ('harassment', 'spam', 'hate', 'unsafe_content', 'someone_at_risk', 'other') THEN RAISE EXCEPTION 'Invalid category'; END IF;
  IF p_note IS NOT NULL AND char_length(p_note) > 500 THEN RAISE EXCEPTION 'Note is too long'; END IF;

  IF p_type = 'post' THEN
    IF NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = p_target) THEN RAISE EXCEPTION 'This content is no longer available'; END IF;
    IF EXISTS (SELECT 1 FROM public.posts p WHERE p.id = p_target AND p.author_id = me) THEN RAISE EXCEPTION 'You cannot report your own content'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.comments c WHERE c.id = p_target) THEN RAISE EXCEPTION 'This content is no longer available'; END IF;
    IF EXISTS (SELECT 1 FROM public.comments c WHERE c.id = p_target AND c.author_id = me) THEN RAISE EXCEPTION 'You cannot report your own content'; END IF;
  END IF;

  IF (SELECT count(*) FROM public.reports r WHERE r.reporter_id = me AND r.created_at > now() - interval '24 hours') >= 20 THEN
    RAISE EXCEPTION 'You have reached the report limit for now. Please try again later.';
  END IF;

  INSERT INTO public.reports (target_type, target_id, reporter_id, category, note)
  VALUES (p_type, p_target, me, p_category, nullif(trim(p_note), ''))
  ON CONFLICT (target_type, target_id, reporter_id) DO NOTHING;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END $$;

CREATE OR REPLACE FUNCTION public.report_content(p_type text, p_target uuid, p_category text, p_note text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT private.report_content(p_type, p_target, p_category, p_note)
$$;

-- Admin: stats ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.admin_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN (
    SELECT jsonb_build_object(
      'total_users', (SELECT count(*) FROM public.profiles),
      'new_users_today', (SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('day', now())),
      'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
      'signups_by_day', (
        SELECT coalesce(jsonb_agg(jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD'), 'count', coalesce(c.cnt, 0)) ORDER BY d.day), '[]'::jsonb)
        FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') AS d(day)
        LEFT JOIN (
          SELECT date_trunc('day', created_at) AS day, count(*) AS cnt
          FROM public.profiles
          WHERE created_at >= date_trunc('day', now()) - interval '13 days'
          GROUP BY 1
        ) c ON c.day = d.day
      ),
      'total_posts', (SELECT count(*) FROM public.posts),
      'total_comments', (SELECT count(*) FROM public.comments),
      'posts_7d', (SELECT count(*) FROM public.posts WHERE created_at >= now() - interval '7 days'),
      'comments_7d', (SELECT count(*) FROM public.comments WHERE created_at >= now() - interval '7 days'),
      'banned_count', (SELECT count(*) FROM public.bans),
      'open_reports', (
        SELECT count(*) FROM public.reports r
        WHERE r.status = 'open' AND (
          (r.target_type = 'post' AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = r.target_id)) OR
          (r.target_type = 'comment' AND EXISTS (SELECT 1 FROM public.comments c WHERE c.id = r.target_id))
        )
      )
    )
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.admin_stats() $$;

-- Admin: reports queue -------------------------------------------------------

CREATE OR REPLACE FUNCTION private.admin_reports(p_status text DEFAULT 'open')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('open', 'dismissed', 'actioned') THEN RAISE EXCEPTION 'Invalid status'; END IF;

  RETURN (
    WITH grouped AS (
      SELECT
        r.target_type,
        r.target_id,
        (array_agg(r.id ORDER BY r.created_at DESC))[1] AS report_id,
        bool_or(r.category = 'someone_at_risk') AS is_risk,
        min(r.created_at) AS created_at,
        jsonb_agg(jsonb_build_object('category', r.category, 'note', r.note, 'status', r.status) ORDER BY r.created_at) AS reports
      FROM public.reports r
      WHERE r.status = p_status
      GROUP BY r.target_type, r.target_id
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', g.report_id,
      'target_type', g.target_type,
      'target_id', g.target_id,
      'preview', CASE
        WHEN g.target_type = 'post' THEN jsonb_build_object('question', p.question, 'story', p.story)
        ELSE jsonb_build_object('question', pp.question, 'story', c.body)
      END,
      'report_count', (SELECT count(*) FROM public.reports r2 WHERE r2.target_type = g.target_type AND r2.target_id = g.target_id),
      'reports', g.reports,
      'created_at', g.created_at,
      'author_banned', EXISTS (
        SELECT 1 FROM public.bans b
        WHERE b.user_id = CASE WHEN g.target_type = 'post' THEN p.author_id ELSE c.author_id END
      )
    ) ORDER BY g.is_risk DESC, g.created_at DESC), '[]'::jsonb)
    FROM grouped g
    LEFT JOIN public.posts p ON g.target_type = 'post' AND p.id = g.target_id
    LEFT JOIN public.comments c ON g.target_type = 'comment' AND c.id = g.target_id
    LEFT JOIN public.posts pp ON g.target_type = 'comment' AND pp.id = c.post_id
    WHERE (g.target_type = 'post' AND p.id IS NOT NULL)
       OR (g.target_type = 'comment' AND c.id IS NOT NULL)
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_reports(p_status text DEFAULT 'open')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.admin_reports(p_status) $$;

CREATE OR REPLACE FUNCTION private.admin_resolve_report(p_report uuid, p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t_type text;
  t_id uuid;
  changed integer;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status NOT IN ('dismissed', 'actioned') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT r.target_type, r.target_id INTO t_type, t_id FROM public.reports r WHERE r.id = p_report;
  IF t_type IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  UPDATE public.reports SET status = p_status WHERE target_type = t_type AND target_id = t_id AND status <> p_status;
  GET DIAGNOSTICS changed = ROW_COUNT;
  INSERT INTO public.moderation_log (admin_id, action, target_type, target_id, note)
  VALUES (auth.uid(), 'resolve_report', t_type, t_id, p_status);
  RETURN changed > 0;
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report uuid, p_status text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$ SELECT private.admin_resolve_report(p_report, p_status) $$;

CREATE OR REPLACE FUNCTION private.admin_delete_content(p_type text, p_target uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_type NOT IN ('post', 'comment') THEN RAISE EXCEPTION 'Invalid target'; END IF;

  IF p_type = 'post' THEN
    DELETE FROM public.posts WHERE id = p_target;
  ELSE
    DELETE FROM public.comments WHERE id = p_target;
  END IF;
  GET DIAGNOSTICS changed = ROW_COUNT;

  UPDATE public.reports SET status = 'actioned' WHERE target_type = p_type AND target_id = p_target;
  INSERT INTO public.moderation_log (admin_id, action, target_type, target_id, note)
  VALUES (auth.uid(), 'delete_content', p_type, p_target, NULL);
  RETURN changed = 1;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_content(p_type text, p_target uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$ SELECT private.admin_delete_content(p_type, p_target) $$;

-- Admin: bans ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.admin_ban_author_of(p_type text, p_target uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  author uuid;
  existing uuid;
  new_id uuid;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_type NOT IN ('post', 'comment') THEN RAISE EXCEPTION 'Invalid target'; END IF;
  IF p_reason IS NOT NULL AND char_length(p_reason) > 500 THEN RAISE EXCEPTION 'Reason is too long'; END IF;

  IF p_type = 'post' THEN
    SELECT author_id INTO author FROM public.posts WHERE id = p_target;
  ELSE
    SELECT author_id INTO author FROM public.comments WHERE id = p_target;
  END IF;
  IF author IS NULL THEN RAISE EXCEPTION 'Content not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = author) THEN RAISE EXCEPTION 'Cannot restrict an administrator'; END IF;

  SELECT id INTO existing FROM public.bans WHERE user_id = author;
  IF existing IS NOT NULL THEN RETURN existing; END IF;

  INSERT INTO public.bans (user_id, reason, banned_by)
  VALUES (author, nullif(trim(p_reason), ''), auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO public.moderation_log (admin_id, action, target_type, target_id, note)
  VALUES (auth.uid(), 'ban_author', p_type, p_target, nullif(trim(p_reason), ''));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_ban_author_of(p_type text, p_target uuid, p_reason text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$ SELECT private.admin_ban_author_of(p_type, p_target, p_reason) $$;

CREATE OR REPLACE FUNCTION private.admin_bans()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object('ban_id', b.id, 'reason', b.reason, 'banned_at', b.banned_at) ORDER BY b.banned_at DESC), '[]'::jsonb)
    FROM public.bans b
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_bans()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT private.admin_bans() $$;

CREATE OR REPLACE FUNCTION private.admin_unban(p_ban uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.bans WHERE id = p_ban;
  GET DIAGNOSTICS changed = ROW_COUNT;
  INSERT INTO public.moderation_log (admin_id, action, target_type, target_id, note)
  VALUES (auth.uid(), 'unban', 'ban', p_ban, NULL);
  RETURN changed = 1;
END $$;

CREATE OR REPLACE FUNCTION public.admin_unban(p_ban uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$ SELECT private.admin_unban(p_ban) $$;

-- Function grants ------------------------------------------------------------

REVOKE ALL ON FUNCTION private.is_admin(), private.is_banned(uuid), private.am_i_banned(), private.report_content(text, uuid, text, text), private.admin_stats(), private.admin_reports(text), private.admin_resolve_report(uuid, text), private.admin_delete_content(text, uuid), private.admin_ban_author_of(text, uuid, text), private.admin_bans(), private.admin_unban(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin(), private.is_banned(uuid), private.am_i_banned(), private.report_content(text, uuid, text, text), private.admin_stats(), private.admin_reports(text), private.admin_resolve_report(uuid, text), private.admin_delete_content(text, uuid), private.admin_ban_author_of(text, uuid, text), private.admin_bans(), private.admin_unban(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin(), public.am_i_banned(), public.report_content(text, uuid, text, text), public.admin_stats(), public.admin_reports(text), public.admin_resolve_report(uuid, text), public.admin_delete_content(text, uuid), public.admin_ban_author_of(text, uuid, text), public.admin_bans(), public.admin_unban(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(), public.am_i_banned(), public.report_content(text, uuid, text, text), public.admin_stats(), public.admin_reports(text), public.admin_resolve_report(uuid, text), public.admin_delete_content(text, uuid), public.admin_ban_author_of(text, uuid, text), public.admin_bans(), public.admin_unban(uuid) TO authenticated;

-- Enforce bans in the database ----------------------------------------------
-- Recreate the write policies with the ban check; everything else is unchanged.

DROP POLICY IF EXISTS "Authors create posts" ON public.posts;
CREATE POLICY "Authors create posts" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND NOT private.is_banned(auth.uid()));

DROP POLICY IF EXISTS "Authors edit posts" ON public.posts;
CREATE POLICY "Authors edit posts" ON public.posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND NOT private.is_banned(auth.uid()))
  WITH CHECK (author_id = auth.uid() AND NOT private.is_banned(auth.uid()));

DROP POLICY IF EXISTS "Authors create comments" ON public.comments;
CREATE POLICY "Authors create comments" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND NOT private.is_banned(auth.uid()));

DROP POLICY IF EXISTS "Authors edit comments" ON public.comments;
CREATE POLICY "Authors edit comments" ON public.comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND NOT private.is_banned(auth.uid()))
  WITH CHECK (author_id = auth.uid() AND NOT private.is_banned(auth.uid()));

-- Server-side edit functions also refuse restricted accounts. delete_own_* is
-- intentionally left working so members can still remove what they wrote.

CREATE OR REPLACE FUNCTION private.edit_own_post(target_id uuid, new_question text, new_story text, new_display_as text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF private.is_banned(auth.uid()) THEN RAISE EXCEPTION 'Account restricted'; END IF;
  IF char_length(trim(new_question)) NOT BETWEEN 10 AND 500 OR char_length(trim(new_story)) NOT BETWEEN 10 AND 10000 OR new_display_as NOT IN ('username','real_name','anonymous') THEN RAISE EXCEPTION 'Invalid story'; END IF;
  IF new_display_as = 'real_name' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND nullif(trim(real_name),'') IS NOT NULL) THEN RAISE EXCEPTION 'Add a real name first'; END IF;
  UPDATE public.posts SET question = trim(new_question), story = trim(new_story), display_as = new_display_as WHERE id = target_id AND author_id = auth.uid();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END $$;

CREATE OR REPLACE FUNCTION private.edit_own_comment(target_id uuid, new_body text, new_display_as text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF private.is_banned(auth.uid()) THEN RAISE EXCEPTION 'Account restricted'; END IF;
  IF char_length(trim(new_body)) NOT BETWEEN 1 AND 2000 OR new_display_as NOT IN ('username','real_name','anonymous') THEN RAISE EXCEPTION 'Invalid comment'; END IF;
  IF new_display_as = 'real_name' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND nullif(trim(real_name),'') IS NOT NULL) THEN RAISE EXCEPTION 'Add a real name first'; END IF;
  UPDATE public.comments SET body = trim(new_body), display_as = new_display_as WHERE id = target_id AND author_id = auth.uid();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END $$;
