-- Anti-abuse: posting limits with an hourly and a daily window.
-- No content is stored, only who posted/commented and when.
-- Limits live at the top of the trigger function and must stay in sync with
-- src/lib/limits.ts.

CREATE TABLE public.activity_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('post', 'comment')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_log_user_kind_time_idx ON public.activity_log (user_id, kind, created_at);
CREATE INDEX activity_log_created_at_idx ON public.activity_log (created_at);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_log FROM anon, authenticated;
GRANT ALL ON public.activity_log TO service_role;

CREATE OR REPLACE FUNCTION private.enforce_posting_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- Limits (must match src/lib/limits.ts).
  c_posts_per_hour constant int := 3;
  c_posts_per_day constant int := 5;
  c_comments_per_hour constant int := 15;
  c_comments_per_day constant int := 60;

  v_kind text;
  v_hourly_limit int;
  v_daily_limit int;
  v_count_hour int;
  v_count_day int;
  v_ts timestamptz;
  v_wait_hour int := 0;
  v_wait_day int := 0;
BEGIN
  -- Admins are exempt.
  IF private.is_admin() THEN RETURN NEW; END IF;

  -- Only enforce limits for the caller's own inserts. Anything else is rejected by the
  -- normal row-level security check, and must not reveal another member's activity.
  IF NEW.author_id IS DISTINCT FROM auth.uid() THEN RETURN NEW; END IF;

  -- Purge old rows so the table stays small.
  DELETE FROM public.activity_log WHERE created_at < now() - interval '3 days';

  IF TG_TABLE_NAME = 'posts' THEN
    v_kind := 'post';
    v_hourly_limit := c_posts_per_hour;
    v_daily_limit := c_posts_per_day;
  ELSE
    v_kind := 'comment';
    v_hourly_limit := c_comments_per_hour;
    v_daily_limit := c_comments_per_day;
  END IF;

  -- Hourly window.
  SELECT count(*) INTO v_count_hour
  FROM public.activity_log
  WHERE user_id = NEW.author_id AND kind = v_kind AND created_at > now() - interval '1 hour';

  IF v_count_hour >= v_hourly_limit THEN
    SELECT created_at INTO v_ts
    FROM public.activity_log
    WHERE user_id = NEW.author_id AND kind = v_kind AND created_at > now() - interval '1 hour'
    ORDER BY created_at ASC
    OFFSET (v_count_hour - v_hourly_limit)
    LIMIT 1;
    v_wait_hour := greatest(1, ceil(extract(epoch FROM (v_ts + interval '1 hour' - now()))))::int;
  END IF;

  -- Daily window.
  SELECT count(*) INTO v_count_day
  FROM public.activity_log
  WHERE user_id = NEW.author_id AND kind = v_kind AND created_at > now() - interval '24 hours';

  IF v_count_day >= v_daily_limit THEN
    SELECT created_at INTO v_ts
    FROM public.activity_log
    WHERE user_id = NEW.author_id AND kind = v_kind AND created_at > now() - interval '24 hours'
    ORDER BY created_at ASC
    OFFSET (v_count_day - v_daily_limit)
    LIMIT 1;
    v_wait_day := greatest(1, ceil(extract(epoch FROM (v_ts + interval '24 hours' - now()))))::int;
  END IF;

  -- Report the window with the longer wait when both are exceeded.
  IF v_wait_hour > 0 OR v_wait_day > 0 THEN
    IF v_wait_day >= v_wait_hour THEN
      RAISE EXCEPTION 'rate_limit_%_day_%', v_kind, v_wait_day USING ERRCODE = 'P0001';
    ELSE
      RAISE EXCEPTION 'rate_limit_%_hour_%', v_kind, v_wait_hour USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.activity_log (user_id, kind) VALUES (NEW.author_id, v_kind);
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION private.enforce_posting_limits() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER posts_limits
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION private.enforce_posting_limits();

CREATE TRIGGER comments_limits
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION private.enforce_posting_limits();
