import fs from 'node:fs/promises'
import path from 'node:path'
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'

const origin = process.env.LIGHTHOUSE_ORIGIN ?? 'http://127.0.0.1:4173'
const outputDir = path.resolve('reports/lighthouse')
await fs.mkdir(outputDir, { recursive: true })
const packageJson = JSON.parse(await fs.readFile(path.resolve('package.json'), 'utf8'))
const chrome = await launch({ chromeFlags: ['--headless', '--no-sandbox'] })
const pages = ['/', '/nft/emerald-ape-042']
const profiles = [
  { name: 'desktop', formFactor: 'desktop', screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false } },
  { name: 'mobile', formFactor: 'mobile', screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false } },
]

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const summary = {}
for (const page of pages) {
  for (const profile of profiles) {
    const runs = []
    for (let index = 0; index < 3; index += 1) {
      const desktopSettings = profile.name === 'desktop' ? {
        emulatedUserAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        throttling: { rttMs: 40, throughputKbps: 10_240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
      } : {}
      const result = await lighthouse(`${origin}${page}`, { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], formFactor: profile.formFactor, screenEmulation: profile.screenEmulation, ...desktopSettings })
      const categories = result.lhr.categories
      runs.push({ performance: categories.performance.score * 100, accessibility: categories.accessibility.score * 100, bestPractices: categories['best-practices'].score * 100, seo: categories.seo.score * 100, lcp: result.lhr.audits['largest-contentful-paint']?.numericValue ?? null, cls: result.lhr.audits['cumulative-layout-shift']?.numericValue ?? null, tbt: result.lhr.audits['total-blocking-time']?.numericValue ?? null })
      await fs.writeFile(path.join(outputDir, `${page === '/' ? 'home' : 'nft-detail'}-${profile.name}-run-${index + 1}.html`), result.report[0])
      await fs.writeFile(path.join(outputDir, `${page === '/' ? 'home' : 'nft-detail'}-${profile.name}-run-${index + 1}.json`), result.report[1])
    }
    summary[`${page}-${profile.name}`] = Object.fromEntries(Object.keys(runs[0]).map((key) => [key, median(runs.map((run) => run[key]))]))
  }
}
await fs.writeFile(path.join(outputDir, 'summary.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  origin,
  tooling: {
    node: process.version,
    lighthouse: packageJson.devDependencies.lighthouse,
    chromium: 'chrome-launcher (installed browser)',
    formFactors: profiles.map((profile) => ({ name: profile.name, screen: profile.screenEmulation, throttling: profile.name === 'desktop' ? '40ms RTT, 10Mbps, CPU x1' : 'Lighthouse mobile default' })),
    runsPerScenario: 3,
  },
  runs: summary,
}, null, 2))
try { chrome.kill() } catch { /* Chrome may already be closed. */ }
console.log(JSON.stringify(summary, null, 2))

