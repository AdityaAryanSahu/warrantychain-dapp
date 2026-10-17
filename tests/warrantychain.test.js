// ===========================================================================
// WarrantyChain - automated test suite (Ganache + Ethers.js v6)
// ===========================================================================
// Runs every test case against an in-process Ganache blockchain and writes the
// observed results to tests/results/automated-test-results.md.
//
// Usage:  npm install
//         npm test
//
// Accounts (Ganache deterministic wallet):
//   [0] Manufacturer (contract deployer / owner)
//   [1] Retailer
//   [2] Customer A
//   [3] Customer B (second-hand buyer)
//   [4] Unauthorised outsider
// ===========================================================================

const fs = require("fs");
const path = require("path");
const ganache = require("ganache");
const { ethers } = require("ethers");

const artifact = require("../build/WarrantyChain.json");
const RESULTS_PATH = path.join(__dirname, "results", "automated-test-results.md");
const ZERO = ethers.ZeroAddress;
const MONTH = 30 * 24 * 60 * 60;

const results = [];

// ---------------------------------------------------------------------------
// Mini test framework
// ---------------------------------------------------------------------------

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function revertReason(err) {
  if (err?.reason) return err.reason;
  const msg = err?.info?.error?.message || err?.error?.message || err?.shortMessage || err?.message || String(err);
  const match = msg.match(/revert:?\s+(.+)$/);
  return match ? match[1] : msg;
}

async function expectRevert(promise, expectedReason) {
  try {
    const tx = await promise;
    if (tx && typeof tx.wait === "function") await tx.wait();
  } catch (err) {
    const reason = revertReason(err);
    assert(reason === expectedReason, `expected revert "${expectedReason}" but got "${reason}"`);
    return `Reverted: "${reason}"`;
  }
  throw new Error(`Expected revert "${expectedReason}" but the call succeeded`);
}

async function test(category, description, input, expected, fn) {
  const id = `TC${String(results.length + 1).padStart(2, "0")}`;
  let observed;
  let status;
  try {
    observed = await fn();
    status = "PASS";
  } catch (err) {
    observed = err.message;
    status = "FAIL";
  }
  results.push({ id, category, description, input, expected, observed, status });
  console.log(`${status === "PASS" ? "  [PASS]" : "  [FAIL]"} ${id} (${category}) ${description}`);
  if (status === "FAIL") console.log(`         -> ${observed}`);
}

// ---------------------------------------------------------------------------
// Test scenario
// ---------------------------------------------------------------------------

async function main() {
  const provider = new ethers.BrowserProvider(
    ganache.provider({ wallet: { deterministic: true }, logging: { quiet: true }, chain: { chainId: 1337 } })
  );
  const [manufacturer, retailer, customerA, customerB, outsider] = await Promise.all(
    [0, 1, 2, 3, 4].map((i) => provider.getSigner(i))
  );
  const [mAddr, rAddr, aAddr, bAddr, oAddr] = await Promise.all(
    [manufacturer, retailer, customerA, customerB, outsider].map((s) => s.getAddress())
  );

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, manufacturer);
  let wc; // contract connected to the manufacturer
  const as = (signer) => wc.connect(signer);

  console.log("\nWarrantyChain automated tests\n");

  // ----- Constructor -----
  await test("Valid", "Deploy contract with valid constructor arguments",
    `constructor("NovaTech Electronics", 36) from Manufacturer`,
    "Deployed; manufacturer = deployer, brand and max warranty stored",
    async () => {
      wc = await factory.deploy("NovaTech Electronics", 36);
      await wc.waitForDeployment();
      assert((await wc.manufacturer()) === mAddr, "manufacturer");
      assert((await wc.brandName()) === "NovaTech Electronics", "brand");
      assert((await wc.maxWarrantyMonths()) === 36n, "max warranty");
      return `Deployed at ${await wc.getAddress()}; manufacturer and brand stored correctly`;
    });

  await test("Invalid", "Deploy with empty brand name", `constructor("", 36)`,
    `Revert "Brand name cannot be empty"`,
    () => expectRevert(factory.deploy("", 36), "Brand name cannot be empty"));

  await test("Invalid", "Deploy with max warranty = 0", `constructor("NovaTech", 0)`,
    `Revert "Max warranty must be 1-120 months"`,
    () => expectRevert(factory.deploy("NovaTech", 0), "Max warranty must be 1-120 months"));

  await test("Invalid", "Deploy with max warranty above 120 months", `constructor("NovaTech", 121)`,
    `Revert "Max warranty must be 1-120 months"`,
    () => expectRevert(factory.deploy("NovaTech", 121), "Max warranty must be 1-120 months"));

  // ----- Retailer management -----
  await test("Valid", "Manufacturer authorises a retailer", `addRetailer(Retailer, "City Electronics")`,
    "Retailer authorised; retailerCount = 1; RetailerAdded event",
    async () => {
      await (await wc.addRetailer(rAddr, "City Electronics")).wait();
      assert(await wc.isRetailer(rAddr), "isRetailer");
      assert((await wc.retailerCount()) === 1n, "retailerCount");
      return `isRetailer = true, name = "${await wc.retailerName(rAddr)}", retailerCount = 1`;
    });

  await test("Unauthorised", "Outsider tries to authorise a retailer", `addRetailer(Outsider, "Fake Shop") from Outsider`,
    `Revert "Only the manufacturer can perform this action"`,
    () => expectRevert(as(outsider).addRetailer(oAddr, "Fake Shop"), "Only the manufacturer can perform this action"));

  await test("Invalid", "Authorise the zero address", `addRetailer(0x000..000, "Ghost")`,
    `Revert "Invalid retailer address"`,
    () => expectRevert(wc.addRetailer(ZERO, "Ghost"), "Invalid retailer address"));

  await test("Invalid", "Authorise the same retailer twice", `addRetailer(Retailer, "City Electronics")`,
    `Revert "Retailer already authorised"`,
    () => expectRevert(wc.addRetailer(rAddr, "City Electronics"), "Retailer already authorised"));

  await test("Invalid", "Authorise a retailer with an empty name", `addRetailer(CustomerB, "")`,
    `Revert "Retailer name must be 1-64 characters"`,
    () => expectRevert(wc.addRetailer(bAddr, ""), "Retailer name must be 1-64 characters"));

  await test("Invalid", "Authorise the manufacturer as a retailer", `addRetailer(Manufacturer, "Self")`,
    `Revert "Manufacturer cannot be a retailer"`,
    () => expectRevert(wc.addRetailer(mAddr, "Self"), "Manufacturer cannot be a retailer"));

  // ----- Product registration -----
  await test("Valid", "Retailer registers a sold product", `registerProduct("SN-1001", "NovaBook Pro 14", CustomerA, 24) from Retailer`,
    "Product #1 created, owner = CustomerA, expiry = purchase + 24 x 30 days",
    async () => {
      await (await as(retailer).registerProduct("SN-1001", "NovaBook Pro 14", aAddr, 24)).wait();
      const p = await wc.getProduct(1);
      assert(p.currentOwner === aAddr && p.retailer === rAddr, "owner / retailer");
      assert(p.warrantyExpiry - p.purchaseDate === BigInt(24 * MONTH), "expiry");
      return `Product #1 "${p.serialNumber}" owner = CustomerA, warranty = 720 days`;
    });

  await test("Valid", "Retailer registers a second product with a short warranty", `registerProduct("SN-1002", "NovaBuds X", CustomerA, 6) from Retailer`,
    "Product #2 created; productCount = 2",
    async () => {
      await (await as(retailer).registerProduct("SN-1002", "NovaBuds X", aAddr, 6)).wait();
      assert((await wc.productCount()) === 2n, "productCount");
      return "Product #2 created; productCount = 2";
    });

  await test("Unauthorised", "Customer (not a retailer) tries to register a product", `registerProduct("SN-9999", "Fake", CustomerA, 12) from CustomerA`,
    `Revert "Only an authorised retailer can perform this action"`,
    () => expectRevert(as(customerA).registerProduct("SN-9999", "Fake", aAddr, 12), "Only an authorised retailer can perform this action"));

  await test("Invalid", "Register with an empty serial number", `registerProduct("", "NovaBook", CustomerA, 12)`,
    `Revert "Serial number must be 1-64 characters"`,
    () => expectRevert(as(retailer).registerProduct("", "NovaBook", aAddr, 12), "Serial number must be 1-64 characters"));

  await test("Invalid", "Register a duplicate serial number", `registerProduct("SN-1001", "NovaBook", CustomerB, 12)`,
    `Revert "Serial number already registered"`,
    () => expectRevert(as(retailer).registerProduct("SN-1001", "NovaBook", bAddr, 12), "Serial number already registered"));

  await test("Invalid", "Register with an empty model", `registerProduct("SN-1003", "", CustomerA, 12)`,
    `Revert "Model must be 1-64 characters"`,
    () => expectRevert(as(retailer).registerProduct("SN-1003", "", aAddr, 12), "Model must be 1-64 characters"));

  await test("Invalid", "Register with a warranty of 0 months", `registerProduct("SN-1003", "NovaPad", CustomerA, 0)`,
    `Revert "Warranty period out of allowed range"`,
    () => expectRevert(as(retailer).registerProduct("SN-1003", "NovaPad", aAddr, 0), "Warranty period out of allowed range"));

  await test("Invalid", "Register with a warranty above the maximum", `registerProduct("SN-1003", "NovaPad", CustomerA, 37)`,
    `Revert "Warranty period out of allowed range"`,
    () => expectRevert(as(retailer).registerProduct("SN-1003", "NovaPad", aAddr, 37), "Warranty period out of allowed range"));

  await test("Invalid", "Register to the zero address", `registerProduct("SN-1003", "NovaPad", 0x000..000, 12)`,
    `Revert "Invalid buyer address"`,
    () => expectRevert(as(retailer).registerProduct("SN-1003", "NovaPad", ZERO, 12), "Invalid buyer address"));

  await test("Invalid", "Retailer registers a product to itself", `registerProduct("SN-1003", "NovaPad", Retailer, 12)`,
    `Revert "Retailer cannot register a product to itself"`,
    () => expectRevert(as(retailer).registerProduct("SN-1003", "NovaPad", rAddr, 12), "Retailer cannot register a product to itself"));

  // ----- Data retrieval -----
  await test("Valid", "Verify a registered serial number", `verifySerial("SN-1001")`,
    "registered = true, productId = 1, underWarranty = true, owner = CustomerA",
    async () => {
      const r = await wc.verifySerial("SN-1001");
      assert(r.registered && r.productId === 1n && r.underWarranty && r.owner === aAddr, "verify result");
      return "registered = true, productId = 1, underWarranty = true, owner = CustomerA";
    });

  await test("Valid", "Verify an unknown (counterfeit) serial number", `verifySerial("SN-FAKE")`,
    "registered = false",
    async () => {
      const r = await wc.verifySerial("SN-FAKE");
      assert(!r.registered && r.productId === 0n, "not registered");
      return "registered = false, productId = 0";
    });

  await test("Valid", "List products owned by a customer", `getProductsByOwner(CustomerA)`,
    "[1, 2]",
    async () => {
      const ids = (await wc.getProductsByOwner(aAddr)).map(Number);
      assert(JSON.stringify(ids) === "[1,2]", `got ${ids}`);
      return `[${ids.join(", ")}]`;
    });

  // ----- Warranty claims -----
  await test("Unauthorised", "Outsider files a claim on someone else's product", `fileClaim(1, "Broken") from Outsider`,
    `Revert "Only the product owner can perform this action"`,
    () => expectRevert(as(outsider).fileClaim(1, "Broken"), "Only the product owner can perform this action"));

  await test("Invalid", "File a claim with an empty description", `fileClaim(1, "") from CustomerA`,
    `Revert "Issue description must be 1-280 characters"`,
    () => expectRevert(as(customerA).fileClaim(1, ""), "Issue description must be 1-280 characters"));

  await test("Invalid", "File a claim for a non-existent product", `fileClaim(99, "Broken") from CustomerA`,
    `Revert "Product does not exist"`,
    () => expectRevert(as(customerA).fileClaim(99, "Broken"), "Product does not exist"));

  await test("Valid", "Owner files a warranty claim", `fileClaim(1, "Screen flickers after 2 weeks") from CustomerA`,
    "Claim #1 created with status Pending; pendingClaimCount = 1",
    async () => {
      await (await as(customerA).fileClaim(1, "Screen flickers after 2 weeks")).wait();
      const c = await wc.getClaim(1);
      assert(c.status === 0n && c.claimant === aAddr, "pending claim");
      assert((await wc.pendingClaimCount()) === 1n, "pending count");
      return "Claim #1 status = Pending, claimant = CustomerA, pendingClaimCount = 1";
    });

  await test("Invalid", "File a second claim while one is pending", `fileClaim(1, "Still broken") from CustomerA`,
    `Revert "A claim is already pending for this product"`,
    () => expectRevert(as(customerA).fileClaim(1, "Still broken"), "A claim is already pending for this product"));

  await test("Invalid", "Transfer a product while a claim is pending", `transferWarranty(1, CustomerB) from CustomerA`,
    `Revert "Cannot transfer while a claim is pending"`,
    () => expectRevert(as(customerA).transferWarranty(1, bAddr), "Cannot transfer while a claim is pending"));

  await test("Unauthorised", "Customer tries to approve their own claim", `resolveClaim(1, true, "Approved") from CustomerA`,
    `Revert "Only the manufacturer can perform this action"`,
    () => expectRevert(as(customerA).resolveClaim(1, true, "Approved"), "Only the manufacturer can perform this action"));

  await test("Unauthorised", "Retailer tries to resolve a claim", `resolveClaim(1, true, "OK") from Retailer`,
    `Revert "Only the manufacturer can perform this action"`,
    () => expectRevert(as(retailer).resolveClaim(1, true, "OK"), "Only the manufacturer can perform this action"));

  await test("Invalid", "Resolve a claim with an empty note", `resolveClaim(1, true, "")`,
    `Revert "Resolution note must be 1-280 characters"`,
    () => expectRevert(wc.resolveClaim(1, true, ""), "Resolution note must be 1-280 characters"));

  await test("Invalid", "Resolve a non-existent claim", `resolveClaim(5, true, "OK")`,
    `Revert "Claim does not exist"`,
    () => expectRevert(wc.resolveClaim(5, true, "OK"), "Claim does not exist"));

  await test("Valid", "Manufacturer approves the claim", `resolveClaim(1, true, "Display panel replaced")`,
    "Claim #1 status = Approved; pendingClaimCount = 0",
    async () => {
      await (await wc.resolveClaim(1, true, "Display panel replaced")).wait();
      const c = await wc.getClaim(1);
      assert(c.status === 1n && c.resolutionNote === "Display panel replaced", "approved");
      assert((await wc.pendingClaimCount()) === 0n, "pending count");
      return `Claim #1 status = Approved, note = "${c.resolutionNote}"`;
    });

  await test("Invalid", "Resolve an already resolved claim", `resolveClaim(1, false, "Changed mind")`,
    `Revert "Claim already resolved"`,
    () => expectRevert(wc.resolveClaim(1, false, "Changed mind"), "Claim already resolved"));

  // ----- Warranty transfer -----
  await test("Invalid", "Transfer a warranty to yourself", `transferWarranty(1, CustomerA) from CustomerA`,
    `Revert "Cannot transfer to yourself"`,
    () => expectRevert(as(customerA).transferWarranty(1, aAddr), "Cannot transfer to yourself"));

  await test("Invalid", "Transfer a warranty to the zero address", `transferWarranty(1, 0x000..000) from CustomerA`,
    `Revert "Invalid new owner address"`,
    () => expectRevert(as(customerA).transferWarranty(1, ZERO), "Invalid new owner address"));

  await test("Unauthorised", "Outsider tries to transfer someone else's warranty", `transferWarranty(1, Outsider) from Outsider`,
    `Revert "Only the product owner can perform this action"`,
    () => expectRevert(as(outsider).transferWarranty(1, oAddr), "Only the product owner can perform this action"));

  await test("Valid", "Owner transfers the warranty on resale", `transferWarranty(1, CustomerB) from CustomerA`,
    "Owner of #1 = CustomerB; CustomerA owns [2]; CustomerB owns [1]",
    async () => {
      await (await as(customerA).transferWarranty(1, bAddr)).wait();
      const p = await wc.getProduct(1);
      const aIds = (await wc.getProductsByOwner(aAddr)).map(Number);
      const bIds = (await wc.getProductsByOwner(bAddr)).map(Number);
      assert(p.currentOwner === bAddr, "new owner");
      assert(JSON.stringify(aIds) === "[2]" && JSON.stringify(bIds) === "[1]", "owner lists");
      return `Owner of #1 = CustomerB; CustomerA owns [${aIds}]; CustomerB owns [${bIds}]`;
    });

  await test("Unauthorised", "Previous owner tries to claim after transferring", `fileClaim(1, "Broken again") from CustomerA`,
    `Revert "Only the product owner can perform this action"`,
    () => expectRevert(as(customerA).fileClaim(1, "Broken again"), "Only the product owner can perform this action"));

  await test("Valid", "New owner files a claim and manufacturer rejects it",
    `fileClaim(1, "Water damage") from CustomerB; resolveClaim(2, false, "Physical damage not covered")`,
    "Claim #2 status = Rejected; product #1 claimCount = 2",
    async () => {
      await (await as(customerB).fileClaim(1, "Water damage")).wait();
      await (await wc.resolveClaim(2, false, "Physical damage not covered")).wait();
      const c = await wc.getClaim(2);
      const p = await wc.getProduct(1);
      assert(c.status === 2n && p.claimCount === 2n, "rejected");
      return "Claim #2 status = Rejected; product #1 claimCount = 2; getProductClaims(1) = [1, 2]";
    });

  // ----- Retailer revocation -----
  await test("Unauthorised", "Retailer tries to revoke itself", `removeRetailer(Retailer) from Retailer`,
    `Revert "Only the manufacturer can perform this action"`,
    () => expectRevert(as(retailer).removeRetailer(rAddr), "Only the manufacturer can perform this action"));

  await test("Valid", "Manufacturer revokes a retailer", `removeRetailer(Retailer)`,
    "isRetailer = false; retailerCount = 0",
    async () => {
      await (await wc.removeRetailer(rAddr)).wait();
      assert(!(await wc.isRetailer(rAddr)) && (await wc.retailerCount()) === 0n, "revoked");
      return "isRetailer = false; retailerCount = 0";
    });

  await test("Unauthorised", "Revoked retailer tries to register a product", `registerProduct("SN-2001", "NovaPad", CustomerA, 12) from Retailer`,
    `Revert "Only an authorised retailer can perform this action"`,
    () => expectRevert(as(retailer).registerProduct("SN-2001", "NovaPad", aAddr, 12), "Only an authorised retailer can perform this action"));

  await test("Invalid", "Revoke an address that is not a retailer", `removeRetailer(Retailer)`,
    `Revert "Address is not an authorised retailer"`,
    () => expectRevert(wc.removeRetailer(rAddr), "Address is not an authorised retailer"));

  // ----- Expiry (time travel) -----
  await provider.send("evm_increaseTime", [7 * MONTH]);
  await provider.send("evm_mine", []);

  await test("Invalid", "File a claim after the warranty expired (time +7 months)", `fileClaim(2, "Left earbud dead") from CustomerA`,
    `Revert "Warranty has expired"`,
    async () => {
      assert((await wc.isUnderWarranty(2)) === false, "isUnderWarranty should be false");
      return expectRevert(as(customerA).fileClaim(2, "Left earbud dead"), "Warranty has expired");
    });

  await test("Invalid", "Transfer an expired warranty", `transferWarranty(2, CustomerB) from CustomerA`,
    `Revert "Warranty has expired"`,
    () => expectRevert(as(customerA).transferWarranty(2, bAddr), "Warranty has expired"));

  await test("Invalid", "Read a product with ID 0", `getProduct(0)`,
    `Revert "Product does not exist"`,
    () => expectRevert(wc.getProduct(0), "Product does not exist"));

  await test("Valid", "Read final contract statistics", `getStats()`,
    "totalProducts = 2, totalClaims = 2, pendingClaims = 0, activeRetailers = 0",
    async () => {
      const s = await wc.getStats();
      assert(s.totalProducts === 2n && s.totalClaims === 2n && s.pendingClaims === 0n && s.activeRetailers === 0n, "stats");
      return `totalProducts = ${s.totalProducts}, totalClaims = ${s.totalClaims}, pendingClaims = ${s.pendingClaims}, activeRetailers = ${s.activeRetailers}`;
    });

  writeReport();
  await provider.destroy?.();
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function writeReport() {
  const passed = results.filter((r) => r.status === "PASS").length;
  const byCat = (c) => results.filter((r) => r.category === c).length;
  const esc = (s) => String(s).replace(/\|/g, "\\|");

  const lines = [
    "# WarrantyChain - Automated Test Results",
    "",
    `- Generated: ${new Date().toISOString()}`,
    "- Environment: Ganache (in-process, chain ID 1337) + Ethers.js v6, solc 0.8.26 (EVM: paris)",
    `- Total: **${results.length}** | Passed: **${passed}** | Failed: **${results.length - passed}**`,
    `- Valid: ${byCat("Valid")} | Invalid: ${byCat("Invalid")} | Unauthorised: ${byCat("Unauthorised")}`,
    "",
    "| ID | Category | Test case | Input | Expected result | Observed result | Status |",
    "|----|----------|-----------|-------|-----------------|-----------------|--------|",
    ...results.map((r) =>
      `| ${r.id} | ${r.category} | ${esc(r.description)} | \`${esc(r.input)}\` | ${esc(r.expected)} | ${esc(r.observed)} | ${r.status === "PASS" ? "PASS" : "**FAIL**"} |`
    ),
    "",
  ];

  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(RESULTS_PATH, lines.join("\n"));
  console.log(`\n${passed}/${results.length} tests passed. Report written to ${path.relative(process.cwd(), RESULTS_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
