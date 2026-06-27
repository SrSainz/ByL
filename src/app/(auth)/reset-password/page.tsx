import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-950">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-muted">Recibirás un enlace para restablecer el acceso.</p>
      </div>
      <ResetPasswordForm />
      <Link className="mt-4 block text-center text-sm font-medium text-primary" href="/login">
        Volver al login
      </Link>
    </div>
  );
}
