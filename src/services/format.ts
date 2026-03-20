export function formatHour(isoString: string) {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "numeric" });
}