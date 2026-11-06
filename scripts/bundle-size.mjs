// First-load JavaScript per page, gzipped, as a browser downloads it.
//   npm run build && npm start, then: node scripts/bundle-size.mjs [baseUrl]
import { chromium } from "@playwright/test"
import { gzipSync } from "node:zlib"

const BASE = process.argv[2] ?? "http://localhost:3000"
const browser = await chromium.launch()
const out = {}
for (const path of ["/", "/book", "/trips"]) {
  const page = await browser.newPage()
  const scripts = new Map()
  page.on("response", async (res) => {
    if (res.request().resourceType() !== "script") return
    try {
      scripts.set(res.url(), (await res.body()).length)
    } catch {}
  })
  await page.goto(BASE + path, { waitUntil: "networkidle" })
  await page.waitForTimeout(1500)
  let gz = 0
  let raw = 0
  for (const url of scripts.keys()) {
    const body = Buffer.from(await (await fetch(url)).arrayBuffer())
    raw += body.length
    gz += gzipSync(body).length
  }
  out[path] = { files: scripts.size, rawKB: Math.round(raw / 1024), gzipKB: Math.round(gz / 1024) }
  await page.close()
}
await browser.close()
console.log(JSON.stringify(out))
