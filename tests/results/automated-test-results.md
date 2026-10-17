# WarrantyChain - Automated Test Results

- Generated: 2026-10-17T03:20:51.037Z
- Environment: Ganache (in-process, chain ID 1337) + Ethers.js v6, solc 0.8.26 (EVM: paris)
- Total: **49** | Passed: **49** | Failed: **0**
- Valid: 13 | Invalid: 27 | Unauthorised: 9

| ID | Category | Test case | Input | Expected result | Observed result | Status |
|----|----------|-----------|-------|-----------------|-----------------|--------|
| TC01 | Valid | Deploy contract with valid constructor arguments | `constructor("NovaTech Electronics", 36) from Manufacturer` | Deployed; manufacturer = deployer, brand and max warranty stored | Deployed at 0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab; manufacturer and brand stored correctly | PASS |
| TC02 | Invalid | Deploy with empty brand name | `constructor("", 36)` | Revert "Brand name cannot be empty" | Reverted: "Brand name cannot be empty" | PASS |
| TC03 | Invalid | Deploy with max warranty = 0 | `constructor("NovaTech", 0)` | Revert "Max warranty must be 1-120 months" | Reverted: "Max warranty must be 1-120 months" | PASS |
| TC04 | Invalid | Deploy with max warranty above 120 months | `constructor("NovaTech", 121)` | Revert "Max warranty must be 1-120 months" | Reverted: "Max warranty must be 1-120 months" | PASS |
| TC05 | Valid | Manufacturer authorises a retailer | `addRetailer(Retailer, "City Electronics")` | Retailer authorised; retailerCount = 1; RetailerAdded event | isRetailer = true, name = "City Electronics", retailerCount = 1 | PASS |
| TC06 | Unauthorised | Outsider tries to authorise a retailer | `addRetailer(Outsider, "Fake Shop") from Outsider` | Revert "Only the manufacturer can perform this action" | Reverted: "Only the manufacturer can perform this action" | PASS |
| TC07 | Invalid | Authorise the zero address | `addRetailer(0x000..000, "Ghost")` | Revert "Invalid retailer address" | Reverted: "Invalid retailer address" | PASS |
| TC08 | Invalid | Authorise the same retailer twice | `addRetailer(Retailer, "City Electronics")` | Revert "Retailer already authorised" | Reverted: "Retailer already authorised" | PASS |
| TC09 | Invalid | Authorise a retailer with an empty name | `addRetailer(CustomerB, "")` | Revert "Retailer name must be 1-64 characters" | Reverted: "Retailer name must be 1-64 characters" | PASS |
| TC10 | Invalid | Authorise the manufacturer as a retailer | `addRetailer(Manufacturer, "Self")` | Revert "Manufacturer cannot be a retailer" | Reverted: "Manufacturer cannot be a retailer" | PASS |
| TC11 | Valid | Retailer registers a sold product | `registerProduct("SN-1001", "NovaBook Pro 14", CustomerA, 24) from Retailer` | Product #1 created, owner = CustomerA, expiry = purchase + 24 x 30 days | Product #1 "SN-1001" owner = CustomerA, warranty = 720 days | PASS |
| TC12 | Valid | Retailer registers a second product with a short warranty | `registerProduct("SN-1002", "NovaBuds X", CustomerA, 6) from Retailer` | Product #2 created; productCount = 2 | Product #2 created; productCount = 2 | PASS |
| TC13 | Unauthorised | Customer (not a retailer) tries to register a product | `registerProduct("SN-9999", "Fake", CustomerA, 12) from CustomerA` | Revert "Only an authorised retailer can perform this action" | Reverted: "Only an authorised retailer can perform this action" | PASS |
| TC14 | Invalid | Register with an empty serial number | `registerProduct("", "NovaBook", CustomerA, 12)` | Revert "Serial number must be 1-64 characters" | Reverted: "Serial number must be 1-64 characters" | PASS |
| TC15 | Invalid | Register a duplicate serial number | `registerProduct("SN-1001", "NovaBook", CustomerB, 12)` | Revert "Serial number already registered" | Reverted: "Serial number already registered" | PASS |
| TC16 | Invalid | Register with an empty model | `registerProduct("SN-1003", "", CustomerA, 12)` | Revert "Model must be 1-64 characters" | Reverted: "Model must be 1-64 characters" | PASS |
| TC17 | Invalid | Register with a warranty of 0 months | `registerProduct("SN-1003", "NovaPad", CustomerA, 0)` | Revert "Warranty period out of allowed range" | Reverted: "Warranty period out of allowed range" | PASS |
| TC18 | Invalid | Register with a warranty above the maximum | `registerProduct("SN-1003", "NovaPad", CustomerA, 37)` | Revert "Warranty period out of allowed range" | Reverted: "Warranty period out of allowed range" | PASS |
| TC19 | Invalid | Register to the zero address | `registerProduct("SN-1003", "NovaPad", 0x000..000, 12)` | Revert "Invalid buyer address" | Reverted: "Invalid buyer address" | PASS |
| TC20 | Invalid | Retailer registers a product to itself | `registerProduct("SN-1003", "NovaPad", Retailer, 12)` | Revert "Retailer cannot register a product to itself" | Reverted: "Retailer cannot register a product to itself" | PASS |
| TC21 | Valid | Verify a registered serial number | `verifySerial("SN-1001")` | registered = true, productId = 1, underWarranty = true, owner = CustomerA | registered = true, productId = 1, underWarranty = true, owner = CustomerA | PASS |
| TC22 | Valid | Verify an unknown (counterfeit) serial number | `verifySerial("SN-FAKE")` | registered = false | registered = false, productId = 0 | PASS |
| TC23 | Valid | List products owned by a customer | `getProductsByOwner(CustomerA)` | [1, 2] | [1, 2] | PASS |
| TC24 | Unauthorised | Outsider files a claim on someone else's product | `fileClaim(1, "Broken") from Outsider` | Revert "Only the product owner can perform this action" | Reverted: "Only the product owner can perform this action" | PASS |
| TC25 | Invalid | File a claim with an empty description | `fileClaim(1, "") from CustomerA` | Revert "Issue description must be 1-280 characters" | Reverted: "Issue description must be 1-280 characters" | PASS |
| TC26 | Invalid | File a claim for a non-existent product | `fileClaim(99, "Broken") from CustomerA` | Revert "Product does not exist" | Reverted: "Product does not exist" | PASS |
| TC27 | Valid | Owner files a warranty claim | `fileClaim(1, "Screen flickers after 2 weeks") from CustomerA` | Claim #1 created with status Pending; pendingClaimCount = 1 | Claim #1 status = Pending, claimant = CustomerA, pendingClaimCount = 1 | PASS |
| TC28 | Invalid | File a second claim while one is pending | `fileClaim(1, "Still broken") from CustomerA` | Revert "A claim is already pending for this product" | Reverted: "A claim is already pending for this product" | PASS |
| TC29 | Invalid | Transfer a product while a claim is pending | `transferWarranty(1, CustomerB) from CustomerA` | Revert "Cannot transfer while a claim is pending" | Reverted: "Cannot transfer while a claim is pending" | PASS |
| TC30 | Unauthorised | Customer tries to approve their own claim | `resolveClaim(1, true, "Approved") from CustomerA` | Revert "Only the manufacturer can perform this action" | Reverted: "Only the manufacturer can perform this action" | PASS |
| TC31 | Unauthorised | Retailer tries to resolve a claim | `resolveClaim(1, true, "OK") from Retailer` | Revert "Only the manufacturer can perform this action" | Reverted: "Only the manufacturer can perform this action" | PASS |
| TC32 | Invalid | Resolve a claim with an empty note | `resolveClaim(1, true, "")` | Revert "Resolution note must be 1-280 characters" | Reverted: "Resolution note must be 1-280 characters" | PASS |
| TC33 | Invalid | Resolve a non-existent claim | `resolveClaim(5, true, "OK")` | Revert "Claim does not exist" | Reverted: "Claim does not exist" | PASS |
| TC34 | Valid | Manufacturer approves the claim | `resolveClaim(1, true, "Display panel replaced")` | Claim #1 status = Approved; pendingClaimCount = 0 | Claim #1 status = Approved, note = "Display panel replaced" | PASS |
| TC35 | Invalid | Resolve an already resolved claim | `resolveClaim(1, false, "Changed mind")` | Revert "Claim already resolved" | Reverted: "Claim already resolved" | PASS |
| TC36 | Invalid | Transfer a warranty to yourself | `transferWarranty(1, CustomerA) from CustomerA` | Revert "Cannot transfer to yourself" | Reverted: "Cannot transfer to yourself" | PASS |
| TC37 | Invalid | Transfer a warranty to the zero address | `transferWarranty(1, 0x000..000) from CustomerA` | Revert "Invalid new owner address" | Reverted: "Invalid new owner address" | PASS |
| TC38 | Unauthorised | Outsider tries to transfer someone else's warranty | `transferWarranty(1, Outsider) from Outsider` | Revert "Only the product owner can perform this action" | Reverted: "Only the product owner can perform this action" | PASS |
| TC39 | Valid | Owner transfers the warranty on resale | `transferWarranty(1, CustomerB) from CustomerA` | Owner of #1 = CustomerB; CustomerA owns [2]; CustomerB owns [1] | Owner of #1 = CustomerB; CustomerA owns [2]; CustomerB owns [1] | PASS |
| TC40 | Unauthorised | Previous owner tries to claim after transferring | `fileClaim(1, "Broken again") from CustomerA` | Revert "Only the product owner can perform this action" | Reverted: "Only the product owner can perform this action" | PASS |
| TC41 | Valid | New owner files a claim and manufacturer rejects it | `fileClaim(1, "Water damage") from CustomerB; resolveClaim(2, false, "Physical damage not covered")` | Claim #2 status = Rejected; product #1 claimCount = 2 | Claim #2 status = Rejected; product #1 claimCount = 2; getProductClaims(1) = [1, 2] | PASS |
| TC42 | Unauthorised | Retailer tries to revoke itself | `removeRetailer(Retailer) from Retailer` | Revert "Only the manufacturer can perform this action" | Reverted: "Only the manufacturer can perform this action" | PASS |
| TC43 | Valid | Manufacturer revokes a retailer | `removeRetailer(Retailer)` | isRetailer = false; retailerCount = 0 | isRetailer = false; retailerCount = 0 | PASS |
| TC44 | Unauthorised | Revoked retailer tries to register a product | `registerProduct("SN-2001", "NovaPad", CustomerA, 12) from Retailer` | Revert "Only an authorised retailer can perform this action" | Reverted: "Only an authorised retailer can perform this action" | PASS |
| TC45 | Invalid | Revoke an address that is not a retailer | `removeRetailer(Retailer)` | Revert "Address is not an authorised retailer" | Reverted: "Address is not an authorised retailer" | PASS |
| TC46 | Invalid | File a claim after the warranty expired (time +7 months) | `fileClaim(2, "Left earbud dead") from CustomerA` | Revert "Warranty has expired" | Reverted: "Warranty has expired" | PASS |
| TC47 | Invalid | Transfer an expired warranty | `transferWarranty(2, CustomerB) from CustomerA` | Revert "Warranty has expired" | Reverted: "Warranty has expired" | PASS |
| TC48 | Invalid | Read a product with ID 0 | `getProduct(0)` | Revert "Product does not exist" | Reverted: "Product does not exist" | PASS |
| TC49 | Valid | Read final contract statistics | `getStats()` | totalProducts = 2, totalClaims = 2, pendingClaims = 0, activeRetailers = 0 | totalProducts = 2, totalClaims = 2, pendingClaims = 0, activeRetailers = 0 | PASS |
