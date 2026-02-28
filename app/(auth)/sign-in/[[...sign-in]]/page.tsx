import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Uxuri</h1>
          <p className="text-slate-500 text-sm mt-1">Bienvenido de nuevo</p>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
