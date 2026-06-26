import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Users, BookMarked, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchBooks, fetchStudents, fetchBorrowRecords } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Library" }] }),
  component: Dashboard,
});

function Dashboard() {
  const books = useQuery({ queryKey: ["books"], queryFn: fetchBooks });
  const students = useQuery({ queryKey: ["students"], queryFn: fetchStudents });
  const records = useQuery({ queryKey: ["records"], queryFn: fetchBorrowRecords });

  const activeBorrows = records.data?.filter((r) => r.status === "Borrowed").length ?? 0;
  const returned = records.data?.filter((r) => r.status === "Returned").length ?? 0;

  const stats = [
    { label: "Total Books", value: books.data?.length ?? 0, icon: BookOpen },
    { label: "Students", value: students.data?.length ?? 0, icon: Users },
    { label: "Active Borrows", value: activeBorrows, icon: BookMarked },
    { label: "Returned", value: returned, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of the library.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Books</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Title</TableHead><TableHead>Author</TableHead><TableHead className="text-right">Available</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {books.data?.slice(0, 6).map((b) => (
                  <TableRow key={b.book_id}>
                    <TableCell className="font-medium">{b.title}</TableCell>
                    <TableCell className="text-muted-foreground">{b.author}</TableCell>
                    <TableCell className="text-right">{b.available_copies}/{b.total_copies}</TableCell>
                  </TableRow>
                ))}
                {!books.data?.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No books yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Students</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Registered</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {students.data?.slice(0, 6).map((s) => (
                  <TableRow key={s.student_id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.email}</TableCell>
                    <TableCell>{s.registered_date}</TableCell>
                  </TableRow>
                ))}
                {!students.data?.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No students yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Borrow Records</CardTitle></CardHeader>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.data?.slice(0, 8).map((r) => (
                <TableRow key={r.record_id}>
                  <TableCell className="font-medium">{r.students?.name ?? "—"}</TableCell>
                  <TableCell>{r.books?.title ?? "—"}</TableCell>
                  <TableCell>{r.borrow_date}</TableCell>
                  <TableCell>{r.due_date}</TableCell>
                  <TableCell>{r.return_date ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "Returned" ? "secondary" : "default"}>{r.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!records.data?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No records yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
