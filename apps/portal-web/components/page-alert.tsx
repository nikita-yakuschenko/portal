import { CircleAlert, Info } from "lucide-react";

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
      {variant === "destructive" ? <CircleAlert /> : <Info />}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
