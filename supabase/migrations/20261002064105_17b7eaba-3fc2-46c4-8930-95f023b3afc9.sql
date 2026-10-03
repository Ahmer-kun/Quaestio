REVOKE SELECT ON public.posts FROM authenticated;
REVOKE SELECT ON public.comments FROM authenticated;
GRANT SELECT (id, question, story, display_as, created_at, updated_at) ON public.posts TO authenticated;
GRANT SELECT (id, post_id, body, display_as, created_at, updated_at) ON public.comments TO authenticated;
CREATE FUNCTION public.feed_posts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'question', p.question, 'story', p.story, 'display_as', p.display_as, 'created_at', p.created_at, 'updated_at', p.updated_at, 'display_name', CASE WHEN p.display_as = 'anonymous' THEN 'Anonymous' WHEN p.display_as = 'real_name' THEN coalesce(pr.real_name, pr.username) ELSE pr.username END, 'is_mine', p.author_id = auth.uid(), 'comment_count', (SELECT count(*) FROM public.comments c WHERE c.post_id = p.id)) ORDER BY p.created_at DESC), '[]'::jsonb)
 FROM public.posts p JOIN public.profiles pr ON pr.id = p.author_id WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.feed_posts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_posts() TO authenticated;
CREATE FUNCTION public.post_comments(target_post uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'post_id', c.post_id, 'body', c.body, 'display_as', c.display_as, 'created_at', c.created_at, 'updated_at', c.updated_at, 'display_name', CASE WHEN c.display_as = 'anonymous' THEN 'Anonymous' WHEN c.display_as = 'real_name' THEN coalesce(pr.real_name, pr.username) ELSE pr.username END, 'is_mine', c.author_id = auth.uid()) ORDER BY c.created_at ASC), '[]'::jsonb)
 FROM public.comments c JOIN public.profiles pr ON pr.id = c.author_id WHERE auth.uid() IS NOT NULL AND c.post_id = target_post;
$$;
REVOKE ALL ON FUNCTION public.post_comments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_comments(uuid) TO authenticated;