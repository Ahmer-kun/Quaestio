-- Keep real names private: members may no longer read profiles.real_name directly.
-- The column grant stays narrow and the caller's own row is served through my_profile().
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, created_at, updated_at) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION private.my_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('id', p.id, 'username', p.username, 'real_name', p.real_name)
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.my_profile()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$ SELECT private.my_profile() $$;

REVOKE ALL ON FUNCTION private.my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.my_profile() TO authenticated;
REVOKE ALL ON FUNCTION public.my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile() TO authenticated;
