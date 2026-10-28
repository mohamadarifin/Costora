import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { errMsg } from "@/lib/format";
import type { UserOut } from "@/lib/types";

const DEMO = [
  { role: "Admin", email: "admin@balagi.com", pw: "admin123" },
  { role: "Marketing", email: "marketing@balagi.com", pw: "marketing123" },
  { role: "R&D", email: "rnd@balagi.com", pw: "rnd123" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();
  const qc = useQueryClient();
  const login = useMutation({
    mutationFn: () => apiPost<UserOut>("/auth/login", { email, password }),
    onSuccess: (u) => {
      beginSession();
      qc.setQueryData(["me"], u);
      toast.success(`Selamat datang, ${u.name}`);
      nav("/", { replace: true });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src="https://images.unsplash.com/photo-1534953342533-7711c98712be?crop=entropy&cs=srgb&fm=jpg&q=80&w=1600" alt="Pengrajin rotan" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#022C22] via-[#022C22]/60 to-transparent" />
        <div className="absolute bottom-0 left-0 max-w-xl p-12 text-white">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[#E6C878]">PT Balagi Rattan · Cirebon</p>
          <h1 className="text-4xl font-semibold leading-tight">Harga Pokok Produksi, dari serat rotan sampai kontainer.</h1>
          <p className="mt-4 text-sm text-[#E7E5E4]">Database material, upah tenaga kerja per tahun, packaging form dan laporan buyer — dalam satu sistem R&amp;D.</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-background p-6">
        <div className="rise-in w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[#047857] font-heading text-xl font-bold text-white">B</div>
            <div>
              <p className="font-heading text-lg font-semibold">Balagi HPP System</p>
              <p className="text-xs text-muted-foreground">Masuk untuk melanjutkan</p>
            </div>
          </div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); login.mutate(); }} data-testid="login-form">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="login-email-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required data-testid="login-password-input" />
            </div>
            <Button type="submit" className="h-10 w-full" disabled={login.isPending} data-testid="login-submit-button">
              {login.isPending ? "Memproses..." : "Masuk"}
            </Button>
          </form>
          <div className="mt-8 rounded-lg border bg-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Akun demo</p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <Button key={d.email} variant="outline" size="sm" data-testid={`login-demo-${d.role.replace("&", "n").toLowerCase()}`}
                  onClick={() => { setEmail(d.email); setPassword(d.pw); }}>{d.role}</Button>
              ))}
            </div>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground" data-testid="login-copyright">© {new Date().getFullYear()} <span className="font-semibold text-[#065F46]">FinDev</span>. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
