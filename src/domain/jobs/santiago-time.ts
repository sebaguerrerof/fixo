export const JOB_TIME_ZONE = "America/Santiago";
/** Enumerates real instants; gaps have zero candidates, overlaps require an explicit choice. */
export function santiagoInstants(date: string, time: string): readonly string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return [];
  const [year, month, day] = date.split("-").map(Number), [hour, minute] = time.split(":").map(Number);
  if (hour > 23 || minute > 59) return [];
  const wall = Date.UTC(year, month - 1, day, hour, minute), result: string[] = [];
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: JOB_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = new Date(wall - offset * 60000), parts = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type, p.value]));
    if (`${parts.year}-${parts.month}-${parts.day}` === date && `${parts.hour}:${parts.minute}` === time) result.push(instant.toISOString());
  }
  return result.sort();
}
export function resolveSantiagoInstant(date: string, time: string, choice?: "first" | "second"): string {
  const candidates = santiagoInstants(date, time);
  if (!candidates.length) throw new Error("La hora no existe en America/Santiago. Elige otra franja.");
  if (candidates.length > 1 && !choice) throw new Error("La hora se repite por cambio de horario. Elige una ocurrencia.");
  const result = candidates[choice === "second" ? 1 : 0];
  if (!result) throw new Error("Ocurrencia horaria inválida.");
  return result;
}
