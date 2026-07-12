const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

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
  await page.screenshot({ path: path.join(out, 'landing-desktop.png'), fullPage: true });
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.locator('#demo-button').click();
  await page.locator('#play-panel').waitFor({ state: 'visible' });

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
    if (!trainingShot && (await page.locator('#phase-name').textContent()) === '둘을 같이') {
      await page.screenshot({ path: path.join(out, 'training-desktop.png'), fullPage: false });
      trainingShot = true;
    }
    await page.waitForTimeout(90);
  }
  const resultVisible = await page.locator('#result-panel').isVisible();
  await page.screenshot({ path: path.join(out, resultVisible ? 'result-desktop.png' : 'timeout-desktop.png'), fullPage: false });
  const resultText = resultVisible ? await page.locator('#result-panel').innerText() : '';
  const savedRecords = await page.evaluate(() => localStorage.getItem('think-hands-trainer-v1'));

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto('http://127.0.0.1:5588/', { waitUntil: 'domcontentloaded' });
  await mobile.screenshot({ path: path.join(out, 'landing-mobile.png'), fullPage: true });
  const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const report = {
    desktopOverflow,
    mobileOverflow,
    trainingShot,
    resultVisible: resultVisible && /SESSION COMPLETE/.test(resultText),
    phaseAtEnd: await page.locator('#phase-name').textContent(),
    phaseTimeAtEnd: await page.locator('#phase-time').textContent(),
    totalTimeAtEnd: await page.locator('#total-time').textContent(),
    pauseVisible: await page.locator('#pause-overlay').isVisible(),
    resultText: resultText.slice(0, 900),
    demoRecordSaved: Boolean(savedRecords),
    errors
  };
  fs.writeFileSync(path.join(out, 'qa-report.json'), JSON.stringify(report, null, 2), 'utf8');
  await browser.close();
  if (errors.length || desktopOverflow > 1 || mobileOverflow > 1 || !trainingShot || !report.resultVisible || report.demoRecordSaved) {
    process.stderr.write(JSON.stringify(report, null, 2) + '\n');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
})().catch((error) => {
  process.stderr.write(error.stack + '\n');
  process.exit(1);
});
