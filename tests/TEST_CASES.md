# WarrantyChain - Test Cases

Testing was done at three levels:

| Level | File | How to run | Result |
|-------|------|-----------|--------|
| 1. Automated (Ganache + Ethers.js) | [`warrantychain.test.js`](warrantychain.test.js) | `npm install` then `npm test` | **49 / 49 passed** - full report in [`results/automated-test-results.md`](results/automated-test-results.md) |
| 2. Remix Solidity unit tests | [`WarrantyChain_test.sol`](WarrantyChain_test.sol) + [`helpers/WarrantyChainTestBase.sol`](helpers/WarrantyChainTestBase.sol) | Remix > Solidity Compiler: tick **Enable optimization** (runs 200, EVM paris) > Solidity Unit Testing plugin > select file > Run | **Passed 18, Failed 0** in Remix (screenshot 07) |
| 3. Manual UI tests (MetaMask + Ganache) | this document | Follow the table below in the DApp | Core flow and two on-chain failed transactions executed; remaining cases covered by Level 1 |

---

## Level 2 - Remix Solidity Unit Testing

Set up in Remix:

1. Create `tests/WarrantyChain_test.sol` and `tests/helpers/WarrantyChainTestBase.sol` with the contents of these files.
2. In the Solidity Compiler tab, select 0.8.26, EVM version **paris**, and tick **Enable optimization** (200 runs). Without the optimizer the test contracts exceed the 24,576-byte contract size limit and Remix cannot deploy them.
3. In Solidity Unit Testing, select `tests/WarrantyChain_test.sol` and click **Run**.

Remix summary for `tests/WarrantyChain_test.sol`: **Passed 18, Failed 0** (see [`../screenshots/07-remix-unit-tests.png`](../screenshots/07-remix-unit-tests.png)).

The file contains two test contracts. `WarrantyChainValidTest` covers valid inputs. `WarrantyChainRejectTest` covers invalid and unauthorised inputs.

| Test function | Category | Result in Remix |
|---------------|----------|-----------------|
| `testConstructorSetsState` | Valid | Pass |
| `testAddRetailer` | Valid | Pass |
| `testRegisterProduct` | Valid | Pass |
| `testVerifySerial` | Valid | Pass |
| `testFileAndApproveClaim` | Valid | Pass |
| `testTransferWarranty` | Valid | Pass |
| `testRejectDuplicateSerial` | Invalid | Pass |
| `testRejectWarrantyAboveMax` | Invalid | Pass |
| `testRejectEmptySerial` | Invalid | Pass |
| `testRejectZeroAddressRetailer` | Invalid | Pass |
| `testRejectEmptyClaimIssue` | Invalid | Pass |
| `testRejectResolvingResolvedClaim` | Invalid | Pass |
| `testOutsiderCannotAddRetailer` | Unauthorised | Pass |
| `testCustomerCannotRegisterProduct` | Unauthorised | Pass |
| `testPreviousOwnerCannotClaim` | Unauthorised | Pass |
| `testCustomerCannotResolveClaim` | Unauthorised | Pass |
| `testOutsiderCannotTransfer` | Unauthorised | Pass |

---

## Level 3 - Manual UI tests through MetaMask

Accounts: **M** = Manufacturer (Ganache account 0, deployer), **R** = Retailer (account 1),
**A** = Customer A (account 2), **B** = Customer B (account 3), **X** = Outsider (account 4).
Switch accounts in MetaMask before each step. The DApp reconnects automatically.

Run the steps in order, because later steps depend on earlier ones.

### Valid inputs

| ID | Account | Action in UI | Input | Expected result | Observed result |
|----|---------|--------------|-------|-----------------|-----------------|
| V1 | M | Connect MetaMask | - | Header shows the address and a **Manufacturer** badge; overview stats load | Connected `0x748D...83C7` on chain 1337 with the **MANUFACTURER** badge; overview loaded (screenshot 03) |
| V2 | M | Authorise retailer | Address of R, name `City Electronics` | SUCCESS in log; Retailers = 1 | SUCCESS, block 2, tx `0x23b9ad7f...f8da5d`, gas 92,883 |
| V3 | R | Register product | `SN-1001`, `NovaBook Pro 14`, address of A, `24` | SUCCESS; Products = 1 | SUCCESS, block 5, tx `0x06476d12...58f487`, gas 281,343 (screenshot 04) |
| V4 | Any | Verify serial | `SN-1001` | GENUINE / REGISTERED, warranty ACTIVE, owner = A | Not executed in the UI. Covered by automated test TC21 (PASS). |
| V5 | A | (view) My Products | - | Card for product #1 with warranty date | Card for product #1 `NovaBook Pro 14`, `SN-1001`, warranty until 06-10-2028, ACTIVE (screenshot 06) |
| V6 | A | File claim | Product `1`, `Screen flickers after 2 weeks` | SUCCESS; Pending claims = 1 | SUCCESS, block 6, tx `0x28cb5d7a...bd0527` (issue entered as `screen issue`) |
| V7 | M | Resolve claim | Claim `1`, Approve, `Display panel replaced` | SUCCESS; Get claim 1 shows APPROVED | SUCCESS, block 7, tx `0x0acbfb96...0fc09`; Get claim 1 shows **APPROVED**, note `display replaced` (screenshots 05, 06) |
| V8 | A | Transfer warranty | Product `1`, address of B | SUCCESS; product #1 now in B's My Products | Not executed in the UI. Covered by automated test TC39 (PASS). |

### Invalid inputs

| ID | Account | Action in UI | Input | Expected result | Observed result |
|----|---------|--------------|-------|-----------------|-----------------|
| I1 | R | Register product | Duplicate serial `SN-1001` | FAILED - `Serial number already registered` | Not executed in the UI. Covered by automated test TC15 (PASS). |
| I2 | R | Register product | Warranty months `40` (max 36) | FAILED - `Warranty period out of allowed range` | Not executed in the UI. Covered by automated test TC18 (PASS). |
| I3 | R | Register product | Empty serial number | FAILED - `Serial number must be 1-64 characters` | Not executed in the UI. Covered by automated test TC14 (PASS). |
| I4 | R | Register product | Buyer = `0x0000000000000000000000000000000000000000` | FAILED - `Invalid buyer address` | Not executed in the UI. Covered by automated test TC19 (PASS). |
| I5 | R | Register product | Buyer = `hello` | Blocked by UI - `"Buyer wallet address" is not a valid Ethereum address` | Not executed in the UI (client-side address check in `app.js`). |
| I6 | M | Authorise retailer | Address of R again | FAILED - `Retailer already authorised` | Not executed in the UI. Covered by automated test TC08 (PASS). |
| I7 | B | File claim | Product `99` | FAILED - `Product does not exist` | Not executed in the UI. Covered by automated test TC26 (PASS). |
| I8 | B | File claim | Product `1`, empty description | FAILED - `Issue description must be 1-280 characters` | Not executed in the UI. Covered by automated test TC25 (PASS). |
| I9 | M | Resolve claim | Claim `1` again | FAILED - `Claim already resolved` | Not executed in the UI. Covered by automated test TC35 (PASS). |
| I10 | B | Transfer warranty | Product `1`, B's own address | FAILED - `Cannot transfer to yourself` | Not executed in the UI. Covered by automated test TC36 (PASS). |
| I11 | Any | Verify serial | `SN-FAKE` | NOT REGISTERED (counterfeit) | Not executed in the UI. Covered by automated test TC22 (PASS). |

### Unauthorised inputs

| ID | Account | Action in UI | Input | Expected result | Observed result |
|----|---------|--------------|-------|-----------------|-----------------|
| U1 | X | Authorise retailer | Address of X, `Fake Shop` | FAILED - `Only the manufacturer can perform this action` | FAILED on-chain (Force send), block 8, tx `0x40378cb6...adfbc0`: `Only the manufacturer can perform this action` (screenshot 05) |
| U2 | A | Register product | `SN-9999`, ... | FAILED - `Only an authorised retailer can perform this action` | Not executed in the UI. Covered by automated test TC13 (PASS). |
| U3 | X | File claim | Product `1` | FAILED - `Only the product owner can perform this action` | Not executed in the UI. Covered by automated test TC24 (PASS). |
| U4 | A | File claim (after V8 transfer) | Product `1` | FAILED - `Only the product owner can perform this action` | Not executed in the UI. Covered by automated test TC40 (PASS). |
| U5 | B | Resolve claim | Any claim ID | FAILED - `Only the manufacturer can perform this action` | Executed as Customer A instead of B: FAILED on-chain, block 10, tx `0x88b8eca8...5095d7`: `Only the manufacturer can perform this action` (screenshot 10) |
| U6 | R | Revoke retailer | Address of R | FAILED - `Only the manufacturer can perform this action` | Not executed in the UI. Covered by automated test TC42 (PASS). |
| U7 | X | Transfer warranty | Product `1`, address of X | FAILED - `Only the product owner can perform this action` | Not executed in the UI. Covered by automated test TC38 (PASS). |

> **Recording a failed transaction on-chain:** MetaMask normally estimates gas
> first, so a reverting call is rejected before it is sent. To produce a real
> failed transaction (status 0) in MetaMask and Ganache, tick **Force send** in the
> DApp before submitting U1 or I1. The Activity Log then shows
> `FAILED on-chain in block N - <reason>` with the transaction hash.

> **Expired warranty:** the expiry checks (`Warranty has expired`) need the
> blockchain clock to move forward by months. The automated suite does this with
> `evm_increaseTime` (TC46 and TC47).
