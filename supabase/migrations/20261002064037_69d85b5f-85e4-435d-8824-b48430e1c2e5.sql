CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,24}$'),
 real_name text CHECK (real_name IS NULL OR (char_length(real_name) BETWEEN 1 AND 80)),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members create own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() AND username = split_part((auth.jwt() ->> 'email'), '@', 1));
CREATE POLICY "Members update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND username = split_part((auth.jwt() ->> 'email'), '@', 1));

CREATE TABLE public.posts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 question text NOT NULL CHECK (char_length(question) BETWEEN 10 AND 500),
 story text NOT NULL CHECK (char_length(story) BETWEEN 10 AND 10000),
 display_as text NOT NULL CHECK (display_as IN ('username', 'real_name', 'anonymous')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read posts" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authors create posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors edit posts" ON public.posts FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors delete posts" ON public.posts FOR DELETE TO authenticated USING (author_id = auth.uid());
CREATE INDEX posts_created_at_idx ON public.posts (created_at DESC);

CREATE TABLE public.comments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
 display_as text NOT NULL CHECK (display_as IN ('username', 'real_name', 'anonymous')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read comments" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authors create comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors edit comments" ON public.comments FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Authors delete comments" ON public.comments FOR DELETE TO authenticated USING (author_id = auth.uid());
CREATE INDEX comments_post_time_idx ON public.comments (post_id, created_at);

CREATE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_touch_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER posts_touch_updated BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER comments_touch_updated BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE FUNCTION public.enforce_immutable_publication() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF NEW.author_id IS DISTINCT FROM OLD.author_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Author and publication date cannot be changed'; END IF; RETURN NEW; END $$;
CREATE TRIGGER posts_immutable BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_publication();
CREATE TRIGGER comments_immutable BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_publication();