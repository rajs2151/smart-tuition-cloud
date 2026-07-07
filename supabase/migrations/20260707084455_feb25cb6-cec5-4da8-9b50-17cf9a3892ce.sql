
-- Wire the missing trigger that seeds an owner membership when an institute is created.
DROP TRIGGER IF EXISTS trg_add_creator_as_owner ON public.institutes;
CREATE TRIGGER trg_add_creator_as_owner
AFTER INSERT ON public.institutes
FOR EACH ROW
EXECUTE FUNCTION public.add_creator_as_owner();

-- Backfill: for any existing institute whose creator has no membership row, add them as owner.
INSERT INTO public.institute_members (institute_id, user_id, role)
SELECT i.id, i.created_by, 'owner'
FROM public.institutes i
WHERE i.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.institute_members m
    WHERE m.institute_id = i.id AND m.user_id = i.created_by
  )
ON CONFLICT DO NOTHING;
