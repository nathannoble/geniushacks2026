-- 1. Create the user_roles table
CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('Product Owner', 'Compliance Analyst', 'Committee Member', 'Audit Officer')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- 2. Enable Row Level Security (RLS) so the frontend can securely read roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy that allows users to read their own role
CREATE POLICY "Users can read their own role" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Optional: If you want to automatically assign "Product Owner" as the default role when someone signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'Product Owner');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
