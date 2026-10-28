import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SimpleSelect from "@/components/SimpleSelect";
import { Empty, PageHeader, Panel } from "@/components/PageBits";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { ROLE_LABELS, errMsg } from "@/lib/format";
import type { Role, UserOut } from "@/lib/types";

const ROLES = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

function UserDialog({ user, onClose }: { user: UserOut | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "marketing");
  const [active, setActive] = useState(user?.active ?? true);
  const [password, setPassword] = useState("");
  const save = useMutation({
    mutationFn: () => (user ? apiPut<UserOut>(`/users/${user.id}`, { name, role, active, password: password || null }) : apiPost<UserOut>("/users", { email, name, role, password })),
    onSuccess: () => { toast.success("Pengguna tersimpan"); qc.invalidateQueries({ queryKey: ["users"] }); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="user-dialog">
        <DialogHeader><DialogTitle>{user ? "Edit pengguna" : "Tambah pengguna"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={email} disabled={!!user} onChange={(e) => setEmail(e.target.value)} data-testid="user-input-email" /></div>
          <div className="space-y-1"><Label className="text-xs">Nama</Label><Input value={name} onChange={(e) => setName(e.target.value)} data-testid="user-input-name" /></div>
          <div className="space-y-1"><Label className="text-xs">Peran</Label><SimpleSelect value={role} onChange={(v) => setRole(v as Role)} options={ROLES} testId="user-role-select" className="w-full" /></div>
          <div className="space-y-1"><Label className="text-xs">{user ? "Password baru (kosongkan jika tidak diubah)" : "Password (min 6)"}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="user-input-password" /></div>
          {user && <label className="flex items-center gap-2 text-sm"><Checkbox checked={active} onCheckedChange={(c: boolean) => setActive(c)} data-testid="user-active-checkbox" /> Akun aktif</label>}
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="user-save-button">Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<UserOut | null | "new">(null);
  const { data = [], isError } = useQuery({ queryKey: ["users"], queryFn: () => apiGet<UserOut[]>("/users") });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/users/${id}`),
    onSuccess: () => { toast.success("Pengguna dihapus"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div>
      <PageHeader title="Pengguna & Peran" subtitle="Admin: semua akses · R&D: material, upah, HPP, packaging · Marketing: packaging form, upload file buyer, lihat HPP & laporan."
        actions={<Button size="sm" onClick={() => setEdit("new")} data-testid="user-add-button"><Plus className="size-4" /> Tambah Pengguna</Button>} />
      <Panel>
        {isError ? <Empty text="Hanya Admin yang dapat mengelola pengguna." testId="users-forbidden" /> : (
          <table className="w-full text-sm" data-testid="users-table">
            <thead className="bg-[#F3EFEA] text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-2">Nama</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Peran</th><th className="px-3 py-2">Status</th><th className="w-20" /></tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-t" data-testid={`user-row-${u.id}`}>
                  <td className="px-3 py-2 font-medium">{u.name}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2"><Badge className="bg-[#F3E8DB] text-[#78350F]">{ROLE_LABELS[u.role]}</Badge></td>
                  <td className="px-3 py-2">{u.active ? <Badge className="bg-[#DCFCE7] text-[#14532D]">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <Button size="icon-xs" variant="ghost" onClick={() => setEdit(u)} data-testid={`user-edit-${u.id}`}><Pencil className="size-3.5" /></Button>
                    {u.id !== me?.id && <Button size="icon-xs" variant="ghost" onClick={() => { if (confirm(`Hapus ${u.name}?`)) del.mutate(u.id); }} data-testid={`user-delete-${u.id}`}><Trash2 className="size-3.5 text-destructive" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {edit && <UserDialog key={edit === "new" ? "new" : edit.id} user={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
