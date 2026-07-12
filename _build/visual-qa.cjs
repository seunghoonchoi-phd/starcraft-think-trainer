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
  await page.screenshot({ path: path.join(out, 'trainer-start-desktop.png'), fullPage: false });
  const initial = await page.evaluate(() => {
    const trainer = document.querySelector('#trainer')?.getBoundingClientRect();
    const app = document.querySelector('#app')?.getBoundingClientRect();
    const heading = document.querySelector('.start-panel h3');
    const guide = document.querySelector('.start-panel > div:first-child > p:last-child');
    const base = document.querySelector('.base');
    return {
      visiblePages: [...document.querySelectorAll('.page-view[data-page]')]
        .filter((view) => !view.hidden)
        .map((view) => view.dataset.page),
      headerPresent: Boolean(document.querySelector('.site-header')),
      navPresent: Boolean(document.querySelector('[data-page-link], .page-stepper')),
      phaseButtons: document.querySelectorAll('.phase-button').length,
      trainerTop: trainer?.top,
      trainerHeight: trainer?.height,
      appTop: app?.top,
      appHeight: app?.height,
      viewportHeight: window.innerHeight,
      headingSize: Number.parseFloat(getComputedStyle(heading).fontSize),
      guideSize: Number.parseFloat(getComputedStyle(guide).fontSize),
      baseSize: Number.parseFloat(getComputedStyle(base).fontSize),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  await page.locator('#start-button').click();
  await page.locator('#play-panel').waitFor({ state: 'visible' });
  const fullStart = await page.evaluate(() => ({
    phase: document.querySelector('#phase-name')?.textContent,
    totalLabel: document.querySelector('#total-time-label')?.textContent,
    totalTime: document.querySelector('#total-time')?.textContent
  }));
  await page.locator('#home-button').click();
  await page.locator('#start-panel').waitFor({ state: 'visible' });

  await page.locator('[data-phase="decision"] .phase-button').click();
  await page.locator('#play-panel').waitFor({ state: 'visible' });
  await page.locator('#decision-card').waitFor({ state: 'visible' });
  const reading = await page.evaluate(() => ({
    phase: document.querySelector('#phase-name')?.textContent,
    status: document.querySelector('#decision-status')?.textContent,
    optionsDisabled: [...document.querySelectorAll('#decision-options button')].every((button) => button.disabled),
    totalLabel: document.querySelector('#total-time-label')?.textContent
  }));
  await page.screenshot({ path: path.join(out, 'decision-reading-desktop.png'), fullPage: false });

  await page.getByText('판단 시작', { exact: true }).waitFor({ state: 'visible' });
  const answering = await page.evaluate(() => ({
    status: document.querySelector('#decision-status')?.textContent,
    optionsEnabled: [...document.querySelectorAll('#decision-options button')].every((button) => !button.disabled)
  }));
  await page.locator('#pause-button').click();
  const pauseVisible = await page.locator('#pause-overlay').isVisible();
  const timeBefore = await page.locator('#total-time').textContent();
  await page.waitForTimeout(700);
  const timeAfter = await page.locator('#total-time').textContent();
  await page.locator('#resume-button').click();
  await page.locator('#home-button').click();
  const home = await page.evaluate(() => ({
    startVisible: !document.querySelector('#start-panel')?.hidden,
    playHidden: Boolean(document.querySelector('#play-panel')?.hidden),
    status: document.querySelector('#practice-status')?.textContent,
    totalLabel: document.querySelector('#total-time-label')?.textContent,
    totalTime: document.querySelector('#total-time')?.textContent
  }));
  await page.screenshot({ path: path.join(out, 'trainer-home-desktop.png'), fullPage: false });
  await browser.close();

  const passed = initial.visiblePages.length === 1
    && initial.visiblePages[0] === 'trainer'
    && !initial.headerPresent
    && !initial.navPresent
    && initial.phaseButtons === 8
    && Math.abs(initial.trainerTop) <= 1
    && Math.abs(initial.appTop) <= 1
    && Math.abs(initial.trainerHeight - initial.viewportHeight) <= 1
    && Math.abs(initial.appHeight - initial.viewportHeight) <= 1
    && initial.headingSize >= 60
    && initial.guideSize >= 18
    && initial.baseSize >= 14
    && initial.overflow <= 1
    && fullStart.phase === '준비'
    && fullStart.totalLabel === '전체 시간'
    && fullStart.totalTime === '10:00'
    && reading.phase === '판단 기준선'
    && reading.status === '읽는 시간 3초'
    && reading.optionsDisabled
    && reading.totalLabel === '단계 시간'
    && answering.status === '판단 시작'
    && answering.optionsEnabled
    && pauseVisible
    && timeBefore === timeAfter
    && home.startVisible
    && home.playHidden
    && home.status.includes('훈련을 멈추고 홈으로 돌아왔습니다.')
    && home.totalLabel === '전체 시간'
    && home.totalTime === '10:00'
    && errors.length === 0;
  const report = { baseUrl, initial, fullStart, reading, answering, pauseVisible, timeBefore, timeAfter, home, errors, passed };
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
