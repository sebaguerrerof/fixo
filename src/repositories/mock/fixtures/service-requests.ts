import type { ServiceRequest } from "@/domain/entities/service-request";
import { DEMO_CUSTOMER_ID } from "@/repositories/mock/fixtures/demo-accounts";

const hoursAgo = (hours: number): string => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const hoursFromNow = (hours: number): string => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

/**
 * Solicitudes demo del cliente fijo, coherentes con las categorías y técnicos
 * de fixtures/technicians.ts (misma comuna, mismo rubro que el técnico asociado).
 */
export const DEMO_SERVICE_REQUESTS: readonly ServiceRequest[] = [
  {
    id: "req-01",
    customerId: DEMO_CUSTOMER_ID,
    title: "Fuga bajo el lavaplatos",
    categoryId: "cat-gasfiteria",
    description: "Hay una fuga de agua bajo el lavaplatos de la cocina desde ayer; ya puse un balde pero sigue goteando.",
    priority: "standard",
    status: "in_progress",
    locationLabel: "Ñuñoa, depto 302",
    createdAt: hoursAgo(30),
    scheduledFor: hoursAgo(2),
  },
  {
    id: "req-02",
    customerId: DEMO_CUSTOMER_ID,
    title: "Revisión de tablero eléctrico",
    categoryId: "cat-electricidad",
    description: "El tablero eléctrico hace un ruido extraño y una de las llaves se calienta al usar el microondas.",
    priority: "standard",
    status: "receiving_quotes",
    locationLabel: "Providencia, casa",
    createdAt: hoursAgo(10),
    scheduledFor: null,
  },
  {
    id: "req-03",
    customerId: DEMO_CUSTOMER_ID,
    title: "Instalación de aire acondicionado split",
    categoryId: "cat-climatizacion",
    description: "Necesito instalar un equipo split de 12000 BTU recién comprado en el living, incluyendo la salida al exterior.",
    priority: "standard",
    status: "technician_selected",
    locationLabel: "La Reina, casa",
    createdAt: hoursAgo(50),
    scheduledFor: hoursFromNow(20),
  },
  {
    id: "req-04",
    customerId: DEMO_CUSTOMER_ID,
    title: "Cambio de cerradura principal",
    categoryId: "cat-cerrajeria",
    description: "La cerradura de la puerta principal quedó floja y a veces no cierra bien; necesito cambiarla pronto.",
    priority: "urgent",
    status: "matching",
    locationLabel: "Santiago Centro, edificio",
    createdAt: hoursAgo(1),
    scheduledFor: null,
  },
  {
    id: "req-05",
    customerId: DEMO_CUSTOMER_ID,
    title: "Pintura de living y comedor",
    categoryId: "cat-pintura",
    description: "Quiero repintar el living y el comedor con un color neutro, aproximadamente 35 m2 de muros.",
    priority: "standard",
    status: "completed",
    locationLabel: "Recoleta, depto 12B",
    createdAt: hoursAgo(400),
    scheduledFor: hoursAgo(380),
  },
  {
    id: "req-06",
    customerId: DEMO_CUSTOMER_ID,
    title: "Mantención de jardín y poda",
    categoryId: "cat-jardineria",
    description: "Necesito poda de arbustos y mantención general del jardín trasero, tamaño mediano.",
    priority: "standard",
    status: "cancelled",
    locationLabel: "Peñalolén, casa",
    createdAt: hoursAgo(200),
    scheduledFor: null,
  },
  {
    id: "req-07",
    customerId: DEMO_CUSTOMER_ID,
    title: "Reparación de lavadora que no centrifuga",
    categoryId: "cat-electrodomesticos",
    description: "La lavadora lava pero no centrifuga la ropa; hace un ruido fuerte al pasar a esa etapa del ciclo.",
    priority: "standard",
    status: "scheduled",
    locationLabel: "Maipú, casa",
    createdAt: hoursAgo(15),
    scheduledFor: hoursFromNow(48),
  },
];
