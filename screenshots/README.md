# Screenshots

Save your screenshots in this folder **with exactly these file names** so that
the images in the main README display automatically.

| File name | What to capture |
|-----------|-----------------|
| `01-compilation.png` | Remix **Solidity Compiler** tab showing a green tick for `WarrantyChain.sol` (compiler 0.8.26, EVM version paris) |
| `02-deployment.png` | Remix **Deploy & Run** tab: Injected Provider - MetaMask, constructor arguments, and the deployed contract under "Deployed Contracts" with its address. Include the Remix terminal showing the successful deployment transaction. |
| `03-metamask-connection.png` | The DApp after clicking **Connect MetaMask**: account address, chain ID and role badge in the header (the MetaMask "Connect" pop-up can be a second image) |
| `04-successful-transaction.png` | A successful transaction, e.g. *Register product*: the MetaMask confirmation and/or the green **SUCCESS** entry with the tx hash in the Activity Log (a Ganache "Transactions" tab view is a useful extra) |
| `05-failed-transaction.png` | A failed transaction, e.g. an outsider clicking *Add retailer*: the red **FAILED** entry with the revert reason in the Activity Log. With **Force send** ticked, also capture the failed transaction in MetaMask Activity or Ganache. |
| `06-blockchain-data-ui.png` | Blockchain data shown in the UI: Contract Overview stats, **My Products**, and a *Verify Serial Number* / *Get product* / *Get claim* result |

Optional extra evidence:

| File name | What to capture |
|-----------|-----------------|
| `07-remix-unit-tests.png` | Remix **Solidity Unit Testing** plugin with all tests in `tests/WarrantyChain_test.sol` passing |
| `08-automated-tests.png` | Terminal output of `npm test` (49/49 passing) |
| `09-ganache-transactions.png` | Ganache GUI "Transactions" or "Blocks" tab listing the DApp transactions |
| `10-unauthorised-attempt.png` | Any other unauthorised action, e.g. a customer trying to resolve a claim |

Before you take a screenshot, make sure no private key, seed phrase or password is visible.
