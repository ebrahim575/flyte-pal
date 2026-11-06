export function money(amount: number | null | undefined, currency = "USD") {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return ""
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)
}

/** Times are shown in the airport's own local time, as given. */
export function clock(iso: string | null | undefined) {
  if (!iso) return "--:--"
  const m = /T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return "--:--"
  const h = Number(m[1])
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "AM" : "PM"}`
}

export function day(iso: string | null | undefined) {
  if (!iso) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ""
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12))
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
}

export function duration(minutes: number | null | undefined) {
  if (typeof minutes !== "number" || minutes <= 0) return ""
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`
}

export function stopsLabel(stops?: number, via?: string[]) {
  if (!stops) return "Nonstop"
  const where = via?.length ? ` via ${via.join(", ")}` : ""
  return `${stops} stop${stops > 1 ? "s" : ""}${where}`
}

/** Days after the departure day an arrival lands, from the ISO dates. */
export function dayOffset(departAt?: string | null, arriveAt?: string | null) {
  if (!departAt || !arriveAt) return 0
  const a = Date.parse(departAt.slice(0, 10))
  const b = Date.parse(arriveAt.slice(0, 10))
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86400000)
}
