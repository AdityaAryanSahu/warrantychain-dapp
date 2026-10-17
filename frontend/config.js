// ---------------------------------------------------------------------------
// DApp configuration
// ---------------------------------------------------------------------------
// After deploying WarrantyChain.sol from Remix, paste the deployed contract
// address below (Remix > Deploy & Run > Deployed Contracts > copy icon).
//
// On "Connect MetaMask" the DApp asks MetaMask to switch to EXPECTED_CHAIN_ID
// (and to add the network using RPC_URL if MetaMask does not know it yet).
// Common values:
//   Ganache GUI     -> 1337 (sometimes 5777 is shown as the *network* id)
//   Ganache CLI     -> 1337
//   Sepolia testnet -> 11155111
// ---------------------------------------------------------------------------

window.DAPP_CONFIG = {
  CONTRACT_ADDRESS: "0xf471B63f2636dd3dbD431DceEC68F64443ED1bF5",
  EXPECTED_CHAIN_ID: 1337,
  NETWORK_NAME: "Ganache Local",
  RPC_URL: "http://127.0.0.1:7545",
};
