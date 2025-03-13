-- Create the exec_sql function first
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.exec_sql TO authenticated;

COMMENT ON FUNCTION public.exec_sql IS 'Execute arbitrary SQL for database setup and migrations'; 