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
        <h1 className="mt-4 text-2xl font-semibold text-slate-950">Acceso</h1>
        <p className="mt-1 text-sm text-muted">Entra para gestionar tus incidencias.</p>
      </div>
      <LoginForm />
    </div>
  );
}
