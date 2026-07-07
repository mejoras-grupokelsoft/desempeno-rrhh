-- Disable RLS on questions table for development
ALTER TABLE public.questions DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.questions TO anon;
