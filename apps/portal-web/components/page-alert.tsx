import { IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/** Единый способ показать ошибку или служебное сообщение на экране кабинета */
export function PageAlert({
  message,
  variant = "default"
}: {
  message: string;
  variant?: "default" | "destructive";
}) {
  if (!message) return null;

  return (
    <Alert variant={variant}>
      {variant === "destructive" ? <IconAlertCircle /> : <IconInfoCircle />}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
