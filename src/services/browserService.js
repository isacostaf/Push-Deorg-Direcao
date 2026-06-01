const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");
const { isVercel } = require("../config");

async function createBrowser() {
  if (isVercel()) {
    const executablePath = await chromium.executablePath();
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  }

  // Em ambiente local, usamos o pacote puppeteer completo,
  // que resolve automaticamente o Chrome/Chromium.
  const localPuppeteer = require("puppeteer");

  return localPuppeteer.launch({
    headless: true,
  });
}

module.exports = {
  createBrowser,
};
