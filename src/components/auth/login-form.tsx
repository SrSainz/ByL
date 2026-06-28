"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import Link from "next/link";
import { signInAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: AuthState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input className="field" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <label className="label" htmlFor="password">
          Contraseña
        </label>
        <div className="relative">
          <input
            className="field pr-11"
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
          />
          <button
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="focus-ring absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-subtle hover:text-foreground"
            type="button"
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {state.error ? <p className="helper-error">{state.error}</p> : null}
      <Button className="w-full" type="submit" disabled={pending}>
        <LogIn className="h-4 w-4" aria-hidden="true" />
        {pending ? "Comprobando acceso..." : "Entrar a la aplicación"}
      </Button>
      <Link className="block text-center text-sm font-medium text-primary" href="/reset-password">
        No recuerdo mi contraseña
      </Link>
      <p className="text-center text-xs text-muted">
        Si no tienes acceso, pide a un administrador que cree tu usuario.
      </p>
    </form>
  );
}
