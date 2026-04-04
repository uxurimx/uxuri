"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
