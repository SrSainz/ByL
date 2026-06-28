import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <Image
          alt="Logo APP Mantenimiento ByL"
          className="mx-auto rounded-[22px]"
          height={96}
          priority
          src="/logo-byl.png"
          width={96}
        />
        <h1 className="mt-4 text-2xl font-semibold text-slate-950">Entrar en mantenimiento</h1>
        <p className="mt-1 text-sm text-muted">Accede con el usuario que te ha facilitado administración.</p>
      </div>
      <div className="mb-5 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-md bg-surface-subtle px-3 py-2">
          <p className="font-semibold text-slate-950">Usuario</p>
          <p className="text-xs leading-5 text-muted">Crear incidencias, adjuntar factura y ver tu historial.</p>
        </div>
        <div className="rounded-md bg-surface-subtle px-3 py-2">
          <p className="font-semibold text-slate-950">Admin</p>
          <p className="text-xs leading-5 text-muted">Gestionar incidencias, usuarios, listas y facturas.</p>
        </div>
      </div>
      <LoginForm />
    </div>
  );
}
