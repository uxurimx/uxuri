"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// Estas rutas siempre son accesibles para no dejar al usuario sin salida
const ALWAYS_ALLOWED = ["/workspaces", "/settings", "/dashboard"];

export function RouteGuard({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ALWAYS_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"))) return;

    const allowed = permissions.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

    if (!allowed) {
      router.replace("/dashboard");
    }
  }, [pathname, permissions, router]);

  return null;
}
