
-- Roles infrastructure
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- has_role: SECURITY INVOKER (the SELECT policy above allows the lookup)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Auto-promote the first signed-up user to admin
CREATE OR REPLACE FUNCTION public.handle_new_user_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_admin();

-- Replace permissive policies on data tables with admin-only policies
DROP POLICY IF EXISTS "Public access books" ON public.books;
DROP POLICY IF EXISTS "Public access students" ON public.students;
DROP POLICY IF EXISTS "Public access borrow_records" ON public.borrow_records;

REVOKE ALL ON public.books FROM anon;
REVOKE ALL ON public.students FROM anon;
REVOKE ALL ON public.borrow_records FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.borrow_records TO authenticated;

CREATE POLICY "Admins manage books" ON public.books FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage students" ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage borrow_records" ON public.borrow_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Convert RPCs to SECURITY INVOKER so admin RLS gates them
CREATE OR REPLACE FUNCTION public.borrow_book(p_student_id uuid, p_book_id uuid, p_due_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_record_id uuid;
  v_available integer;
BEGIN
  SELECT available_copies INTO v_available FROM public.books WHERE book_id = p_book_id FOR UPDATE;
  IF v_available IS NULL THEN RAISE EXCEPTION 'Book not found'; END IF;
  IF v_available <= 0 THEN RAISE EXCEPTION 'No copies available'; END IF;

  UPDATE public.books SET available_copies = available_copies - 1 WHERE book_id = p_book_id;

  INSERT INTO public.borrow_records (student_id, book_id, borrow_date, due_date, status)
  VALUES (p_student_id, p_book_id, CURRENT_DATE, p_due_date, 'Borrowed')
  RETURNING record_id INTO v_record_id;

  RETURN v_record_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.return_book(p_record_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_book_id uuid;
  v_status text;
BEGIN
  SELECT book_id, status INTO v_book_id, v_status FROM public.borrow_records WHERE record_id = p_record_id FOR UPDATE;
  IF v_book_id IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
  IF v_status = 'Returned' THEN RAISE EXCEPTION 'Already returned'; END IF;

  UPDATE public.borrow_records SET return_date = CURRENT_DATE, status = 'Returned' WHERE record_id = p_record_id;
  UPDATE public.books SET available_copies = available_copies + 1 WHERE book_id = v_book_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.borrow_book(uuid, uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.borrow_book(uuid, uuid, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.return_book(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_book(uuid) TO authenticated;
