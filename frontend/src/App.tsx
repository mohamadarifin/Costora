import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import HppList from "@/pages/HppList";
import HppEditor from "@/pages/HppEditor";
import PackagingList from "@/pages/PackagingList";
import PackagingEditor from "@/pages/PackagingEditor";
import ImportBuyer from "@/pages/ImportBuyer";
import Materials from "@/pages/Materials";
import Labor from "@/pages/Labor";
import Reports from "@/pages/Reports";
import UsersPage from "@/pages/Users";
import Signatures from "@/pages/Signatures";
import { Toaster } from "@/components/ui/sonner";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<><Login /><Toaster richColors /></>} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/hpp" element={<HppList />} />
        <Route path="/hpp/:id" element={<HppEditor />} />
        <Route path="/packaging" element={<PackagingList />} />
        <Route path="/packaging/:id" element={<PackagingEditor />} />
        <Route path="/import" element={<ImportBuyer />} />
        <Route path="/materials" element={<Materials />} />
        <Route path="/labor" element={<Labor />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/signatures" element={<Signatures />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
