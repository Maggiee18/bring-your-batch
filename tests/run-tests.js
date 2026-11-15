// End to end checks for Bring Your Batch Growth Engine.
// Runs the page in headless Chromium with no claude.ai runtime, so it exercises
// sandbox mode (browser storage) and the no-AI fallbacks.
// Usage: node tests/run-tests.js   (writes tests/TEST_RESULTS.json and prints a table)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const WRAP = path.join(__dirname, "_page.html");
fs.writeFileSync(WRAP, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${SRC}</body></html>`);
const URL = "file://" + WRAP;
const SHARE_BASE = (SRC.match(/const SHARE_BASE = "([^"]+)"/) || [])[1];

const results = [];
const check = (id, name, pass, detail) => { results.push({ id, name, pass: !!pass, detail: String(detail ?? "") }); };

(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch(proxy ? { proxy } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(URL + "#register"); await page.waitForTimeout(600);

  const fill = async (name, phone, college, branch, src, ref) => {
    await page.fill("#fName", name); await page.fill("#fPhone", phone);
    await page.selectOption("#fCollege", college); await page.selectOption("#fBranch", branch);
    if (src) await page.selectOption("#fSrc", src);
    await page.fill("#fRef", ref || ""); await page.dispatchEvent("#fRef", "input");
    await page.click("#regBtn"); await page.waitForTimeout(350);
  };
  const local = () => page.evaluate(() => JSON.parse(localStorage.getItem("byb2_local") || "[]"));

  // 2. invalid input
  await fill("A", "12345", "SRM University AP", "ECE", "club", "");
  const nameErr = await page.isVisible("#eName"), phoneErr = await page.isVisible("#ePhone");
  check(2, "Invalid input is rejected", nameErr && phoneErr && (await local()).length === 0, `name error shown: ${nameErr}, phone error shown: ${phoneErr}, records: ${(await local()).length}`);
  await fill("Test Student", "9876543210", "SRM University AP", "ECE", "club", "ZZZZ999");
  const badRef = await page.isVisible("#eRef");
  check("2b", "Unknown referral code is rejected", badRef && (await local()).length === 0, `ref error shown: ${badRef}`);

  // 1. register
  await fill("Sai Meghana Annepu", "9876543210", "SRM University AP", "CSE (AI/ML)", "club", "");
  const ticket = await page.isVisible("#ticketWrap");
  const L1 = await local();
  const me = L1[0] || {};
  check(1, "A new student can register", ticket && L1.length === 1 && /^[A-Z]{4}[A-Z0-9]{3}$/.test(me.code), `ticket visible: ${ticket}, records: ${L1.length}, code: ${me.code}`);
  check(5, "Acquisition source is recorded", me.heard === "club" && me.source === "club", `heard=${me.heard}, source=${me.source}`);
  check("P1", "Phone number is not stored", !JSON.stringify(L1).includes("9876543210") && !("phone4" in me) && /^[0-9a-f]{16}$/.test(me.dk), `dk=${me.dk}`);

  // 9. share message link
  const wa = await page.getAttribute("#waBtn", "href");
  const decoded = decodeURIComponent(wa.split("text=")[1] || "");
  check(9, "Share message contains the correct referral link", wa.startsWith("https://wa.me/?text=") && decoded.includes(`${SHARE_BASE}#r-${me.code}`), decoded.split("\n").pop());

  // 3. duplicate (same number written differently)
  await page.click("#addFriend"); await page.waitForTimeout(200);
  await fill("Sai M", "+91 98765 43210", "KL University", "ECE", "referral", me.code);
  const dupShown = await page.isVisible("#dupBox") || /Already registered/.test(await page.textContent("#toast")); const L2 = await local();
  check(3, "Duplicate registration is refused and not counted", dupShown && L2.length === 1, `duplicate notice: ${dupShown}, records still: ${L2.length}`);

  // 4. referral captured (friend)
  await page.goto(URL + "#r-" + me.code); await page.waitForTimeout(400);
  const prefilled = await page.inputValue("#fRef");
  await fill("Ravi Kumar", "9123456780", "SRM University AP", "ECE", null, me.code);
  const L3 = await local(); const friend = L3.find(r => r.name === "Ravi K.") || {};
  check(4, "Referral code is captured from the link", prefilled === me.code && friend.ref === me.code && friend.source === "referral" && friend.refType === "student", `prefilled=${prefilled}, ref=${friend.ref}, source=${friend.source}`);
  const codeBox = (await page.textContent(".codebox")).replace(/\s+/g, " ");
  check("4b", "Referrer's hall ticket count updates", /1 joined with it/.test(codeBox), codeBox);

  // repeated submit of the same friend
  await page.click("#addFriend"); await page.waitForTimeout(150);
  await fill("Ravi Kumar", "9123456780", "SRM University AP", "ECE", null, me.code);
  const L4 = await local();
  check(6, "One person counts once even if submitted again", L4.length === 2, `records after repeat: ${L4.length}`);

  // a third person with no code (form is still open after the refused duplicate)
  if (await page.isVisible("#addFriend")) { await page.click("#addFriend"); await page.waitForTimeout(150); }
  await fill("Priya Sharma", "9000000001", "Chandigarh University", "IT", "social", "");
  const L5 = await local(); const priya = L5.find(r => r.name === "Priya S.");
  check("6b", "No-code signup uses the self reported source", priya && priya.source === "social" && priya.ref === "", `source=${priya && priya.source}`);

  // 7 & 8: real entries only view
  await page.click("#modeLive"); await page.goto(URL + "#leaderboard"); await page.waitForTimeout(300);
  await page.click("#modeLive"); await page.waitForTimeout(250);
  const colTotals = await page.$$eval("#collegeBoard tbody tr td:nth-child(3) b", els => els.reduce((s, e) => s + Number(e.textContent), 0));
  const refRows = await page.$$eval("#refBoard tbody tr td:nth-child(3) b", els => els.map(e => Number(e.textContent)));
  check(7, "Leaderboard matches the records", colTotals === L5.length && refRows[0] === 1, `college sum ${colTotals} vs records ${L5.length}; top referrer count ${refRows[0]}`);
  await page.goto(URL + "#dashboard"); await page.waitForTimeout(250); await page.click("#modeLive"); await page.waitForTimeout(250);
  const kpiTotal = Number((await page.textContent("#kpis .kpi:nth-child(1) .val")).trim());
  const kpiRef = Number((await page.textContent("#kpis .kpi:nth-child(2) .val")).trim());
  const srcSum = await page.$$eval("#chanBars .hbar b", els => els.reduce((s, e) => s + Number(e.childNodes[0].textContent.trim()), 0));
  check(8, "Dashboard agrees with the records", kpiTotal === L5.length && srcSum === L5.length && kpiRef === L5.filter(r => r.ref).length, `KPI ${kpiTotal}, sources sum ${srcSum}, referral KPI ${kpiRef}, records ${L5.length}`);

  // synthetic view integrity
  await page.click("#modeSim"); await page.waitForTimeout(250);
  const simTotal = Number((await page.textContent("#kpis .kpi:nth-child(1) .val")).trim());
  const simSrc = await page.$$eval("#chanBars .hbar b", els => els.reduce((s, e) => s + Number(e.childNodes[0].textContent.trim()), 0));
  const synthLabel = await page.textContent("#dashSynth");
  check("8b", "Synthetic view: sources add up to the unique total and are labelled", simTotal === simSrc && /Synthetic demo/.test(synthLabel), `total ${simTotal}, sources ${simSrc}, label "${synthLabel.trim()}"`);
  const ruleCount = await page.$$eval("#rules .rule .why", els => els.length);
  check("8c", "Each recommendation shows its metric and threshold", ruleCount >= 6, `${ruleCount} rules rendered with metric + threshold`);

  // Ambassador HQ: activation + sim warning + no AI
  await page.goto(URL + "#ambassador"); await page.waitForTimeout(250);
  await page.fill("#ambCode", me.code); await page.click("#ambForm button[type=submit]"); await page.waitForTimeout(200);
  const canActivate = await page.isVisible("#activate");
  if (canActivate) { await page.click("#activate"); await page.waitForTimeout(250); }
  const kit = await page.isVisible("#ambMsg");
  const msgTxt = kit ? await page.textContent("#ambMsg") : "";
  const aiOptDisabled = await page.$eval("#ambLang option[value=te]", o => o.disabled).catch(() => null);
  check("A1", "Ambassador kit works and keeps the link; AI languages disabled without AI", canActivate && kit && msgTxt.includes(`#r-${me.code}`) && aiOptDisabled === true, `activated: ${canActivate}, link in message: ${msgTxt.includes(me.code)}, AI option disabled: ${aiOptDisabled}`);
  await page.click('.days button[data-d="5"]'); await page.waitForTimeout(150);
  const simWarn = await page.isVisible("#ambBody .banner.warn");
  check("A2", "Messages with synthetic numbers carry a do-not-send warning", simWarn, `warning shown on Day 5 in synthetic view: ${simWarn}`);

  // 11, 12, 13: Project Judge without AI
  await page.goto(URL + "#judge"); await page.waitForTimeout(250);
  const modeChip = await page.textContent("#judgeMode");
  await page.click("#judgeFill"); await page.click("#judgeBtn"); await page.waitForTimeout(1200);
  const res = await page.textContent("#judgeResult");
  const total = Number((res.match(/(\d+)of 100/) || [])[1]);
  const parts = [...res.matchAll(/(\d+)\/(20|25|15)/g)].map(m => Number(m[1]));
  check(11, "Missing AI does not crash; demo mode is used", /Demo mode/.test(modeChip) && total > 0 && errors.length === 0, `mode chip "${modeChip.trim()}", score ${total}, page errors ${errors.length}`);
  check(12, "Judge output is labelled with its mode and evidence limits", /Demo mode, rule based/.test(res) && /No AI was used, links were not opened and code was not run/.test(res) && parts.reduce((a, b) => a + b, 0) === total, `criterion points ${parts.join("+")} = ${parts.reduce((a, b) => a + b, 0)} vs total ${total}`);
  check("12b", "Resume line claims only completed work", /Resume line/.test(res) && !/deployed/i.test((res.match(/Resume line \(only what is already done\)([^]*?)Copy resume line/) || [])[1] || ""), "no live link given, so the line says Built, not Built and deployed");
  const id = (res.match(/ID (BYB-\w+)/) || [])[1];
  await page.fill("#certQ", id); await page.click("#certForm button"); await page.waitForTimeout(150);
  const ver = await page.textContent("#certOut");
  const img = await page.getAttribute("#certImg", "src");
  check(13, "Demo certificate is not presented as official", /Is a demonstration artifact/.test(ver) && /NoOfficially/.test(ver.replace(/\s+/g, "")) && /Demo certificate · not an official credential/.test(res) && (img || "").startsWith("data:image/png"), `verify: ${ver.replace(/\s+/g, " ").trim().slice(0, 160)}`);
  if (img) fs.writeFileSync(path.join(__dirname, "demo-certificate.png"), Buffer.from(img.split(",")[1], "base64"));

  // Experiments: variant link tagging, hall ticket arm, tone, CSV import
  await page.goto(URL + `#x-t1a-${me.code}`); await page.waitForTimeout(300);
  await fill("Kiran Rao", "9555500001", "SRM University AP", "Mechanical", null, me.code);
  const L6 = await local(); const kiran = L6.find(r => r.name === "Kiran R.") || {};
  check("E1", "Experiment link tags the signup with its arm", kiran.exp === "t1a" && kiran.ref === me.code && (kiran.t2 === "a" || kiran.t2 === "b"), `exp=${kiran.exp}, ref=${kiran.ref}, t2=${kiran.t2}`);
  await page.goto(URL + "#dashboard"); await page.waitForTimeout(250); await page.click("#modeLive"); await page.waitForTimeout(250);
  const expTxt = (await page.textContent("#exps")).replace(/\s+/g, " ");
  check("E2", "Experiments panel counts real arm signups", /Personal message.*?1/.test(expTxt) && /Not enough data yet/.test(expTxt), expTxt.slice(0, 140));
  const csv = "Timestamp,Name,WhatsApp number,College,Branch,Where did you first hear about this?,Referral code,Variant\n" +
    "2026-11-01 20:15,Anita Verma,9111100001,Chandigarh University,ECE,A message in my class group,,t3b\n" +
    "2026-11-01 20:20,Anita V,+91 91111 00001,Chandigarh University,ECE,A friend sent it to me,,t3b\n" +
    "2026-11-01 20:25,Bad Row,12345,Chandigarh University,ECE,Other,,t3a\n" +
    `2026-11-01 20:30,Rahul Jain,9111100002,Chandigarh University,CSE,A friend sent it to me,${me.code},t3a\n`;
  const csvPath = path.join(__dirname, "_sample.csv"); fs.writeFileSync(csvPath, csv);
  await page.setInputFiles("#csvIn", csvPath); await page.waitForTimeout(600);
  const imp = await page.evaluate(() => JSON.parse(localStorage.getItem("byb2_import") || "[]"));
  check("E3", "CSV import dedupes, rejects bad rows and keeps attribution", imp.length === 2 && imp.find(r => r.name === "Rahul J.")?.ref === me.code && imp.find(r => r.name === "Rahul J.")?.source === "ambassador" /* my code was switched to ambassador in check A1 */ && imp.find(r => r.name === "Anita V.")?.exp === "t3b" && !JSON.stringify(imp).includes("9111100001"), `imported ${imp.length} of 4 rows; sources ${imp.map(r => r.source).join(",")}`);
  const kpiAfter = Number((await page.textContent("#kpis .kpi:nth-child(1) .val")).trim());
  check("E4", "Imported records join the unique total", kpiAfter === L6.length + imp.length, `KPI ${kpiAfter} = ${L6.length} app + ${imp.length} imported`);
  await page.goto(URL + "#ambassador"); await page.waitForTimeout(250);
  await page.fill("#ambCode", me.code); await page.click("#ambForm button[type=submit]"); await page.waitForTimeout(200);
  await page.click('.days button[data-d="1"]'); await page.waitForTimeout(100);
  const longMsg = await page.textContent("#ambMsg");
  await page.selectOption("#ambTone", "short"); await page.waitForTimeout(150);
  const shortMsg = await page.textContent("#ambMsg");
  check("A3", "Tone option changes the message and keeps the link", shortMsg.length < longMsg.length && shortMsg.includes(`#r-${me.code}`), `friendly ${longMsg.length} chars, short ${shortMsg.length} chars`);

  // Planner, show up plan, tour
  await page.goto(URL + "#dashboard"); await page.waitForTimeout(250);
  await page.click("#wiReset"); await page.waitForTimeout(100);
  const wiDefault = (await page.textContent("#wiOut")).replace(/\s+/g, " ");
  await page.evaluate(() => { const i = document.querySelector("#wi-rate"); i.value = 3; i.dispatchEvent(new Event("input")); }); await page.waitForTimeout(100);
  const wiLow = (await page.textContent("#wiOut")).replace(/\s+/g, " ");
  await page.click("#wiReset"); await page.waitForTimeout(100);
  check("W1", "What if planner reproduces the plan and reacts to assumptions", /Modelled unique registrations\s*500\s*Reaches 500/.test(wiDefault) && /short of 500/.test(wiLow) && /Most sensitive/.test(wiLow), `${wiDefault.slice(0, 60)} → at 3%: ${wiLow.slice(0, 60)}`);
  const showTxt = (await page.textContent("#showOut")).replace(/\s+/g, " "); const remCount = await page.$$eval("#remList .item", e => e.length);
  check("W2", "Show up plan computes expected attendees and lists reminders", /Expected attendees\s*\d+/.test(showTxt) && remCount === 4, `${showTxt.slice(0, 50)}; ${remCount} reminders`);
  await page.click("#tourBtn"); await page.waitForTimeout(300);
  const titles = [];
  for (let i = 0; i < 6; i++){ titles.push((await page.textContent("#tourBox b")).trim()); await page.click("#tourN"); await page.waitForTimeout(350); }
  const closed = !(await page.$("#tourBox"));
  check("W3", "Guided tour walks all 6 steps and closes", titles.length === 6 && titles[5].startsWith("6 of 6") && closed && errors.length === 0, titles.map(t => t.split(" · ")[0]).join(", ") + `; closed: ${closed}`);

  // 10: mobile viewport, all tabs
  const m = await browser.newPage({ viewport: { width: 375, height: 760 } });
  const overflow = [];
  for (const v of ["register", "leaderboard", "ambassador", "dashboard", "judge"]) {
    await m.goto(URL + "#" + v); await m.waitForTimeout(250);
    const w = await m.evaluate(() => document.documentElement.scrollWidth);
    if (w > 375) overflow.push(`${v}:${w}`);
  }
  check(10, "Works on a 375px wide phone screen (no sideways scroll)", overflow.length === 0, overflow.length ? overflow.join(", ") : "all 5 tabs fit 375px");

  // 14: secrets
  const secretHits = (SRC.match(/sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,}|api[_-]?key\s*[:=]\s*["'][^"']+|Bearer\s+[A-Za-z0-9._-]{12,}/gi) || []);
  check(14, "No secrets in client code", secretHits.length === 0, secretHits.length ? secretHits.join(", ") : "no key patterns found");

  // 15: build
  let syntax = "ok";
  try { const js = SRC.match(/<script>([\s\S]*?)<\/script>/)[1]; fs.writeFileSync(path.join(__dirname, "_extracted.js"), js); execSync(`node --check "${path.join(__dirname, "_extracted.js")}"`); } catch (e) { syntax = e.message; }
  check(15, "Build: script parses and the page loads without errors", syntax === "ok" && errors.length === 0, `node --check: ${syntax}; runtime page errors: ${errors.length ? errors.join(" | ") : "none"}`);

  await browser.close();
  fs.writeFileSync(path.join(__dirname, "TEST_RESULTS.json"), JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
  const passed = results.filter(r => r.pass).length;
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  [${r.id}] ${r.name} :: ${r.detail}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
