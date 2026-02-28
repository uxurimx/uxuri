import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { Bell } from "lucide-react";

export async function Topbar() {
  const user = await currentUser();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        <p className="text-sm text-slate-500 hidden sm:block">
          Bienvenido,{" "}
          <span className="font-semibold text-slate-700">
            {user?.firstName ?? "Usuario"}
          </span>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
          <Bell className="w-4 h-4 text-slate-500" />
        </button>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
