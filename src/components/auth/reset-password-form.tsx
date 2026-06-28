"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: AuthState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          className="field"
          id="email"
          name="email"
          type="email"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect="off"
          inputMode="email"
          placeholder="tu@email.com"
          required
        />
      </div>
      {state.error ? <p className="helper-error">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">{state.success}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar enlace de recuperación"}
      </Button>
      <Link className="block text-center text-sm font-semibold text-primary" href="/login">
        Volver al acceso
      </Link>
    </form>
  );
}
