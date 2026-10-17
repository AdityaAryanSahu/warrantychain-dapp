# Deployment Details

All values below were read from the Ganache blockchain the contract is deployed on.
No private keys, seed phrases or passwords are included.

## Network

| Item | Value |
|------|-------|
| Network | Ganache GUI (local Ethereum network), workspace "Quickstart" |
| RPC URL | `http://127.0.0.1:7545` |
| Chain ID | `1337` |
| Network ID (Ganache) | `5777` |
| Hardfork | Merge |
| Currency symbol | ETH |
| Block explorer | None (local network). Transactions can be viewed in the Ganache Transactions tab. |

## Compiler settings (Remix IDE 2.6.7)

| Item | Value |
|------|-------|
| Compiler | solc 0.8.26 (confirmed from the deployed bytecode metadata) |
| EVM version | paris |
| Optimisation | Disabled for the deployed contract (deployed bytecode is 17,343 bytes, under the 24,576-byte limit) |
| Contract | `WarrantyChain` (`contracts/WarrantyChain.sol`) |

The Remix unit tests (`tests/WarrantyChain_test.sol`) need the optimiser enabled, because each
test contract embeds the full WarrantyChain bytecode. This does not affect the deployed contract.

## Deployment

| Item | Value |
|------|-------|
| Remix environment | Browser Extension - MetaMask (Injected Provider) |
| Constructor `_brandName` | `"NovaTech Electronics"` |
| Constructor `_maxWarrantyMonths` | `36` |
| Deployer / manufacturer address | `0x748DDac16Cb6575DbBc16450B6FBfebcF08583C7` |
| **Deployed contract address** | **`0xf471B63f2636dd3dbD431DceEC68F64443ED1bF5`** |
| Deployment transaction hash | `0x563f87d1da10e1f0f6e4cce102569ce23990201e420018e29d31b9fe0f7e7f00` |
| Block number | 1 |
| Gas used | 3,829,542 |
| Date and time of deployment | 17-10-2026 07:45:59 IST (02:15:59 UTC) |

## Test accounts used

Public addresses only.

| Role | Ganache account index | Public address |
|------|-----------------------|----------------|
| Manufacturer (deployer) | 0 | 0x748DDac16Cb6575DbBc16450B6FBfebcF08583C7 |
| Retailer | 1 | 0xE8d0dA53662288D02Bce9C508a51D299BF5e8343 |
| Customer A | 2 | 0x31E9132718A1C385768d3c3017609520c42C1Ac9 |
| Customer B (second-hand buyer) | 3 | 0x37D8662Bfe0e3754B4EC4255D2dF3c849B89BBEF |
| Unauthorised outsider | 4 | 0x4FcbA169c9fFb447aFD7648375e2A050594b94ad |

## Transaction log (evidence)

Every transaction sent to the contract, read from Ganache in block order. All were sent from
the DApp UI or Remix through MetaMask. See [`../screenshots`](../screenshots) for the
matching screenshots.

| Block | Action | From (role) | Tx hash | Gas used | Status |
|-------|--------|-------------|---------|----------|--------|
| 1 | Deploy `WarrantyChain("NovaTech Electronics", 36)` | Manufacturer | `0x563f87d1da10e1f0f6e4cce102569ce23990201e420018e29d31b9fe0f7e7f00` | 3,829,542 | Success |
| 2 | `addRetailer(Retailer, "City Electronics")` | Manufacturer | `0x23b9ad7ff7763adc4c7ffd7d04920ab5a8ca22bb200fdde7ba843fc581f8da5d` | 92,883 | Success |
| 3 | `removeRetailer(Retailer)` | Manufacturer | `0x5994d39bb0a26fea48874784b22a22716b557e327e1ecc4c7665a754ac3d4b00` | 26,948 | Success |
| 4 | `addRetailer(Retailer, "City Electronics")` | Manufacturer | `0x7050f95203c5c1ad310eaebe38a082c2ebea982d7884da3439f33855306b4432` | 72,983 | Success |
| 5 | `registerProduct("SN-1001", "NovaBook Pro 14", CustomerA, 24)` | Retailer | `0x06476d12aa8c15dff28f96afd0ff733054f50ada19ff805db2676704ed58f487` | 281,343 | Success |
| 6 | `fileClaim(1, "screen issue")` | Customer A | `0x28cb5d7a073f127beaad78f6860ce9d8df76b57e612fedce853d04a1d5bd0527` | 283,997 | Success |
| 7 | `resolveClaim(1, true, "display replaced")` | Manufacturer | `0x0acbfb96b8cc091bfc8ebf851c146ecba0cc955d5caea83884e7ce53dbb0fc09` | 97,614 | Success |
| 8 | `addRetailer(Outsider, "Forced addition")` with Force send | **Outsider** | `0x40378cb61275584aadecddbf405721ab939235237c7cf5c254efed19b0adfbc0` | 23,159 | **Failed (reverted: Only the manufacturer can perform this action)** |
| 9 | `fileClaim(1, "screen issue broken")` | Customer A | `0x7375df479f7ef4735cc3f2963054486ea536819651e4b0626e0d6eb9bc0d6440` | 232,781 | Success |
| 10 | `resolveClaim(1, true, "display replaced done")` | **Customer A** | `0x88b8eca8470d35de1b73f25649e87e3121c7a36ffb09ed0e4874909fae5095d7` | 23,273 | **Failed (reverted: Only the manufacturer can perform this action)** |

Contract state after these transactions (`getStats()`): 1 product, 2 claims (claim #1 Approved,
claim #2 Pending), 1 pending claim, 1 active retailer.
