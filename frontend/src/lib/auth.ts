import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import { PERMS } from "./format";
import type { UserOut } from "./types";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiGet<UserOut>("/auth/me"), retry: false, staleTime: 60_000 });
}

export function can(user: UserOut | undefined, perm: string): boolean {
  return !!user && PERMS[user.role]?.includes(perm);
}
