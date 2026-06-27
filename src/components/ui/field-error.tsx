export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="helper-error">{message}</p>;
}
