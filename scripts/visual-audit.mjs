/**
 * Visual audit: screenshots every surface, desktop + mobile, including
 * interactive states (item sheet, cart, logged-in dashboard).
 * Usage: node scripts/visual-audit.mjs [base] -> writes to screenshots/
 */
import { chromium, devices } from "playwright";
import { mkdirSync, readFileSync } from "fs";
import { config } from "dotenv";
config({ path: ".env.local" });

const ROOT = process.argv[2] ?? "http://localhost:3000";
const STORE = process.argv[3] ?? "http://demo-a.localtest.me:3000";
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const adminPass = (() => {
  try {
    return readFileSync(".admin-credentials.txt", "utf8").match(/password: (.+)/)[1].trim();
  } catch {
    return null;
  }
})();

async function shoot(page, name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`shot: ${name}`);
}

async function run() {
  const browser = await chromium.launch();

  for (const [tag, ctxOpts] of [
    ["desktop", { viewport: { width: 1440, height: 900 } }],
    ["mobile", { ...devices["iPhone 13"] }],
  ]) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();

    // Landing + wizard
    await page.goto(`${ROOT}/`, { waitUntil: "networkidle" });
    await shoot(page, `${tag}-landing`);
    await page.goto(`${ROOT}/signup`, { waitUntil: "networkidle" });
    await shoot(page, `${tag}-signup`);

    // Storefront menu
    await page.goto(`${STORE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500); // images
    await shoot(page, `${tag}-menu`);

    // Item options sheet (click first card with options - premium burger)
    const card = page.locator("h3", { hasText: "אנטריקוט פרימיום" }).first();
    if (await card.count()) {
      await card.click();
      await page.waitForTimeout(800);
      await shoot(page, `${tag}-item-sheet`);
      // add to cart
      const addBtn = page.locator("button", { hasText: "הוסף לעגלה" });
      if (await addBtn.count()) {
        await addBtn.click();
        await page.waitForTimeout(500);
      }
    }
    await shoot(page, `${tag}-menu-with-cart`);

    // Mobile: open cart drawer
    if (tag === "mobile") {
      const cartBtn = page.locator('button[aria-label="עגלת קניות"]');
      if (await cartBtn.count()) {
        await cartBtn.click();
        await page.waitForTimeout(600);
        await shoot(page, `${tag}-cart-drawer`);
        await page.keyboard.press("Escape");
        const close = page.locator('button[aria-label="סגירה"]').first();
        if (await close.count()) await close.click();
      }
    }

    // Checkout
    await page.goto(`${STORE}/checkout`, { waitUntil: "networkidle" });
    await shoot(page, `${tag}-checkout`);

    // Dashboard: login screen then logged-in board
    await page.goto(`${STORE}/dashboard`, { waitUntil: "networkidle" });
    await shoot(page, `${tag}-dashboard-login`);
    await page.fill('input[type="email"]', "owner-a@demo.test");
    await page.fill('input[type="password"]', process.env.TEST_STAFF_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
    await shoot(page, `${tag}-dashboard-orders`);

    for (const [path, name] of [
      ["/dashboard/menu", "dashboard-menu"],
      ["/dashboard/branding", "dashboard-branding"],
      ["/dashboard/zones", "dashboard-zones"],
      ["/dashboard/coupons", "dashboard-coupons"],
      ["/dashboard/loyalty", "dashboard-loyalty"],
      ["/dashboard/import", "dashboard-import"],
      ["/dashboard/settings", "dashboard-settings"],
      ["/dashboard/integrations", "dashboard-integrations"],
    ]) {
      await page.goto(`${STORE}${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      await shoot(page, `${tag}-${name}`);
    }

    await ctx.close();
  }

  // Super admin (desktop only)
  if (adminPass) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${ROOT}/admin`, { waitUntil: "networkidle" });
    await shoot(page, "desktop-admin-login");
    await page.fill('input[placeholder="אימייל"]', "zbangush@gmail.com");
    await page.fill('input[placeholder="סיסמה"]', adminPass);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
    await shoot(page, "desktop-admin-panel");
    await ctx.close();
  }

  await browser.close();
  console.log("\nVISUAL AUDIT DONE");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
