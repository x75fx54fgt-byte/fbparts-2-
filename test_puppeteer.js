const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
    
    await page.goto('file://' + __dirname + '/admin.html', { waitUntil: 'networkidle2' });
    
    const isDefined = await page.evaluate(() => typeof window.mostrarPestana !== 'undefined');
    console.log("mostrarPestana defined?", isDefined);
    
    await browser.close();
})();
