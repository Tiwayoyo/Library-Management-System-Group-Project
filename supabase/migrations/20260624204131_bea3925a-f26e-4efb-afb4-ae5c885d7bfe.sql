
CREATE TABLE public.students (
  student_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  registered_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.books (
  book_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT,
  category TEXT,
  total_copies INTEGER NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  available_copies INTEGER NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.borrow_records (
  record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(book_id) ON DELETE CASCADE,
  borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  status TEXT NOT NULL DEFAULT 'Borrowed' CHECK (status IN ('Borrowed','Returned','Overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_borrow_records_student ON public.borrow_records(student_id);
CREATE INDEX idx_borrow_records_book ON public.borrow_records(book_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO anon, authenticated;
GRANT ALL ON public.students TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO anon, authenticated;
GRANT ALL ON public.books TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.borrow_records TO anon, authenticated;
GRANT ALL ON public.borrow_records TO service_role;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access students" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access books" ON public.books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access borrow_records" ON public.borrow_records FOR ALL USING (true) WITH CHECK (true);

-- Borrow a book: decrease available_copies and create a record (atomic)
CREATE OR REPLACE FUNCTION public.borrow_book(
  p_student_id UUID,
  p_book_id UUID,
  p_due_date DATE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id UUID;
  v_available INTEGER;
BEGIN
  SELECT available_copies INTO v_available FROM public.books WHERE book_id = p_book_id FOR UPDATE;
  IF v_available IS NULL THEN
    RAISE EXCEPTION 'Book not found';
  END IF;
  IF v_available <= 0 THEN
    RAISE EXCEPTION 'No copies available';
  END IF;

  UPDATE public.books SET available_copies = available_copies - 1 WHERE book_id = p_book_id;

  INSERT INTO public.borrow_records (student_id, book_id, borrow_date, due_date, status)
  VALUES (p_student_id, p_book_id, CURRENT_DATE, p_due_date, 'Borrowed')
  RETURNING record_id INTO v_record_id;

  RETURN v_record_id;
END;
$$;

-- Return a book: increase available_copies and update record
CREATE OR REPLACE FUNCTION public.return_book(p_record_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book_id UUID;
  v_status TEXT;
BEGIN
  SELECT book_id, status INTO v_book_id, v_status FROM public.borrow_records WHERE record_id = p_record_id FOR UPDATE;
  IF v_book_id IS NULL THEN
    RAISE EXCEPTION 'Record not found';
  END IF;
  IF v_status = 'Returned' THEN
    RAISE EXCEPTION 'Already returned';
  END IF;

  UPDATE public.borrow_records SET return_date = CURRENT_DATE, status = 'Returned' WHERE record_id = p_record_id;
  UPDATE public.books SET available_copies = available_copies + 1 WHERE book_id = v_book_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.borrow_book(UUID, UUID, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_book(UUID) TO anon, authenticated;
