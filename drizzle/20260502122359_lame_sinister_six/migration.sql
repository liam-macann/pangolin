CREATE POLICY "scd_table_immutable" ON "client_data" AS RESTRICTIVE FOR UPDATE TO public USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "scd_table_immutable" ON "config" AS RESTRICTIVE FOR UPDATE TO public USING (false) WITH CHECK (false);


CREATE OR REPLACE FUNCTION invalidate_active_scd(
  p_table  text,
  p_at     timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- Pin search_path to prevent search_path hijacking
SET search_path = public, pg_catalog
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET valid_to = $1 WHERE user_id = current_setting(''app.user_id'')::uuid AND valid_to IS NULL',
    p_table
  )
  USING p_at;
END;
$$;

-- Grant execute to app role
GRANT EXECUTE ON FUNCTION invalidate_active_scd(text, timestamptz) TO authenticated;