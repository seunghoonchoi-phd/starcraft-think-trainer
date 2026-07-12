const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = process.env.QA_URL || 'http://127.0.0.1:5588/';
const out = 'C:/Users/Public/ogwork/think-hands';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack}`));

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('#trainer').waitFor({ state: 'visible' });
  await page.screenshot({ path: path.join(out, 'trainer-desktop.png'), fullPage: false });
  const initial = await page.evaluate(() => {
    const trainer = document.querySelector('#trainer')?.getBoundingClientRect();
    const app = document.querySelector('#app')?.getBoundingClientRect();
    const heading = document.querySelector('.start-panel h3');
    const guide = document.querySelector('.start-panel > div:first-child > p:last-child');
    return {
      visiblePages: [...document.querySelectorAll('.page-view[data-page]')]
        .filter((view) => !view.hidden)
        .map((view) => view.dataset.page),
      headerPresent: Boolean(document.querySelector('.site-header')),
      navPresent: Boolean(document.querySelector('[data-page-link], .page-stepper')),
      trainerTop: trainer?.top,
      trainerHeight: trainer?.height,
      appTop: app?.top,
      appHeight: app?.height,
      viewportHeight: window.innerHeight,
      headingSize: Number.parseFloat(getComputedStyle(heading).fontSize),
      guideSize: Number.parseFloat(getComputedStyle(guide).fontSize),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  await page.locator('#demo-button').click();
  await page.locator('#play-panel').waitFor({ state: 'visible' });
  const playVisible = await page.locator('#play-panel').isVisible();
  await page.screenshot({ path: path.join(out, 'trainer-play-desktop.png'), fullPage: false });
  await browser.close();

  const passed = initial.visiblePages.length === 1
    && initial.visiblePages[0] === 'trainer'
    && !initial.headerPresent
    && !initial.navPresent
    && Math.abs(initial.trainerTop) <= 1
    && Math.abs(initial.appTop) <= 1
    && Math.abs(initial.trainerHeight - initial.viewportHeight) <= 1
    && Math.abs(initial.appHeight - initial.viewportHeight) <= 1
    && initial.headingSize >= 60
    && initial.guideSize >= 18
    && initial.overflow <= 1
    && playVisible
    && errors.length === 0;
  const report = { baseUrl, initial, playVisible, errors, passed };
  fs.writeFileSync(path.join(out, 'qa-report.json'), JSON.stringify(report, null, 2), 'utf8');
  if (!passed) {
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exit(1);
});
