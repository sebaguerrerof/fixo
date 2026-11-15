"use client";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/** Submit button for server-action forms: shows progress and blocks repeated activation while the action runs. */
export function PendingSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button className="w-full" loading={pending} size="lg" type="submit">{label}</Button>;
}
