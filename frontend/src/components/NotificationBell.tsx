import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, CircleCheck, PenLine, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiGet, apiPost } from "@/lib/api";
import type { NotificationList } from "@/lib/types";

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { dateStyle: "medium" });
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => apiGet<NotificationList>("/notifications"), refetchInterval: 15000 });
  const readOne = useMutation({ mutationFn: (id: string) => apiPost(`/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
  const readAll = useMutation({ mutationFn: () => apiPost("/notifications/read-all"), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" className="relative" data-testid="notification-bell-button" />}>
        <Bell className="size-5 text-[#065F46]" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-[18px] place-items-center rounded-full bg-[#B8963E] px-1 text-[10px] font-bold text-white ring-2 ring-background" data-testid="notification-unread-count">{unread > 99 ? "99+" : unread}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0" data-testid="notification-popover">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-heading text-[15px] font-semibold">Notifikasi</p>
          <Button size="xs" variant="ghost" disabled={unread === 0} onClick={() => readAll.mutate()} data-testid="notification-read-all"><CheckCheck className="size-3.5" /> Tandai dibaca</Button>
        </div>
        <ul className="max-h-[420px] overflow-y-auto">
          {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="notification-empty">Belum ada notifikasi.</li>}
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" data-testid={`notification-item-${n.id}`}
                className={`flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-[#F0F7F3] ${n.read ? "" : "bg-[#ECFDF5]/70"}`}
                onClick={() => { if (!n.read) readOne.mutate(n.id); setOpen(false); nav(n.link); }}>
                <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${n.type === "request" ? "bg-[#FBF3DC] text-[#7A5B12]" : n.type === "rejected" ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#D1FAE5] text-[#065F46]"}`}>
                  {n.type === "request" ? <PenLine className="size-4" /> : n.type === "rejected" ? <Undo2 className="size-4" /> : <CircleCheck className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[13px] font-semibold">{n.title}{!n.read && <span className="size-1.5 rounded-full bg-[#B8963E]" />}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{n.message}</span>
                  <span className="mt-1 block text-[10px] uppercase tracking-wider text-[#4F6359]">{ago(n.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="p-2">
          <Button variant="outline" size="sm" className="w-full" onClick={() => { setOpen(false); nav("/approvals"); }} data-testid="notification-open-approvals">Lihat semua yang menunggu tanda tangan saya</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
