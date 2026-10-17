// ===========================================================================
// WarrantyChain DApp - frontend logic (Ethers.js v6 + MetaMask)
// ===========================================================================

const { CONTRACT_ADDRESS, EXPECTED_CHAIN_ID, NETWORK_NAME, RPC_URL } = window.DAPP_CONFIG;
const ABI = window.WARRANTY_CHAIN_ABI;
const CLAIM_STATUS = ["Pending", "Approved", "Rejected"];
const EXPLORERS = { 11155111: "https://sepolia.etherscan.io/tx/" };

let provider;
let signer;
let contract;
let account;
let chainId;
let switchingNetwork = false;

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "-";
}

function formatDate(ts) {
  const n = Number(ts);
  return n === 0 ? "-" : new Date(n * 1000).toLocaleString();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function log(message, type = "info", txHash) {
  const li = document.createElement("li");
  li.className = type;
  const time = document.createElement("time");
  time.textContent = new Date().toLocaleTimeString();
  li.appendChild(time);
  li.appendChild(document.createTextNode(message));
  if (txHash) {
    li.appendChild(document.createElement("br"));
    const hash = document.createElement(EXPLORERS[chainId] ? "a" : "span");
    hash.className = "mono";
    hash.textContent = `Tx: ${txHash}`;
    if (EXPLORERS[chainId]) {
      hash.href = EXPLORERS[chainId] + txHash;
      hash.target = "_blank";
    }
    li.appendChild(hash);
  }
  $("log").prepend(li);
}

/** Extracts a readable revert reason from an ethers / MetaMask / Ganache error. */
function parseError(err) {
  if (err?.code === "ACTION_REJECTED" || err?.info?.error?.code === 4001) {
    return "Transaction rejected by user in MetaMask";
  }
  if (err?.reason) return err.reason;
  return findRevertReason(err) || err?.shortMessage || err?.message || String(err);
}

/**
 * MetaMask nests the node's error several levels deep (often under a generic
 * "Internal JSON-RPC error."), so search the whole error object for either
 * Error(string) revert data or a "revert <reason>" message.
 */
function findRevertReason(obj, seen = new Set()) {
  if (!obj || typeof obj !== "object" || seen.has(obj)) return null;
  seen.add(obj);

  for (const value of Object.values(obj)) {
    if (typeof value === "string") {
      if (value.startsWith("0x08c379a0")) {
        try {
          return ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + value.slice(10))[0];
        } catch (_) { /* keep searching */ }
      }
      const match = value.match(/reverted with reason string '([^']+)'/) || value.match(/revert(?:ed)?:?\s+(?!\()(.+)$/);
      if (match) return match[1];
    } else if (typeof value === "object") {
      const found = findRevertReason(value, seen);
      if (found) return found;
    }
  }
  return null;
}

const isGenericError = (reason) => /Internal JSON-RPC error|could not coalesce|missing revert data|unknown/i.test(reason);

let rpcProvider;

/**
 * Re-runs a failed call as eth_call to recover the revert reason: first through
 * MetaMask, then straight against the node at RPC_URL (Ganache always returns
 * the full reason there, even when MetaMask hides it).
 */
async function replayForReason(fnName, args) {
  const attempts = [
    () => contract[fnName].staticCall(...args),
    () => {
      rpcProvider ??= new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
      return new ethers.Contract(CONTRACT_ADDRESS, ABI, rpcProvider)[fnName].staticCall(...args, { from: account });
    },
  ];
  for (const attempt of attempts) {
    try {
      await attempt();
    } catch (err) {
      const reason = parseError(err);
      if (!isGenericError(reason)) return reason;
    }
  }
  return null;
}

function requireConnected() {
  if (!contract) {
    log("Please connect MetaMask first.", "error");
    return false;
  }
  return true;
}

function readAddress(inputId, fieldName) {
  const value = $(inputId).value.trim();
  if (!ethers.isAddress(value)) {
    log(`Invalid input: "${fieldName}" is not a valid Ethereum address.`, "error");
    return null;
  }
  return ethers.getAddress(value);
}

const readNumber = (inputId) => BigInt($(inputId).value.trim() || "0");

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/**
 * Sends a state-changing transaction and reports the result.
 * With "Force send" ticked, a fixed gas limit is used so MetaMask skips gas
 * estimation and the transaction is mined even if it reverts. This records a
 * genuine failed transaction on-chain.
 */
async function sendTx(label, fnName, args, button) {
  if (!requireConnected()) return;
  const force = $("forceSend").checked;
  if (button) button.disabled = true;
  log(`${label}: waiting for MetaMask confirmation...`, "info");

  try {
    const overrides = force ? { gasLimit: 500000n } : {};
    const tx = await contract[fnName](...args, overrides);
    log(`${label}: submitted, waiting to be mined...`, "info", tx.hash);
    const receipt = await tx.wait();
    log(`${label}: SUCCESS - mined in block ${receipt.blockNumber}, gas used ${receipt.gasUsed}`, "success", receipt.hash);
    await refreshAll();
    return receipt;
  } catch (err) {
    let reason = parseError(err);
    if (err?.receipt && err.receipt.status === 0) {
      // Mined but reverted: re-run as a call to obtain the revert reason.
      reason = (await replayForReason(fnName, args)) || "transaction reverted";
      log(`${label}: FAILED on-chain in block ${err.receipt.blockNumber} - ${reason}`, "error", err.receipt.hash);
    } else {
      if (isGenericError(reason)) {
        // Wallet hid the reason: replay as eth_call, which returns the revert data directly.
        reason = (await replayForReason(fnName, args)) || reason;
      }
      log(`${label}: FAILED - ${reason}`, "error");
    }
  } finally {
    if (button) button.disabled = false;
  }
}

function bindForm(formId, handler) {
  $(formId).addEventListener("submit", async (event) => {
    event.preventDefault();
    await handler(event.submitter);
  });
}

bindForm("addRetailerForm", async (btn) => {
  const addr = readAddress("retailerAddress", "Retailer wallet address");
  if (!addr) return;
  await sendTx("Add retailer", "addRetailer", [addr, $("retailerNameInput").value.trim()], btn);
});

bindForm("removeRetailerForm", async (btn) => {
  const addr = readAddress("removeRetailerAddress", "Retailer wallet address");
  if (!addr) return;
  await sendTx("Remove retailer", "removeRetailer", [addr], btn);
});

bindForm("resolveClaimForm", async (btn) => {
  const approve = $("resolveDecision").value === "approve";
  await sendTx(
    approve ? "Approve claim" : "Reject claim",
    "resolveClaim",
    [readNumber("resolveClaimId"), approve, $("resolveNote").value.trim()],
    btn
  );
});

bindForm("registerProductForm", async (btn) => {
  const buyer = readAddress("buyerAddress", "Buyer wallet address");
  if (!buyer) return;
  await sendTx(
    "Register product",
    "registerProduct",
    [$("serialNumber").value.trim(), $("model").value.trim(), buyer, readNumber("warrantyMonths")],
    btn
  );
});

bindForm("fileClaimForm", async (btn) => {
  await sendTx("File claim", "fileClaim", [readNumber("claimProductId"), $("claimIssue").value.trim()], btn);
});

bindForm("transferForm", async (btn) => {
  const newOwner = readAddress("newOwnerAddress", "New owner wallet address");
  if (!newOwner) return;
  await sendTx("Transfer warranty", "transferWarranty", [readNumber("transferProductId"), newOwner], btn);
});

// ---------------------------------------------------------------------------
// Blockchain data retrieval
// ---------------------------------------------------------------------------

async function loadOverview() {
  const [brand, stats, maxMonths, manufacturer] = await Promise.all([
    contract.brandName(),
    contract.getStats(),
    contract.maxWarrantyMonths(),
    contract.manufacturer(),
  ]);
  $("statBrand").textContent = brand;
  $("statProducts").textContent = stats.totalProducts.toString();
  $("statClaims").textContent = stats.totalClaims.toString();
  $("statPending").textContent = stats.pendingClaims.toString();
  $("statRetailers").textContent = stats.activeRetailers.toString();
  $("statMaxWarranty").textContent = `${maxMonths} mo`;
  $("contractAddress").textContent = CONTRACT_ADDRESS;
  $("manufacturerAddress").textContent = manufacturer;
  return manufacturer;
}

async function loadRole(manufacturer) {
  const badge = $("roleBadge");
  let role = "customer";
  let label = "Customer";
  if (account.toLowerCase() === manufacturer.toLowerCase()) {
    role = "manufacturer";
    label = "Manufacturer";
  } else if (await contract.isRetailer(account)) {
    role = "retailer";
    label = `Retailer: ${await contract.retailerName(account)}`;
  }
  badge.className = `badge ${role}`;
  badge.textContent = label;
}

function productHtml(p, extra = "") {
  const active = Date.now() / 1000 <= Number(p.warrantyExpiry);
  return `
    <dl class="kv">
      <dt>Product ID</dt><dd>${p.id}</dd>
      <dt>Serial number</dt><dd>${escapeHtml(p.serialNumber)}</dd>
      <dt>Model</dt><dd>${escapeHtml(p.model)}</dd>
      <dt>Current owner</dt><dd class="mono">${p.currentOwner}</dd>
      <dt>Retailer</dt><dd class="mono">${p.retailer}</dd>
      <dt>Purchased</dt><dd>${formatDate(p.purchaseDate)}</dd>
      <dt>Warranty until</dt><dd>${formatDate(p.warrantyExpiry)}</dd>
      <dt>Warranty status</dt><dd class="status ${active ? "ok" : "bad"}">${active ? "ACTIVE" : "EXPIRED"}</dd>
      <dt>Claims filed</dt><dd>${p.claimCount}${p.hasPendingClaim ? " (one pending)" : ""}</dd>
      ${extra}
    </dl>`;
}

function claimHtml(c) {
  const status = CLAIM_STATUS[Number(c.status)];
  const cls = { Pending: "pending", Approved: "ok", Rejected: "bad" }[status];
  return `
    <dl class="kv">
      <dt>Claim ID</dt><dd>${c.id}</dd>
      <dt>Product ID</dt><dd>${c.productId}</dd>
      <dt>Claimant</dt><dd class="mono">${c.claimant}</dd>
      <dt>Issue</dt><dd>${escapeHtml(c.issue)}</dd>
      <dt>Status</dt><dd class="status ${cls}">${status.toUpperCase()}</dd>
      <dt>Filed</dt><dd>${formatDate(c.filedAt)}</dd>
      <dt>Resolved</dt><dd>${formatDate(c.resolvedAt)}</dd>
      <dt>Resolution note</dt><dd>${escapeHtml(c.resolutionNote || "-")}</dd>
    </dl>`;
}

async function loadMyProducts() {
  const container = $("myProducts");
  const ids = await contract.getProductsByOwner(account);
  if (ids.length === 0) {
    container.innerHTML = `<p class="empty">No products registered to ${shortAddr(account)} yet.</p>`;
    return;
  }

  const cards = await Promise.all(
    ids.map(async (id) => {
      const p = await contract.getProduct(id);
      const claimIds = await contract.getProductClaims(id);
      let latest = "No claims";
      if (claimIds.length > 0) {
        const c = await contract.getClaim(claimIds[claimIds.length - 1]);
        latest = `Claim #${c.id}: ${CLAIM_STATUS[Number(c.status)]}`;
      }
      const active = Date.now() / 1000 <= Number(p.warrantyExpiry);
      return `
        <div class="product">
          <h4>#${p.id} &middot; ${escapeHtml(p.model)}</h4>
          <p>Serial: ${escapeHtml(p.serialNumber)}</p>
          <p>Warranty until: ${formatDate(p.warrantyExpiry)}</p>
          <p>Status: <span class="status ${active ? "ok" : "bad"}">${active ? "ACTIVE" : "EXPIRED"}</span></p>
          <p>${latest}</p>
        </div>`;
    })
  );
  container.innerHTML = cards.join("");
}

async function refreshAll() {
  if (!contract) return;
  try {
    const manufacturer = await loadOverview();
    await loadRole(manufacturer);
    await loadMyProducts();
  } catch (err) {
    log(`Could not read contract data - ${parseError(err)}`, "error");
  }
}

$("verifyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireConnected()) return;
  const serial = $("verifySerialInput").value.trim();
  const box = $("verifyResult");
  try {
    const r = await contract.verifySerial(serial);
    if (!r.registered) {
      box.innerHTML = `<p class="status bad">NOT REGISTERED: "${escapeHtml(serial)}" is not a genuine registered product.</p>`;
    } else {
      box.innerHTML = `
        <dl class="kv">
          <dt>Result</dt><dd class="status ok">GENUINE / REGISTERED</dd>
          <dt>Product ID</dt><dd>${r.productId}</dd>
          <dt>Warranty</dt><dd class="status ${r.underWarranty ? "ok" : "bad"}">${r.underWarranty ? "ACTIVE" : "EXPIRED"}</dd>
          <dt>Current owner</dt><dd class="mono">${r.owner}</dd>
        </dl>`;
    }
    log(`Verified serial "${serial}" - ${r.registered ? "registered" : "not registered"}`, "info");
  } catch (err) {
    log(`Verify serial FAILED - ${parseError(err)}`, "error");
  }
});

$("lookupProductForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireConnected()) return;
  try {
    const p = await contract.getProduct(readNumber("lookupProductId"));
    $("lookupResult").innerHTML = productHtml(p);
  } catch (err) {
    $("lookupResult").innerHTML = "";
    log(`Get product FAILED - ${parseError(err)}`, "error");
  }
});

$("lookupClaimForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireConnected()) return;
  try {
    const c = await contract.getClaim(readNumber("lookupClaimId"));
    $("lookupResult").innerHTML = claimHtml(c);
  } catch (err) {
    $("lookupResult").innerHTML = "";
    log(`Get claim FAILED - ${parseError(err)}`, "error");
  }
});

// ---------------------------------------------------------------------------
// MetaMask connection
// ---------------------------------------------------------------------------

/** Asks MetaMask to switch to the configured chain, adding it first if MetaMask does not know it. */
async function ensureNetwork() {
  if (!EXPECTED_CHAIN_ID) return;
  const expectedHex = "0x" + Number(EXPECTED_CHAIN_ID).toString(16);
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (current.toLowerCase() === expectedHex) return;

  log(`MetaMask is on chain ${parseInt(current, 16)} - requesting switch to ${NETWORK_NAME} (${EXPECTED_CHAIN_ID})...`, "info");
  switchingNetwork = true;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: expectedHex }] });
  } catch (err) {
    const unknownChain = err?.code === 4902 || err?.data?.originalError?.code === 4902;
    if (!unknownChain) throw err;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: expectedHex,
        chainName: NETWORK_NAME,
        rpcUrls: [RPC_URL],
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      }],
    });
  } finally {
    switchingNetwork = false;
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    log("MetaMask not detected. Install the MetaMask extension and reload the page.", "error");
    alert("MetaMask is not installed. Please install it from https://metamask.io");
    return;
  }
  if (!ethers.isAddress(CONTRACT_ADDRESS)) {
    log("Contract address not configured. Set CONTRACT_ADDRESS in frontend/config.js.", "error");
    return;
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    try {
      await ensureNetwork();
    } catch (err) {
      log(`Network switch FAILED - ${parseError(err)}. Select ${NETWORK_NAME} in MetaMask manually.`, "error");
    }

    // Created after the network switch: an ethers provider cannot survive a chain change.
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    account = await signer.getAddress();
    chainId = Number((await provider.getNetwork()).chainId);

    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
      log(`No contract found at ${CONTRACT_ADDRESS} on chain ${chainId}. Check the network in MetaMask and the address in config.js.`, "error");
      return;
    }

    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

    $("walletInfo").classList.remove("hidden");
    $("accountAddress").textContent = shortAddr(account);
    $("accountAddress").title = account;
    $("networkName").textContent = `Chain ID ${chainId}`;
    $("connectBtn").textContent = "Connected";

    const warning = $("networkWarning");
    if (EXPECTED_CHAIN_ID && chainId !== Number(EXPECTED_CHAIN_ID)) {
      warning.textContent = `MetaMask is on chain ${chainId}, but this DApp is configured for chain ${EXPECTED_CHAIN_ID}.`;
      warning.classList.remove("hidden");
    } else {
      warning.classList.add("hidden");
    }

    log(`Connected ${account} on chain ${chainId}`, "success");
    await refreshAll();
  } catch (err) {
    log(`Connection FAILED - ${parseError(err)}`, "error");
  }
}

$("connectBtn").addEventListener("click", connectWallet);
$("refreshBtn").addEventListener("click", refreshAll);
$("clearLogBtn").addEventListener("click", () => ($("log").innerHTML = ""));

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    if (accounts.length === 0) {
      location.reload();
    } else {
      log("MetaMask account changed - reconnecting...", "info");
      connectWallet();
    }
  });
  window.ethereum.on("chainChanged", () => {
    if (!switchingNetwork) location.reload();
  });
}
