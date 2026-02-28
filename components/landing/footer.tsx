import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1e3a5f] flex items-center justify-center">
              <span className="text-white font-bold text-sm">U</span>
            </div>
            <span className="text-white font-bold text-lg">Uxuri</span>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <Link href="/sign-in" className="hover:text-white transition-colors">
              Iniciar sesión
            </Link>
            <Link href="/sign-up" className="hover:text-white transition-colors">
              Registrarse
            </Link>
          </div>

          <p className="text-sm">
            © {new Date().getFullYear()} Uxuri. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
