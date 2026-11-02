// End-to-end checks against a production build and a dedicated test database.
// Run with `npm run test:e2e`. E2E_DATABASE_URL and E2E_DIRECT_URL must point at a
// Neon test branch, never the production database.
import "dotenv/config";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";

const { E2E_DATABASE_URL, E2E_DIRECT_URL } = process.env;

if (!E2E_DATABASE_URL || !E2E_DIRECT_URL) {
  console.error("Set E2E_DATABASE_URL and E2E_DIRECT_URL to a Neon test branch.");
  process.exit(1);
}

if (E2E_DATABASE_URL === process.env.DATABASE_URL || E2E_DIRECT_URL === process.env.DIRECT_URL) {
  console.error("The E2E URLs match the production database. Point them at a Neon test branch.");
  process.exit(1);
}

const PRISMA = "node_modules/prisma/build/index.js";
const NEXT = "node_modules/next/dist/bin/next";
const PORT = 3102;
const base = `http://localhost:${PORT}`;
const env = {
  ...process.env,
  DATABASE_URL: E2E_DATABASE_URL,
  DIRECT_URL: E2E_DIRECT_URL,
  // Connecting to Neon from far away can take longer than Node's 250ms per-address limit,
  // which fails the connection outright, so give each attempt more time.
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--dns-result-order=ipv4first", "--network-family-autoselection-attempt-timeout=1000"].filter(Boolean).join(" "),
  AUTH_SECRET: "e2e-only-secret",
};

let failures = 0;
const check = (passed, name, detail = "") => {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}${passed ? "" : ` ${JSON.stringify(detail)}`}`);
  if (!passed) failures += 1;
};

const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const api = (page) => (method, url, body) =>
  page.evaluate(
    async ([m, u, b]) => {
      const response = await fetch(u, {
        method: m,
        headers: { "Content-Type": "application/json" },
        body: b ? JSON.stringify(b) : undefined,
      });
      const text = await response.text();
      let data = text;
      try {
        data = JSON.parse(text);
      } catch {}
      return { status: response.status, data };
    },
    [method, url, body],
  );

async function signUp(browser, email) {
  const context = await browser.newContext({ viewport: { width: 375, height: 640 } });
  const page = await context.newPage();
  await page.goto(`${base}/signup`);
  await page.fill("input[type=text]", "Tester");
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", "password123");
  await page.click("button[type=submit]");
  await page.waitForURL(`${base}/`);
  return { context, page, call: api(page) };
}

async function run(browser) {
  const stamp = Date.now();
  const { context, page, call } = await signUp(browser, `a${stamp}@example.com`);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const today = localDay();
  const month = today.slice(0, 7);
  const balanceOf = async (name) => (await call("GET", "/api/accounts")).data.find((a) => a.name === name).balance;
  const debtById = async (id) => (await call("GET", "/api/debts")).data.find((d) => d.id === id);

  // Money
  const bank = (await call("POST", "/api/accounts", { name: "Bank", type: "Bank", balance: 10000 })).data;
  const income = await call("POST", "/api/incomes", { title: "Salary", amount: 50000.1, source: "Salary", date: today, accountId: bank.id });
  check(income.status === 201 && (await balanceOf("Bank")) === 60000.1, "income credits the account");
  const add = (amount, extra = {}) => call("POST", "/api/expenses", { title: "Item", amount, category: "Food", date: today, accountId: bank.id, ...extra });
  const tenth = (await add(0.1)).data;
  await add(0.2);
  check((await balanceOf("Bank")) === 59999.8, "paise stay exact where floats would drift", await balanceOf("Bank"));
  await call("DELETE", `/api/expenses?id=${tenth.id}`);
  check((await balanceOf("Bank")) === 59999.9, "deleting an expense restores the exact amount");
  await call("PUT", "/api/incomes", { id: income.data.id, title: "Salary", amount: 40000.1, date: today, accountId: bank.id });
  check((await balanceOf("Bank")) === 49999.9, "editing income adjusts the balance");

  // Loans
  const big = await call("POST", "/api/debts", { name: "Home", principal: 75000000.5, outstanding: 75000000.5, monthlyPayment: 90000 });
  check(big.status === 201 && big.data.outstanding === 75000000.5, "a 7.5 crore loan is stored exactly", big.data);
  const loan = (await call("POST", "/api/debts", { name: "Bike", lender: "HDFC", principal: 2000, outstanding: 1500, monthlyPayment: 1000, dueDate: 5 })).data;
  const before = await balanceOf("Bank");
  await page.goto(`${base}/debts`);
  await page.locator("div.rounded-2xl", { hasText: "HDFC" }).getByText("Pay EMI").click();
  await page.getByText("Confirm").click();
  await page.waitForFunction(() => document.body.innerText.includes("₹500"));
  check((await debtById(loan.id)).outstanding === 500, "Pay EMI reduces the loan");
  check((await balanceOf("Bank")) === before - 1000, "Pay EMI debits the account");
  const emi = (await call("GET", `/api/expenses?month=${month}`)).data.find((e) => e.debtId === loan.id);
  check(emi?.category === "Loan EMI", "Pay EMI logs a linked expense", emi);
  check((await call("POST", "/api/debts/pay", { debtId: loan.id, amount: 600, date: today })).status === 400, "cannot pay more than is owed");
  await call("PUT", "/api/expenses", { ...emi, amount: 800 });
  check((await debtById(loan.id)).outstanding === 700, "editing an EMI expense updates the loan");
  await call("DELETE", `/api/expenses?id=${emi.id}`);
  check((await debtById(loan.id)).outstanding === 1500, "deleting an EMI expense restores the loan");
  const final = await call("POST", "/api/debts/pay", { debtId: loan.id, amount: 1500, date: today });
  check((await debtById(loan.id)).status === "Closed", "the final payment closes the loan");
  await call("DELETE", `/api/expenses?id=${final.data.id}`);
  check((await debtById(loan.id)).status === "Active", "undoing the final payment reopens the loan");
  const rush = (await call("POST", "/api/debts", { name: "Rush", principal: 1000, outstanding: 1000, monthlyPayment: 100 })).data;
  const payments = await Promise.all(Array.from({ length: 5 }, () => call("POST", "/api/debts/pay", { debtId: rush.id, amount: 300, date: today })));
  const accepted = payments.filter((item) => item.status === 201).length;
  check(accepted === 3 && (await debtById(rush.id)).outstanding === 100, "parallel payments can't overpay or get lost", payments.map((item) => item.status));

  // Loan schedule
  const inSixMonths = localDay(new Date(new Date().getFullYear(), new Date().getMonth() + 6, 15));
  await page.goto(`${base}/debts`);
  await page.getByPlaceholder("Loan name").fill("Scheduled");
  await page.getByPlaceholder("Amount per month").fill("2000");
  await page.getByLabel("End date").fill(inSixMonths);
  await page.waitForSelector("text=to pay");
  await page.getByRole("button", { name: "Save debt" }).click();
  await page.waitForSelector("text=Scheduled");
  const scheduled = (await call("GET", "/api/debts")).data.find((d) => d.name === "Scheduled");
  check(scheduled?.outstanding % 2000 === 0 && scheduled.outstanding >= 10000 && scheduled.outstanding <= 14000, "a loan's balance comes from its dates", scheduled);
  await call("DELETE", `/api/debts?id=${scheduled.id}`);

  // Double-tapped saves
  const twice = (await add(100, { title: "Twice" })).data;
  const beforeEdits = await balanceOf("Bank");
  await Promise.all([call("PUT", "/api/expenses", { ...twice, amount: 200 }), call("PUT", "/api/expenses", { ...twice, amount: 200 })]);
  check((await balanceOf("Bank")) === beforeEdits - 100, "a double-tapped edit changes the balance once", await balanceOf("Bank"));
  await call("DELETE", `/api/expenses?id=${twice.id}`);
  check((await call("GET", "/api/expenses?search=twi")).data.length === 0, "the edited expense is gone");
  await add(1, { title: "Latte Stand" });
  check((await call("GET", "/api/expenses?search=LATTE")).data.length === 1, "search ignores case");

  // Recurring
  const rent = (await call("POST", "/api/recurring", { title: "Rent", amount: 12000, category: "Bills", frequency: "Monthly", nextDate: today, accountId: bank.id })).data;
  const expenseCount = async () => (await call("GET", "/api/expenses?search=Rent")).data.length;
  check((await expenseCount()) === 0, "recurring items don't post by themselves");
  await page.goto(`${base}/`);
  await page.waitForSelector("text=Coming up");
  const logRent = () => call("POST", "/api/recurring/log", { id: rent.id, nextDate: rent.nextDate });
  const tapResults = await Promise.all([logRent(), logRent()]);
  await logRent();
  const logged = (await call("GET", "/api/recurring")).data[0];
  check(logged.nextDate.slice(0, 10) > today, "logging advances the due date", logged);
  check((await expenseCount()) === 1, "repeat taps log the occurrence exactly once", tapResults.map((item) => item.status));
  check((await call("POST", "/api/recurring/log", { id: rent.id })).status === 400, "logging requires a named occurrence");
  await call("POST", "/api/recurring/log", { id: rent.id, nextDate: logged.nextDate, skip: true });
  const skipped = (await call("GET", "/api/recurring")).data[0];
  check(skipped.nextDate > logged.nextDate && (await expenseCount()) === 1, "skip advances without logging");

  // Budgets, categories
  const previous = localDay(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15)).slice(0, 7);
  await call("POST", "/api/categories", { name: "Coffee", color: "#ff0000" });
  await call("POST", "/api/budgets", { category: "Coffee", amount: 100, month: previous });
  const copied = await call("POST", "/api/budgets/copy", { fromMonth: previous, toMonth: month });
  check(copied.data.copied === 1, "budgets copy forward", copied);
  await add(90, { category: "Coffee", title: "Latte" });
  await page.goto(`${base}/`);
  await page.waitForSelector("text=Budget alerts");
  check(await page.getByText("90% used").isVisible(), "dashboard warns at 80%");
  const coffee = (await call("GET", "/api/categories")).data.find((c) => c.name === "Coffee");
  await call("PUT", "/api/categories", { id: coffee.id, name: "Cafe", color: "#ff0000" });
  const renamed = (await call("GET", "/api/expenses?category=Cafe")).data.length;
  const budgetRenamed = (await call("GET", `/api/budgets?month=${month}`)).data[0]?.category;
  check(renamed === 1 && budgetRenamed === "Cafe", "renaming a category moves expenses and budgets", { renamed, budgetRenamed });

  // Accounts
  await page.goto(`${base}/accounts`);
  await page.locator("div.rounded-2xl", { hasText: "Bank" }).getByRole("button", { name: "Edit" }).last().click();
  await page.getByPlaceholder("e.g. HDFC Savings").fill("HDFC");
  await page.locator('input[type=number]').first().fill("12345.67");
  await page.getByRole("button", { name: "Update account" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("HDFC") && document.body.innerText.includes("12,345.67"));
  check((await balanceOf("HDFC")) === 12345.67, "accounts can be renamed and corrected");

  // Savings goals
  const close = (a, b) => Math.abs(a - b) < 0.001;
  const icici = (await call("POST", "/api/accounts", { name: "ICICI", type: "Bank", balance: 5000 })).data;
  const bike = (await call("POST", "/api/goals", { name: "Bike", target: 10000 })).data;
  const setAside = (accountId, amount, action = "add") => call("POST", "/api/goals/entries", { goalId: bike.id, accountId, amount, action });
  const goalSaved = async () => (await call("GET", "/api/goals")).data.find((g) => g.id === bike.id).saved;
  const heldIn = async (name) => (await call("GET", "/api/accounts")).data.find((a) => a.name === name).setAside;
  check((await setAside(bank.id, 2000)).status === 201 && (await setAside(icici.id, 3000)).status === 201, "money can be set aside from two accounts");
  check(close(await goalSaved(), 5000) && close(await balanceOf("HDFC"), 12345.67), "setting money aside leaves balances alone");
  check((await setAside(icici.id, 2500)).status === 400, "only free money can be set aside");
  await add(11000, { title: "Laptop" });
  check(close(await heldIn("HDFC"), 1345.67) && close(await goalSaved(), 4345.67), "spending into savings lowers the goal", await goalSaved());
  await call("PUT", "/api/expenses", { ...(await add(1, { title: "Gum" })).data, amount: 1 });
  check(close(await goalSaved(), 4344.67), "every expense that dips into savings is taken from the goal");
  check((await setAside(icici.id, 1000, "withdraw")).status === 201 && close(await goalSaved(), 3344.67), "goal money can be withdrawn");
  await page.goto(`${base}/goals`);
  await page.waitForSelector("text=Bike");
  check((await page.getByText("Spent from HDFC").count()) >= 1, "the goal shows where savings were spent");
  await call("DELETE", `/api/goals?id=${bike.id}`);
  check((await heldIn("HDFC")) === 0, "deleting a goal frees its money");

  // Transactions
  for (let index = 0; index < 35; index += 1) await add(1, { title: `Bulk ${index}`, merchant: "Bulk Mart" });
  const firstPage = (await call("GET", "/api/transactions?search=Bulk&page=0")).data;
  const secondPage = (await call("GET", "/api/transactions?search=Bulk&page=1")).data;
  check(firstPage.items.length === 30 && firstPage.total === 35 && firstPage.hasMore && secondPage.items.length === 5 && !secondPage.hasMore, "transactions paginate");
  check(firstPage.totalAmount === 35, "transaction totals cover every page");
  const highest = (await call("GET", "/api/transactions?sort=highest")).data.items[0].amount;
  check(highest === 12000, "transactions sort by amount", highest);
  await page.goto(`${base}/transactions`);
  await page.getByPlaceholder("Search title, merchant, notes").fill("Bulk");
  await page.waitForSelector("text=35 expenses");
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForSelector("text=Bulk 0");
  check(true, "transactions page filters and pages through results");

  // Export
  await add(5, { title: "=HYPERLINK(1)" });
  const csv = await call("GET", "/api/export?type=expenses");
  check(csv.status === 200 && csv.data.includes("'=HYPERLINK(1)"), "CSV export defuses formulas");
  const backup = await call("GET", "/api/export?type=backup");
  check(backup.status === 200 && backup.data.incomes?.length === 1 && backup.data.accounts?.[0].balance > 0, "full backup exports");

  // Isolation
  const other = await signUp(browser, `b${stamp}@example.com`);
  check((await other.call("GET", "/api/expenses")).data.length === 0, "a second user sees none of the first user's expenses");
  check((await other.call("POST", "/api/recurring/log", { id: rent.id, nextDate: rent.nextDate })).status === 409, "a second user cannot log someone else's bill");
  check((await other.call("POST", "/api/debts/pay", { debtId: loan.id, amount: 1, date: today })).status === 404, "a second user cannot pay someone else's loan");
  check((await other.call("PUT", "/api/categories", { id: coffee.id, name: "Stolen" })).status === 404, "a second user cannot rename someone else's category");
  check((await other.call("POST", "/api/incomes", { title: "x", amount: 1, date: today, accountId: bank.id })).status === 400, "a second user cannot credit someone else's account");
  check((await other.call("DELETE", `/api/incomes?id=${income.data.id}`)).status === 404, "a second user cannot delete someone else's income");

  // Currency
  await other.page.goto(`${base}/accounts`);
  await other.page.getByLabel("Currency").selectOption("USD");
  await other.page.waitForFunction(() => document.body.innerText.includes("$0"));
  await other.page.reload();
  await other.page.waitForFunction(() => document.body.innerText.includes("$0"));
  check(true, "a currency choice changes amounts and survives a reload");
  check((await other.call("PUT", "/api/settings", { currency: "XYZ" })).status === 400, "unknown currencies are rejected");
  await page.goto(`${base}/accounts`);
  await page.waitForFunction(() => document.body.innerText.includes("₹"));
  check(true, "one user's currency doesn't affect another user");
  await other.context.close();

  // Quick entry
  await add(40, { title: "Chai", paymentMethod: "UPI" });
  await add(40, { title: "Chai", paymentMethod: "UPI" });
  await page.goto(`${base}/`);
  await page.waitForSelector("text=This month");
  await page.getByRole("button", { name: "Add expense" }).first().click();
  await page.getByRole("button", { name: /Chai/ }).first().click();
  const filled = await page.evaluate(() => [...document.querySelectorAll("[role=dialog] input")].slice(0, 2).map((input) => input.value));
  check(filled[0] === "Chai" && filled[1] === "40", "a repeat chip fills the expense form", filled);
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  const chai = (await call("GET", "/api/expenses?search=Chai")).data;
  check(chai.length === 3 && chai.every((item) => item.paymentMethod === "UPI"), "a repeated expense keeps its details", chai.length);

  // Reports and screens
  await add(123456789.5, { title: "A very long expense title that should never push the amount off the screen" });
  await page.goto(`${base}/`);
  await page.waitForSelector("text=This month");
  await page.waitForSelector("text=12,34,56,789.50");
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "a very large amount fits a phone screen");
  check((await page.getByRole("button", { name: "Edit" }).count()) === 5, "home shows only the latest expenses");
  await page.getByRole("link", { name: "Expenses" }).click();
  await page.waitForSelector("text=Expense log");
  await page.waitForSelector("text=Bulk 34");
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("button", { name: /cancel|close/i }).first().click();
  check(page.url() === `${base}/transactions`, "expenses can be added from the expense log");
  if (process.env.E2E_SCREENSHOTS) {
    await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/expenses.png` });
  }
  await page.goto(`${base}/`);
  await page.waitForSelector("text=This month");
  if (process.env.E2E_SCREENSHOTS) {
    await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/dashboard.png`, fullPage: true });
  }
  await page.goto(`${base}/reports`);
  await page.waitForSelector("text=Month in review");
  await page.waitForSelector("text=You spent");
  check(await page.getByText("Over budget on").count() === 0 && (await page.getByText("Every budget stayed on track.").count()) === 1, "the monthly review lists budget results");
  await page.goto(`${base}/reports?month=${previous}`);
  check((await page.locator("input[type=month]").inputValue()) === previous, "a review link opens the chosen month");
  await page.goto(`${base}/reports`);
  await page.waitForSelector("text=of income");
  await page.waitForSelector("text=Bulk Mart");
  check(true, "reports show income, savings and merchants");
  for (const route of ["income", "recurring", "budgets", "categories", "debts", "accounts", "transactions"]) {
    const response = await page.goto(`${base}/${route}`);
    check(response.status() === 200, `/${route} loads`);
  }
  check(pageErrors.length === 0, "no browser errors", pageErrors.slice(0, 3));

  // Service worker
  await page.goto(`${base}/`);
  await page.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => Boolean(r?.active)));
  await page.reload();
  await page.waitForTimeout(500);
  const cached = await page.evaluate(async () => {
    const paths = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
    }
    return paths.filter((item) => !item.startsWith("/_next"));
  });
  check(!cached.some((item) => item.startsWith("/api") || item === "/"), "no private data is cached", cached);
  await context.setOffline(true);
  await page.goto(`${base}/reports`).catch(() => {});
  await page.waitForTimeout(500);
  check((await page.getByText("You're not connected").count()) === 1, "offline page shows");
  await context.setOffline(false);
  await context.close();

  // Login limit
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`${base}/login`);
  await guest.fill("input[type=email]", `a${stamp}@example.com`);
  for (let attempt = 0; attempt < 11; attempt += 1) {
    await guest.fill("input[type=password]", "wrong-password");
    await guest.click("button[type=submit]");
    await guest.waitForFunction(() => document.querySelector("button[type=submit]").innerText === "Sign in");
  }
  check((await guest.getByText("Too many attempts").count()) === 1, "login locks after repeated failures");
}

(async () => {
  // A sleeping Neon branch can refuse the first connections while it wakes up.
  const prisma = async (args, input) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        execFileSync(process.execPath, [PRISMA, ...args], { env, input, stdio: ["pipe", "ignore", "ignore"] });
        return;
      } catch (error) {
        if (attempt === 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  };

  await prisma(["migrate", "deploy"]);
  // Rate limits live in the database now, so clear what the last run left behind.
  await prisma(["db", "execute", "--stdin"], 'DELETE FROM "RateLimit";');
  // Set E2E_SERVER_LOG to a file path to keep the server's output when a run fails.
  const serverOutput = process.env.E2E_SERVER_LOG ? fs.openSync(process.env.E2E_SERVER_LOG, "w") : "ignore";
  const server = spawn(process.execPath, [NEXT, "start", "-p", String(PORT)], { env, stdio: ["ignore", serverOutput, serverOutput] });

  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (await fetch(`${base}/login`).then(() => true, () => false)) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const browser = await chromium.launch();
    await run(browser).finally(() => browser.close());
  } finally {
    server.kill();
  }

  console.log(failures ? `${failures} FAILED` : "ALL PASSED");
  process.exit(failures ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
