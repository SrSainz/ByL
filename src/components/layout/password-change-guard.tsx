"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { changeOwnPasswordAction, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const initialState: AuthState = {};

export function PasswordChangeGuard({ mustChange }: { mustChange: boolean }) {
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!mustChange || state.success) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <form action={formAction} className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-white">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Cambia tu contraseña</h2>
            <p className="mt-1 text-sm text-muted">
              Estás usando una contraseña proporcionada por un administrador. Cambia la contraseña antes de continuar.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <PasswordField
            id="password"
            label="Nueva contraseña"
            name="password"
            show={showPassword}
            toggle={() => setShowPassword((value) => !value)}
          />
          <PasswordField
            id="confirm_password"
            label="Confirmar contraseña"
            name="confirm_password"
            show={showConfirm}
            toggle={() => setShowConfirm((value) => !value)}
          />
        </div>

        {state.error ? <p className="mt-4 helper-error">{state.error}</p> : null}
        <Button className="mt-5 w-full" type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar nueva contraseña"}
        </Button>
      </form>
    </div>
  );
}

function PasswordField({
  id,
  label,
  name,
  show,
  toggle
}: {
  id: string;
  label: string;
  name: string;
  show: boolean;
  toggle: () => void;
}) {
  return (
    <div className="space-y-2">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          className="field pr-11"
          id={id}
          minLength={8}
          name={name}
          required
          type={show ? "text" : "password"}
        />
        <button
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="focus-ring absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:bg-surface-subtle hover:text-foreground"
          type="button"
          onClick={toggle}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
