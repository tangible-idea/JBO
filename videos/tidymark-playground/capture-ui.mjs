import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
fs.mkdirSync('assets/ui',{recursive:true});
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage();
await page.setViewport({width:1600,height:1080,deviceScaleFactor:2});
await page.goto('https://tidy.tmtt.link/',{waitUntil:'networkidle2',timeout:60000});
await page.evaluate(()=>document.fonts.ready);
await page.addStyleTag({content:'* { animation-duration:0s!important; transition-duration:0s!important; }'});
for (let i=0;i<3;i++){
 const buttons=await page.$$('.pages button'); await buttons[i].click();
 await (await page.$('.popup')).screenshot({path:`assets/ui/popup-${i}.png`});
}
await (await page.$('.safe')).screenshot({path:'assets/ui/safe.png'});
await (await page.$('.plan')).screenshot({path:'assets/ui/plan.png'});
await (await page.$('.hero')).screenshot({path:'assets/ui/hero.png'});
await browser.close();
console.log('Captured live website popup variants, move plan, safety section, hero at 2x.');
