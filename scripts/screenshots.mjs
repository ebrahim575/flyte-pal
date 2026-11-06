// Drives the full mock flow in headless Chromium and saves screenshots.
//   npm run build && npm start   (mock mode: no FLYTE_BACKEND_URL)
//   node scripts/screenshots.mjs [baseUrl] [outDir]
import { chromium } from "@playwright/test"
import { mkdirSync } from "node:fs"

const BASE = process.argv[2] ?? "http://localhost:3000"
const OUT = process.argv[3] ?? "docs/screenshots"
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 375, height: 812 },
}

const problems = []

// No microphone in headless Chromium: a scripted voice engine stands in for
// ElevenLabs (lib/voice/engines.ts looks for window.__palVoiceEngine). The
// test says things with window.__palVoice.partial() / .commit().
function installScriptedVoice() {
  window.__palVoiceEngine = () => {
    const h = {}
    window.__palVoice = {
      partial: (t) => h.cur?.onPartial(t),
      commit: (t) => h.cur?.onCommit(t),
      lastSpoken: "",
    }
    return {
      kind: "scripted",
      async listen(handlers) {
        if (window.__palVoiceDeny) throw new Error("NotAllowedError: Permission denied")
        h.cur = handlers
        setTimeout(() => handlers.onReady(), 400)
        return { mute() {}, close() {} }
      },
      speaker() {
        let start = -1
        let timer = 0
        let resolve = null
        return {
          play(text, onWords) {
            return new Promise((res) => {
              resolve = res
              const words = []
              let t = 0
              for (const w of text.split(/\s+/).filter(Boolean)) {
                words.push({ text: w, start: t, end: t + 0.24 })
                t += 0.26
              }
              onWords(words)
              start = performance.now()
              window.__palVoice.lastSpoken = text
              timer = setTimeout(() => {
                start = -1
                res()
              }, t * 1000 + 400)
            })
          },
          stop() {
            clearTimeout(timer)
            start = -1
            resolve?.()
          },
          clock: () => (start < 0 ? -1 : (performance.now() - start) / 1000),
          level: () => (start < 0 ? 0 : 0.35 + 0.35 * Math.abs(Math.sin(performance.now() / 110))),
        }
      },
      close() {},
    }
  }
}

async function noSideScroll(page, label) {
  const overflow = await page.evaluate(() => {
    const widest = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
    return widest - window.innerWidth
  })
  if (overflow > 0) problems.push(`${label}: page is ${overflow}px wider than the viewport`)
}

async function run(device, theme) {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORTS[device],
    deviceScaleFactor: 2,
    colorScheme: theme,
    isMobile: device === "mobile",
    hasTouch: device === "mobile",
  })
  await context.addInitScript((t) => localStorage.setItem("theme", t), theme)
  await context.addInitScript(installScriptedVoice)
  const page = await context.newPage()
  try {
    await flow(page, device, theme)
  } catch (error) {
    await page.screenshot({ path: `${OUT}/${device}-${theme}-FAILED.png` }).catch(() => {})
    throw error
  } finally {
    await browser.close()
  }
}

async function flow(page, device, theme) {
  page.on("console", (m) => m.type() === "error" && problems.push(`${device}-${theme} console: ${m.text()}`))
  page.on("pageerror", (e) => problems.push(`${device}-${theme} page error: ${e.message}`))
  const shot = (name) => page.screenshot({ path: `${OUT}/${device}-${theme}-${name}.png` })
  const tag = (s) => `${device}-${theme}-${s}`

  await page.goto(BASE, { waitUntil: "networkidle" })
  await page.waitForTimeout(3200)
  await shot("1-landing")
  await noSideScroll(page, tag("landing"))

  // The "how it works" story: pinned and scrubbed on desktop, stacked on phones.
  if (device === "desktop") {
    const top = await page.evaluate(() => document.querySelector("#how").getBoundingClientRect().top + window.scrollY)
    for (const [at, name] of [[1050, "1b-story-search"], [1700, "1c-story-paypal"], [2420, "1d-story-booked"]]) {
      await page.evaluate((y) => window.scrollTo(0, y), top + at)
      await page.waitForTimeout(1100)
      await shot(name)
    }
  } else {
    await page.getByRole("heading", { name: "Pay with PayPal" }).last().scrollIntoViewIfNeeded()
    await page.waitForTimeout(900)
    await shot("1c-story-paypal")
  }
  await noSideScroll(page, tag("story"))
  await page.getByRole("heading", { name: "Why we built this" }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await shot("1e-why")
  const why = await page.locator("section[aria-labelledby=why-title]").innerText()
  if (!why.includes("just agentically now.") || !why.includes("Read the full story")) problems.push(`${tag("why")}: story text or link missing`)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(600)

  await page.getByRole("link", { name: "Start booking" }).click()
  await page.waitForURL("**/book")
  await page.getByRole("button", { name: /Continue as demo traveller/ }).waitFor()
  await page.waitForTimeout(900)
  await shot("2-gate")
  await noSideScroll(page, tag("gate"))
  await page.getByRole("button", { name: /Continue as demo traveller/ }).click()
  await page.getByRole("button", { name: /Dubai, last week of December/ }).waitFor()
  await page.waitForTimeout(700)
  await shot("2-empty")

  await page.getByRole("button", { name: /Dubai, last week of December/ }).click()
  await page.getByText("Searching global flight inventory").waitFor()
  await page.waitForTimeout(1500)
  await shot("3-searching")
  await page.getByText("Comparing fares").waitFor({ timeout: 10000 })
  await page.waitForTimeout(500)
  await shot("3b-search-settled")

  await page.getByRole("button", { name: "Book this flight" }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(1400)
  await shot("4-offer")
  await noSideScroll(page, tag("offer"))
  const price = await page.locator("article").first().innerText()
  const total = Number(/\$([\d,]+\.\d{2})/.exec(price)?.[1].replace(/,/g, ""))
  if (!(total < 900)) problems.push(`${tag("offer")}: budget ignored, total ${total}`)

  await page.getByRole("button", { name: "Book this flight" }).click()
  await page.getByRole("button", { name: "Yes, confirm" }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  await shot("5-confirm")
  await page.getByRole("button", { name: "Yes, confirm" }).click()

  await page.getByRole("button", { name: /Approve PayPal payment/ }).waitFor({ timeout: 20000 })
  const payText = await page.getByRole("region", { name: "Payment" }).innerText()
  if (!/charged \$0\.01 in PayPal sandbox/.test(payText)) problems.push(`${tag("payment")}: no $0.01 sandbox charge shown`)
  await page.waitForTimeout(900)
  await shot("6-payment")
  await noSideScroll(page, tag("payment"))
  await page.getByRole("radio", { name: "Venmo" }).click()
  await page.getByRole("button", { name: /Approve Venmo payment/ }).click()

  await page.getByRole("button", { name: /Approve Venmo payment/ }).waitFor({ state: "detached" })
  await page.getByTestId("payment-approved").waitFor({ timeout: 20000 })
  await page.waitForTimeout(900)
  await shot("7-approved")
  await page.locator('section[data-phase="takeoff"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(450)
  await shot("7b-takeoff")
  await page.getByRole("article", { name: "Demo booking confirmation" }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(2600)
  await shot("8-booked")
  await noSideScroll(page, tag("booked"))
  const pass = await page.getByRole("article", { name: "Demo booking confirmation" }).innerText()
  if (!/demo booking/i.test(pass)) problems.push(`${tag("booked")}: pass is not labelled as a demo booking`)
  if (!/charged \$0\.01 in PayPal sandbox/.test(pass)) problems.push(`${tag("booked")}: pass doesn't state the $0.01 charge`)
  if (/Paid with PayPal/.test(pass)) problems.push(`${tag("booked")}: pass still claims the fare was paid`)
  if (!/SIMULATED-[0-9A-F]{12}/.test(pass) || !/DEMO00/.test(pass)) problems.push(`${tag("booked")}: simulated references missing`)

  // Voice, on a fresh trip in the same chat.
  await page.getByRole("button", { name: "New trip" }).click()
  await page.getByRole("button", { name: "Talk to the agent" }).click()
  const stage = page.getByTestId("voice-stage")
  await stage.getByText("Just talk. For example:").waitFor({ timeout: 10000 })
  await page.waitForTimeout(900)
  await shot("9a-voice-listening")
  await noSideScroll(page, tag("voice-listening"))
  await page.evaluate(() => window.__palVoice.partial("Lisbon in March for five"))
  await page.getByTestId("voice-partial").waitFor()
  await page.waitForTimeout(400)
  await shot("9b-voice-hearing")
  await page.evaluate(() => window.__palVoice.commit("Lisbon in March for five nights"))
  await stage.getByText("Searching global flight inventory").waitFor({ timeout: 10000 })
  await page.waitForTimeout(500)
  await shot("9c-voice-thinking")
  await stage.getByText("Speaking", { exact: true }).waitFor({ timeout: 20000 })
  // Echo: the agent's own words reaching the mic must not cut it off.
  const spoken = await page.evaluate(() => window.__palVoice.lastSpoken)
  if (!/^The best is .*Want me to book it\?$/.test(spoken)) problems.push(`${tag("voice")}: fare not said in one line: ${spoken}`)
  if (/\*|\|/.test(spoken)) problems.push(`${tag("voice")}: markdown read aloud: ${spoken}`)
  await page.evaluate((t) => window.__palVoice.partial(t), spoken.split(" ").slice(2, 7).join(" "))
  await page.waitForTimeout(300)
  if (!(await stage.getByText("Speaking", { exact: true }).isVisible())) problems.push(`${tag("voice")}: echo cut the reply off`)
  await page.getByTestId("voice-fare").waitFor({ timeout: 15000 })
  await page.waitForTimeout(600)
  await shot("9d-voice-speaking")
  await noSideScroll(page, tag("voice-speaking"))
  // Barge-in: the traveller talking over the reply stops it.
  await page.evaluate(() => window.__palVoice.partial("actually make it Paris instead"))
  await stage.getByText("Listening", { exact: true }).waitFor({ timeout: 3000 }).catch(() => problems.push(`${tag("voice")}: barge-in didn't stop the reply`))
  await page.getByRole("button", { name: "Type instead" }).click()
  await page.getByTestId("voice-dock").waitFor()
  await page.waitForTimeout(500)
  await shot("9e-voice-dock")
  await page.getByRole("button", { name: "End voice" }).click()

  // Microphone refused: a plain message and the way back to typing.
  await page.evaluate(() => (window.__palVoiceDeny = true))
  await page.getByRole("button", { name: "Talk to the agent" }).click()
  await stage.getByText("Microphone access is blocked").waitFor({ timeout: 5000 })
  await page.waitForTimeout(500)
  await shot("9f-voice-denied")
  await stage.getByRole("button", { name: "Keep typing" }).click()
  await page.evaluate(() => (window.__palVoiceDeny = false))
  await page.locator("#composer").waitFor()

  await page.getByRole("link", { name: "Your trips" }).first().click()
  await page.waitForURL("**/trips")
  await page.getByText("Demo booking").first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(900)
  await shot("10-trips")
  await noSideScroll(page, tag("trips"))
  const trips = await page.locator("main").innerText()
  if (!/SIMULATED-[0-9A-F]{12}/.test(trips) || !/charged \$0\.01 in PayPal sandbox/.test(trips)) problems.push(`${tag("trips")}: trip missing reference or charge`)
}

// ONLY=mobile:dark runs one combination.
const only = process.env.ONLY?.split(":")
for (const device of ["desktop", "mobile"]) {
  for (const theme of ["light", "dark"]) {
    if (only && (only[0] !== device || only[1] !== theme)) continue
    await run(device, theme)
    console.log(`ok ${device} ${theme}`)
  }
}

if (problems.length) {
  console.log("PROBLEMS:\n" + problems.join("\n"))
  process.exit(1)
}
console.log("All flows passed")
