const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function readRoute(page, expectedId) {
  await page.locator(`#${expectedId}`).waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  return page.evaluate((id) => {
    const visiblePages = [...document.querySelectorAll('.page-view[data-page]')]
      .filter((view) => !view.hidden)
      .map((view) => view.dataset.page);
    const activeLink = document.querySelector('[data-page-link][aria-current="page"]');
    return {
      expectedId: id,
      visiblePages,
      activeHref: activeLink?.getAttribute('href') || '',
      position: document.querySelector('#page-position')?.textContent || '',
      scrollY: window.scrollY,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  }, expectedId);
}

function routePassed(route) {
  return route
    && route.visiblePages.length === 1
    && route.visiblePages[0] === route.expectedId
    && route.activeHref === `#${route.expectedId}`
    && Math.abs(route.scrollY) <= 1
    && route.overflow <= 1;
}

(async () => {
  const out = 'C:/Users/Public/ogwork/think-hands';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
  page.on('pageerror', (error) => errors.push('pageerror: ' + error.stack));

  await page.goto('http://127.0.0.1:5588/?qa=1', { waitUntil: 'networkidle' });
  const routes = { home: await readRoute(page, 'home') };
  await page.screenshot({ path: path.join(out, 'home-desktop.png'), fullPage: false });

  await page.locator('.site-nav a[href="#mechanism"]').click();
  routes.mechanism = await readRoute(page, 'mechanism');
  await page.screenshot({ path: path.join(out, 'method-desktop.png'), fullPage: false });
  await page.goBack();
  await page.waitForFunction(() => location.hash === '' || location.hash === '#home');
  const browserBackWorked = routePassed(await readRoute(page, 'home'));

  await page.locator('.hero-actions .primary-button').click();
  routes.trainer = await readRoute(page, 'trainer');
  await page.screenshot({ path: path.join(out, 'trainer-start-desktop.png'), fullPage: false });
  await page.locator('#demo-button').click();
  await page.locator('#play-panel').waitFor({ state: 'visible' });

  await page.locator('.site-nav a[href="#mechanism"]').click();
  routes.paused = await readRoute(page, 'mechanism');
  const pausedTimeBefore = await page.locator('#total-time').textContent();
  const overlayAway = await page.locator('#pause-overlay').isVisible();
  await page.waitForTimeout(650);
  const pausedTimeAfter = await page.locator('#total-time').textContent();
  await page.screenshot({ path: path.join(out, 'paused-desktop.png'), fullPage: false });

  await page.locator('#previous-page').click();
  await page.locator('#trainer').waitFor({ state: 'visible' });
  const overlayOnReturn = await page.locator('#pause-overlay').isVisible();
  const pauseMessage = await page.locator('#pause-overlay p').textContent();
  await page.locator('#resume-button').click();

  let trainingShot = false;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && await page.locator('#result-panel').isHidden()) {
    const target = page.locator('#motor-target');
    if (await target.isVisible()) {
      const label = (await page.locator('#target-key').textContent() || '').trim();
      if (/^[1-4]$/.test(label)) {
        await page.keyboard.press(label);
        if (await target.isVisible()) await page.evaluate(() => document.querySelector('#motor-target')?.click());
      }
    }
    const decision = page.locator('#decision-card');
    if (await decision.isVisible()) await page.keyboard.press('q');
    if (!trainingShot && (await page.locator('#phase-name').textContent()) === '동시 수행') {
      await page.screenshot({ path: path.join(out, 'training-desktop.png'), fullPage: false });
      trainingShot = true;
    }
    await page.waitForTimeout(90);
  }

  const resultVisible = await page.locator('#result-panel').isVisible();
  await page.screenshot({ path: path.join(out, resultVisible ? 'result-desktop.png' : 'timeout-desktop.png'), fullPage: false });
  const resultText = resultVisible ? await page.locator('#result-panel').innerText() : '';
  const savedRecords = await page.evaluate(() => localStorage.getItem('think-hands-trainer-v1'));

  await page.locator('.site-nav a[href="#evidence"]').click();
  routes.evidence = await readRoute(page, 'evidence');
  await page.screenshot({ path: path.join(out, 'evidence-desktop.png'), fullPage: false });

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto('http://127.0.0.1:5588/', { waitUntil: 'domcontentloaded' });
  const mobileHome = await readRoute(mobile, 'home');
  const mobileNavVisible = await mobile.locator('.site-nav').isVisible();
  await mobile.screenshot({ path: path.join(out, 'home-mobile.png'), fullPage: false });
  await mobile.locator('.site-nav a[href="#mechanism"]').click();
  const mobileMechanism = await readRoute(mobile, 'mechanism');
  await mobile.screenshot({ path: path.join(out, 'method-mobile.png'), fullPage: false });

  const report = {
    routes,
    browserBackWorked,
    pauseOnPageChange: {
      pausedTimeBefore,
      pausedTimeAfter,
      timeStopped: pausedTimeBefore === pausedTimeAfter,
      overlayAway,
      overlayOnReturn,
      pauseMessage
    },
    mobile: { home: mobileHome, mechanism: mobileMechanism, navVisible: mobileNavVisible },
    trainingShot,
    resultVisible: resultVisible && /훈련 결과/.test(resultText),
    phaseAtEnd: await page.locator('#phase-name').textContent(),
    phaseTimeAtEnd: await page.locator('#phase-time').textContent(),
    totalTimeAtEnd: await page.locator('#total-time').textContent(),
    resultText: resultText.slice(0, 900),
    demoRecordSaved: Boolean(savedRecords),
    errors
  };
  fs.writeFileSync(path.join(out, 'qa-report.json'), JSON.stringify(report, null, 2), 'utf8');
  await browser.close();

  const allDesktopRoutesPassed = Object.values(routes).every(routePassed);
  const pausePassed = report.pauseOnPageChange.timeStopped
    && !report.pauseOnPageChange.overlayAway
    && report.pauseOnPageChange.overlayOnReturn
    && report.pauseOnPageChange.pauseMessage.includes('다른 화면');
  const mobilePassed = routePassed(mobileHome) && routePassed(mobileMechanism) && mobileNavVisible;
  if (errors.length || !allDesktopRoutesPassed || !browserBackWorked || !pausePassed || !mobilePassed || !trainingShot || !report.resultVisible || report.demoRecordSaved) {
    process.stderr.write(JSON.stringify(report, null, 2) + '\n');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
})().catch((error) => {
  process.stderr.write(error.stack + '\n');
  process.exit(1);
});
