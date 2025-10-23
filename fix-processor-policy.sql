-- Drop the restrictive processor policy
DROP POLICY IF EXISTS raw_props_processor_update ON public.raw_props;

-- Create a new permissive policy for processor_rw role
CREATE POLICY "raw_props_processor_update"
ON public.raw_props
FOR UPDATE
TO processor_rw
USING (true)
WITH CHECK (true);
