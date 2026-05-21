-- Custom SQL migration file, put your code below! --

DROP FUNCTION IF EXISTS invalidate_active_scd(text, timestamptz);

CREATE OR REPLACE FUNCTION invalidate_active_scd(
  p_table  text,
  p_id     uuid,
  p_at     timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET valid_to = $1 WHERE user_id = current_setting(''app.user_id'')::uuid AND id = $2 AND valid_to IS NULL',
    p_table
  )
  USING p_at, p_id;
END;
$$;

-- Grant execute to app role
GRANT EXECUTE ON FUNCTION invalidate_active_scd(text, uuid, timestamptz) TO authenticated;
