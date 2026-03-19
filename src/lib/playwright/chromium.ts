export async function getChromiumBrowserType() {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
  }

  const { chromium } = await import('playwright');
  return chromium;
}

export async function getChromiumExecutablePath() {
  const chromium = await getChromiumBrowserType();
  return chromium.executablePath();
}
