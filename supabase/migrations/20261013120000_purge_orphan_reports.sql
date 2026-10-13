-- Account deletion: clean up reports whose target no longer exists.
-- Called with the service-role client after a user is deleted. Content owned by
-- the deleted account is removed by ON DELETE CASCADE, which can leave report
-- rows pointing at targets that are gone. This removes those orphans.

CREATE OR REPLACE FUNCTION public.purge_orphan_reports()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.reports r
  WHERE (r.target_type = 'post' AND NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = r.target_id))
     OR (r.target_type = 'comment' AND NOT EXISTS (SELECT 1 FROM public.comments c WHERE c.id = r.target_id));
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END $$;

REVOKE ALL ON FUNCTION public.purge_orphan_reports() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_orphan_reports() TO service_role;
