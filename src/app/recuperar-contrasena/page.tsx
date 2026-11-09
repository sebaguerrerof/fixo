import { AuthCard } from "@/components/auth/auth-card";
import { RecoveryForm } from "@/components/auth/recovery-form";
export default function RecoveryPage() { return <AuthCard title="Recupera tu acceso" description="Ingresa tu correo para solicitar un enlace seguro. Nunca te pediremos enviar tu contraseña por correo."><RecoveryForm /></AuthCard>; }
