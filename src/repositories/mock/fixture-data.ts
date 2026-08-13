import type { Category, Specialty } from "@/domain/entities/category";
import type { ServiceRequest } from "@/domain/entities/service-request";
import type { Technician } from "@/domain/entities/technician";

export const sampleCategories: readonly Category[] = [
  { id: "electricidad", slug: "electricidad", name: "Electricidad", description: "Instalaciones, tableros y emergencias eléctricas.", icon: "bolt", technicianCount: 38 },
  { id: "gasfiteria", slug: "gasfiteria", name: "Gasfitería", description: "Fugas, cañerías, grifería e instalaciones.", icon: "droplets", technicianCount: 42 },
  { id: "cerrajeria", slug: "cerrajeria", name: "Cerrajería", description: "Aperturas, cerraduras y copias de llaves.", icon: "key-round", technicianCount: 19 },
  { id: "climatizacion", slug: "climatizacion", name: "Climatización", description: "Aire acondicionado y calefacción confiable.", icon: "snowflake", technicianCount: 24 },
  { id: "tecnologia", slug: "tecnologia", name: "Tecnología", description: "Computadores, redes y seguridad digital.", icon: "monitor-cog", technicianCount: 31 },
  { id: "electrodomesticos", slug: "electrodomesticos", name: "Electrodomésticos", description: "Reparación y mantención para tu hogar.", icon: "wrench", technicianCount: 27 },
  { id: "pintura", slug: "pintura", name: "Pintura", description: "Pintura interior, exterior y terminaciones.", icon: "paint-roller", technicianCount: 16 },
  { id: "jardineria", slug: "jardineria", name: "Jardinería", description: "Mantención, riego y paisajismo.", icon: "sprout", technicianCount: 14 },
];

export const sampleSpecialties: readonly Specialty[] = [
  { id: "tableros", categoryId: "electricidad", name: "Tableros eléctricos" },
  { id: "fugas", categoryId: "gasfiteria", name: "Detección de fugas" },
  { id: "aperturas", categoryId: "cerrajeria", name: "Aperturas de emergencia" },
  { id: "refrigeracion", categoryId: "climatizacion", name: "Refrigeración" },
  { id: "redes", categoryId: "tecnologia", name: "Redes Wi‑Fi" },
  { id: "lavadoras", categoryId: "electrodomesticos", name: "Lavadoras" },
];

export const sampleTechnicians: readonly Technician[] = [
  {
    id: "tech-001", slug: "camila-rojas", displayName: "Camila Rojas", avatarUrl: null, city: "Ñuñoa", coverageAreas: ["Ñuñoa", "Providencia", "La Reina"], headline: "Electricista SEC para hogares y oficinas", bio: "Especialista en instalaciones seguras, tableros y diagnóstico de fallas eléctricas.", status: "active", categoryIds: ["electricidad"], specialties: ["Tableros eléctricos", "Cortocircuitos"], yearsOfExperience: 11, emergencyEnabled: true, startingPriceClp: 28000, metrics: { rating: 4.9, reviewCount: 126, completedJobs: 284, responseTimeMinutes: 14, completionRate: 98 },
  },
  {
    id: "tech-002", slug: "diego-munoz", displayName: "Diego Muñoz", avatarUrl: null, city: "Providencia", coverageAreas: ["Providencia", "Las Condes", "Vitacura"], headline: "Gasfíter certificado, respuesta el mismo día", bio: "Resuelvo filtraciones, destapes e instalaciones con presupuesto claro antes de comenzar.", status: "active", categoryIds: ["gasfiteria"], specialties: ["Detección de fugas", "Cañerías"], yearsOfExperience: 14, emergencyEnabled: true, startingPriceClp: 25000, metrics: { rating: 4.8, reviewCount: 98, completedJobs: 231, responseTimeMinutes: 18, completionRate: 97 },
  },
  {
    id: "tech-003", slug: "valentina-soto", displayName: "Valentina Soto", avatarUrl: null, city: "Macul", coverageAreas: ["Macul", "Ñuñoa", "San Joaquín"], headline: "Climatización y aire acondicionado", bio: "Mantención estacional e instalación eficiente de equipos residenciales y comerciales.", status: "active", categoryIds: ["climatizacion"], specialties: ["Refrigeración", "Aire acondicionado"], yearsOfExperience: 8, emergencyEnabled: false, startingPriceClp: 32000, metrics: { rating: 4.9, reviewCount: 73, completedJobs: 156, responseTimeMinutes: 24, completionRate: 99 },
  },
  {
    id: "tech-004", slug: "tomas-vargas", displayName: "Tomás Vargas", avatarUrl: null, city: "Santiago", coverageAreas: ["Santiago", "Estación Central", "Independencia"], headline: "Cerrajero 24/7 para emergencias", bio: "Aperturas sin daño, cambio de cilindros y mejora de seguridad para hogares.", status: "active", categoryIds: ["cerrajeria"], specialties: ["Aperturas de emergencia", "Cerraduras digitales"], yearsOfExperience: 16, emergencyEnabled: true, startingPriceClp: 30000, metrics: { rating: 4.7, reviewCount: 142, completedJobs: 408, responseTimeMinutes: 12, completionRate: 96 },
  },
  {
    id: "tech-005", slug: "sofia-herrera", displayName: "Sofía Herrera", avatarUrl: null, city: "Las Condes", coverageAreas: ["Las Condes", "Vitacura", "Lo Barnechea"], headline: "Redes, cámaras y hogares conectados", bio: "Diseño redes estables, instalo cámaras y dejo cada equipo documentado.", status: "active", categoryIds: ["tecnologia"], specialties: ["Redes Wi‑Fi", "Cámaras de seguridad"], yearsOfExperience: 9, emergencyEnabled: false, startingPriceClp: 35000, metrics: { rating: 5, reviewCount: 64, completedJobs: 112, responseTimeMinutes: 27, completionRate: 100 },
  },
  {
    id: "tech-006", slug: "martin-contreras", displayName: "Martín Contreras", avatarUrl: null, city: "La Florida", coverageAreas: ["La Florida", "Puente Alto", "Macul"], headline: "Reparación de lavadoras y refrigeradores", bio: "Diagnóstico honesto, repuestos de calidad y garantía en cada reparación.", status: "active", categoryIds: ["electrodomesticos"], specialties: ["Lavadoras", "Refrigeradores"], yearsOfExperience: 12, emergencyEnabled: true, startingPriceClp: 26000, metrics: { rating: 4.7, reviewCount: 88, completedJobs: 205, responseTimeMinutes: 20, completionRate: 95 },
  },
  {
    id: "tech-007", slug: "paula-reyes", displayName: "Paula Reyes", avatarUrl: null, city: "Maipú", coverageAreas: ["Maipú", "Pudahuel", "Cerrillos"], headline: "Pintura prolija para transformar tus espacios", bio: "Pintura interior y exterior, reparación de muros y terminaciones limpias.", status: "verified", categoryIds: ["pintura"], specialties: ["Pintura interior", "Reparación de muros"], yearsOfExperience: 10, emergencyEnabled: false, startingPriceClp: 24000, metrics: { rating: 4.8, reviewCount: 51, completedJobs: 92, responseTimeMinutes: 34, completionRate: 98 },
  },
  {
    id: "tech-008", slug: "nicolas-araya", displayName: "Nicolás Araya", avatarUrl: null, city: "Quilicura", coverageAreas: ["Quilicura", "Huechuraba", "Conchalí"], headline: "Jardinería, riego y áreas verdes", bio: "Planes de mantención y soluciones de riego pensadas para cada estación.", status: "active", categoryIds: ["jardineria"], specialties: ["Riego automático", "Poda"], yearsOfExperience: 7, emergencyEnabled: false, startingPriceClp: 22000, metrics: { rating: 4.6, reviewCount: 39, completedJobs: 77, responseTimeMinutes: 36, completionRate: 96 },
  },
  {
    id: "tech-009", slug: "andrea-escobar", displayName: "Andrea Escobar", avatarUrl: null, city: "San Miguel", coverageAreas: ["San Miguel", "La Cisterna", "Pedro Aguirre Cerda"], headline: "Electricidad residencial con enfoque seguro", bio: "Revisión de instalaciones, luminarias y protecciones para espacios seguros.", status: "active", categoryIds: ["electricidad"], specialties: ["Instalaciones", "Iluminación"], yearsOfExperience: 6, emergencyEnabled: true, startingPriceClp: 24000, metrics: { rating: 4.6, reviewCount: 46, completedJobs: 81, responseTimeMinutes: 19, completionRate: 94 },
  },
  {
    id: "tech-010", slug: "felipe-silva", displayName: "Felipe Silva", avatarUrl: null, city: "Recoleta", coverageAreas: ["Recoleta", "Santiago", "Providencia"], headline: "Gasfitería para hogares y comunidades", bio: "Cambio griferías, reparo filtraciones y coordino trabajos en edificios.", status: "pending_verification", categoryIds: ["gasfiteria"], specialties: ["Grifería", "Destapes"], yearsOfExperience: 5, emergencyEnabled: false, startingPriceClp: 21000, metrics: { rating: 0, reviewCount: 0, completedJobs: 0, responseTimeMinutes: 42, completionRate: 0 },
  },
  {
    id: "tech-011", slug: "javier-fuentes", displayName: "Javier Fuentes", avatarUrl: null, city: "Peñalolén", coverageAreas: ["Peñalolén", "La Reina", "Macul"], headline: "Soporte computacional a domicilio", bio: "Respaldo, configuración y reparación de computadores para personas y pequeñas empresas.", status: "active", categoryIds: ["tecnologia"], specialties: ["Computadores", "Respaldo de datos"], yearsOfExperience: 13, emergencyEnabled: false, startingPriceClp: 27000, metrics: { rating: 4.8, reviewCount: 109, completedJobs: 193, responseTimeMinutes: 22, completionRate: 98 },
  },
  {
    id: "tech-012", slug: "rodrigo-diaz", displayName: "Rodrigo Díaz", avatarUrl: null, city: "Renca", coverageAreas: ["Renca", "Quinta Normal", "Cerro Navia"], headline: "Técnico de línea blanca", bio: "Reparo cocinas, hornos y lavadoras con diagnóstico transparente.", status: "temporarily_suspended", categoryIds: ["electrodomesticos"], specialties: ["Cocinas", "Hornos"], yearsOfExperience: 15, emergencyEnabled: false, startingPriceClp: 23000, metrics: { rating: 4.2, reviewCount: 28, completedJobs: 65, responseTimeMinutes: 50, completionRate: 84 },
  },
];

export const sampleServiceRequests: readonly ServiceRequest[] = [
  { id: "request-001", customerId: "customer-sample", title: "Revisión de tablero eléctrico", categoryId: "electricidad", priority: "standard", status: "receiving_quotes", locationLabel: "Providencia", createdAt: "2026-08-12T14:20:00.000Z", scheduledFor: null },
  { id: "request-002", customerId: "customer-sample", title: "Fuga bajo el lavaplatos", categoryId: "gasfiteria", priority: "urgent", status: "in_progress", locationLabel: "Ñuñoa", createdAt: "2026-08-13T09:05:00.000Z", scheduledFor: "2026-08-13T10:00:00.000Z" },
  { id: "request-003", customerId: "customer-sample", title: "Mantención de aire acondicionado", categoryId: "climatizacion", priority: "standard", status: "completed", locationLabel: "Macul", createdAt: "2026-07-28T12:00:00.000Z", scheduledFor: "2026-08-02T15:00:00.000Z" },
];
