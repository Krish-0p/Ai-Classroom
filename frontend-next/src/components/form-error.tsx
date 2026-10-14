import { Alert, AlertDescription } from "@/components/ui/alert";
export function FormError({ message }: { message: string | null }) {
  return message ? (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  ) : null;
}
