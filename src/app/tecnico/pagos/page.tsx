import { ArrowDownToLine, CircleDollarSign, ReceiptText, WalletCards } from "lucide-react";

import { TechnicianDashboardShell } from "@/components/technicians/technician-dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatClp } from "@/lib/utils";

const transactions = [
  { service: "Instalación de luminarias", date: "12 ago.", amount: 64000, status: "Pagado" },
  { service: "Reparación de enchufe", date: "10 ago.", amount: 42000, status: "Pagado" },
  { service: "Revisión de tablero", date: "Hoy", amount: 78000, status: "Por confirmar" },
];

export default function TechnicianPaymentsPage() {
  return <TechnicianDashboardShell activeHref="/tecnico/pagos"><div><p className="text-sm font-semibold text-primary">Resumen financiero</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Pagos e ingresos</h1><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Revisa el total del servicio, la comisión de plataforma y el monto correspondiente a tu trabajo por separado.</p></div><div className="mt-7 grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><CircleDollarSign className="size-5 text-primary" /><p className="mt-4 text-2xl font-bold">{formatClp(486000)}</p><p className="mt-1 text-sm text-muted-foreground">ingresos de agosto</p></CardContent></Card><Card><CardContent className="p-5"><WalletCards className="size-5 text-primary" /><p className="mt-4 text-2xl font-bold">{formatClp(64000)}</p><p className="mt-1 text-sm text-muted-foreground">próximo pago</p></CardContent></Card><Card><CardContent className="p-5"><ArrowDownToLine className="size-5 text-primary" /><p className="mt-4 text-2xl font-bold">{formatClp(0)}</p><p className="mt-1 text-sm text-muted-foreground">devoluciones pendientes</p></CardContent></Card></div><Card className="mt-5"><CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="size-5 text-primary" />Movimientos recientes</CardTitle></CardHeader><CardContent className="divide-y">{transactions.map((transaction) => <div key={transaction.service} className="flex items-center justify-between gap-4 py-4"><div><p className="font-semibold">{transaction.service}</p><p className="mt-1 text-sm text-muted-foreground">{transaction.date}</p></div><div className="text-right"><p className="font-bold">{formatClp(transaction.amount)}</p><Badge className="mt-1" variant={transaction.status === "Pagado" ? "success" : "warning"}>{transaction.status}</Badge></div></div>)}</CardContent></Card></TechnicianDashboardShell>;
}
