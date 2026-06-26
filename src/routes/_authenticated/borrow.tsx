import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchBooks, fetchStudents, fetchBorrowRecords } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/borrow")({
  head: () => ({ meta: [{ title: "Borrow Records — Library" }] }),
  component: BorrowPage,
});

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function BorrowPage() {
  const qc = useQueryClient();
  const records = useQuery({ queryKey: ["records"], queryFn: fetchBorrowRecords });
  const books = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const students = useQuery({ queryKey: ["students"], queryFn: fetchStudents });

  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [bookId, setBookId] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate());

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["records"] });
    qc.invalidateQueries({ queryKey: ["books"] });
  };

  const borrow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("borrow_book", {
        p_student_id: studentId, p_book_id: bookId, p_due_date: dueDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Book borrowed");
      invalidate();
      setOpen(false); setStudentId(""); setBookId(""); setDueDate(defaultDueDate());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const returnBook = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase.rpc("return_book", { p_record_id: recordId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Book returned"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const availableBooks = books.data?.filter((b) => b.available_copies > 0) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Borrow Records</h1>
          <p className="text-sm text-muted-foreground">Lend books and process returns.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Borrow Book</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Borrow a Book</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Student</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder="Select a student" /></SelectTrigger>
                  <SelectContent>
                    {students.data?.map((s) => (
                      <SelectItem key={s.student_id} value={s.student_id}>{s.name} — {s.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Book</Label>
                <Select value={bookId} onValueChange={setBookId}>
                  <SelectTrigger><SelectValue placeholder="Select an available book" /></SelectTrigger>
                  <SelectContent>
                    {availableBooks.map((b) => (
                      <SelectItem key={b.book_id} value={b.book_id}>
                        {b.title} ({b.available_copies} available)
                      </SelectItem>
                    ))}
                    {!availableBooks.length && <div className="px-2 py-1.5 text-sm text-muted-foreground">No books available</div>}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Due date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => borrow.mutate()} disabled={!studentId || !bookId || !dueDate || borrow.isPending}>
                {borrow.isPending ? "Saving..." : "Confirm Borrow"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>All Records</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Book</TableHead>
                <TableHead>Borrowed</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Loading...</TableCell></TableRow>}
              {records.data?.map((r) => (
                <TableRow key={r.record_id}>
                  <TableCell className="font-medium">{r.students?.name ?? "—"}</TableCell>
                  <TableCell>{r.books?.title ?? "—"}</TableCell>
                  <TableCell>{r.borrow_date}</TableCell>
                  <TableCell>{r.due_date}</TableCell>
                  <TableCell>{r.return_date ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.status === "Returned" ? "secondary" : "default"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {r.status === "Borrowed" ? (
                      <Button size="sm" variant="outline" onClick={() => returnBook.mutate(r.record_id)} disabled={returnBook.isPending}>
                        Return
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              {!records.isLoading && !records.data?.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No records yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
