import { NextResponse } from "next/server"
import { isMock, sessionToken } from "@/lib/server/flyte-api"
import { flyteJson, mockTrips } from "@/lib/server/paypal"
import { adaptTrips } from "@/lib/server/adapt"
import { mockTripView } from "@/lib/mock/engine"

/** The signed-in traveller's trips. */
export async function GET(request: Request) {
  if (!(await sessionToken())) return NextResponse.json({ detail: "Sign in to see your trips." }, { status: 401 })
  if (isMock()) return NextResponse.json({ trips: (await mockTrips()).map(mockTripView) })
  const result = await flyteJson(request, "trips", { method: "GET" })
  if (!result.ok) return result.response
  return NextResponse.json({ trips: adaptTrips(result.data) })
}
