"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
export function PendingSubmit({label}:{label:string}) {const {pending}=useFormStatus();return <Button type="submit" className="w-full" disabled={pending}>{pending?"Procesando…":label}</Button>;}
