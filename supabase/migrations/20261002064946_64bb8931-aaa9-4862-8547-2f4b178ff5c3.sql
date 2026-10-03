CREATE OR REPLACE FUNCTION private.edit_own_post(target_id uuid, new_question text, new_story text, new_display_as text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF char_length(trim(new_question)) NOT BETWEEN 10 AND 500 OR char_length(trim(new_story)) NOT BETWEEN 10 AND 10000 OR new_display_as NOT IN ('username','real_name','anonymous') THEN RAISE EXCEPTION 'Invalid story'; END IF;
  IF new_display_as = 'real_name' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND nullif(trim(real_name),'') IS NOT NULL) THEN RAISE EXCEPTION 'Add a real name first'; END IF;
  UPDATE public.posts SET question = trim(new_question), story = trim(new_story), display_as = new_display_as WHERE id = target_id AND author_id = auth.uid();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END $$;
CREATE OR REPLACE FUNCTION private.delete_own_post(target_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  DELETE FROM public.posts WHERE id = target_id AND author_id = auth.uid();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END $$;
CREATE OR REPLACE FUNCTION private.edit_own_comment(target_id uuid, new_body text, new_display_as text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF char_length(trim(new_body)) NOT BETWEEN 1 AND 2000 OR new_display_as NOT IN ('username','real_name','anonymous') THEN RAISE EXCEPTION 'Invalid comment'; END IF;
  IF new_display_as = 'real_name' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND nullif(trim(real_name),'') IS NOT NULL) THEN RAISE EXCEPTION 'Add a real name first'; END IF;
  UPDATE public.comments SET body = trim(new_body), display_as = new_display_as WHERE id = target_id AND author_id = auth.uid();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END $$;
CREATE OR REPLACE FUNCTION private.delete_own_comment(target_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  DELETE FROM public.comments WHERE id = target_id AND author_id = auth.uid();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END $$;
CREATE OR REPLACE FUNCTION public.edit_own_post(target_id uuid, new_question text, new_story text, new_display_as text) RETURNS boolean LANGUAGE sql SET search_path = public AS $$ SELECT private.edit_own_post(target_id,new_question,new_story,new_display_as) $$;
CREATE OR REPLACE FUNCTION public.delete_own_post(target_id uuid) RETURNS boolean LANGUAGE sql SET search_path = public AS $$ SELECT private.delete_own_post(target_id) $$;
CREATE OR REPLACE FUNCTION public.edit_own_comment(target_id uuid, new_body text, new_display_as text) RETURNS boolean LANGUAGE sql SET search_path = public AS $$ SELECT private.edit_own_comment(target_id,new_body,new_display_as) $$;
CREATE OR REPLACE FUNCTION public.delete_own_comment(target_id uuid) RETURNS boolean LANGUAGE sql SET search_path = public AS $$ SELECT private.delete_own_comment(target_id) $$;
REVOKE ALL ON FUNCTION public.edit_own_post(uuid,text,text,text), public.delete_own_post(uuid), public.edit_own_comment(uuid,text,text), public.delete_own_comment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_own_post(uuid,text,text,text), public.delete_own_post(uuid), public.edit_own_comment(uuid,text,text), public.delete_own_comment(uuid) TO authenticated;
REVOKE ALL ON FUNCTION private.edit_own_post(uuid,text,text,text), private.delete_own_post(uuid), private.edit_own_comment(uuid,text,text), private.delete_own_comment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.edit_own_post(uuid,text,text,text), private.delete_own_post(uuid), private.edit_own_comment(uuid,text,text), private.delete_own_comment(uuid) TO authenticated;