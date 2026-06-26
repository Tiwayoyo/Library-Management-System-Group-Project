import { supabase } from "@/integrations/supabase/client";

export type Student = {
  student_id: string;
  name: string;
  email: string;
  phone: string | null;
  registered_date: string;
};

export type Book = {
  book_id: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string | null;
  total_copies: number;
  available_copies: number;
};

export type BorrowRecord = {
  record_id: string;
  student_id: string;
  book_id: string;
  borrow_date: string;
  due_date: string;
  return_date: string | null;
  status: "Borrowed" | "Returned" | "Overdue";
  students?: Pick<Student, "name" | "email"> | null;
  books?: Pick<Book, "title" | "author"> | null;
};

export async function fetchBooks(): Promise<Book[]> {
  const { data, error } = await supabase.from("books").select("*").order("title");
  if (error) throw error;
  return data as Book[];
}

export async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from("students").select("*").order("name");
  if (error) throw error;
  return data as Student[];
}

export async function fetchBorrowRecords(): Promise<BorrowRecord[]> {
  const { data, error } = await supabase
    .from("borrow_records")
    .select("*, students(name,email), books(title,author)")
    .order("borrow_date", { ascending: false });
  if (error) throw error;
  return data as unknown as BorrowRecord[];
}
