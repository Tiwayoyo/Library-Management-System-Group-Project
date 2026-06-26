import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchBooks, type Book } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/books")({
  head: () => ({ meta: [{ title: "Books — Library" }] }),
  component: BooksPage,
});

type Form = {
  title: string; author: string; isbn: string; category: string;
  total_copies: number; available_copies: number;
};
const empty: Form = { title: "", author: "", isbn: "", category: "", total_copies: 1, available_copies: 1 };

function BooksPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState<Form>(empty);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("books").update(form).eq("book_id", editing.book_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("books").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Book updated" : "Book added");
      qc.invalidateQueries({ queryKey: ["books"] });
      setOpen(false); setEditing(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("books").delete().eq("book_id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Book deleted"); qc.invalidateQueries({ queryKey: ["books"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (b: Book) => {
    setEditing(b);
    setForm({
      title: b.title, author: b.author, isbn: b.isbn ?? "", category: b.category ?? "",
      total_copies: b.total_copies, available_copies: b.available_copies,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
          <p className="text-sm text-muted-foreground">Manage the library catalog.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Book</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Book" : "Add Book"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="Author"><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="ISBN"><Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} /></Field>
                <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Total copies"><Input type="number" min={0} value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: Number(e.target.value) })} /></Field>
                <Field label="Available copies"><Input type="number" min={0} value={form.available_copies} onChange={(e) => setForm({ ...form, available_copies: Number(e.target.value) })} /></Field>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={!form.title || !form.author || save.isPending}>
                {save.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Catalog</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead><TableHead>Author</TableHead><TableHead>ISBN</TableHead>
                <TableHead>Category</TableHead><TableHead className="text-right">Copies</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>}
              {data?.map((b) => (
                <TableRow key={b.book_id}>
                  <TableCell className="font-medium">{b.title}</TableCell>
                  <TableCell>{b.author}</TableCell>
                  <TableCell className="text-muted-foreground">{b.isbn ?? "—"}</TableCell>
                  <TableCell>{b.category ?? "—"}</TableCell>
                  <TableCell className="text-right">{b.available_copies}/{b.total_copies}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this book?")) del.mutate(b.book_id); }}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && !data?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No books yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}
