// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Remix IDE "Solidity Unit Testing" plugin test file.
// In Remix: create tests/WarrantyChain_test.sol and
// tests/helpers/WarrantyChainTestBase.sol, open the Solidity Unit Testing
// plugin, select this file and click "Run".
//
// Compiler settings: 0.8.26, EVM version paris, optimization ENABLED (200 runs).
// Each test contract embeds the full WarrantyChain bytecode, so the tests are
// split into two contracts to stay under the 24,576-byte contract size limit.

import "remix_tests.sol";
import "./helpers/WarrantyChainTestBase.sol";

/// Valid inputs: the full happy path, run in order.
contract WarrantyChainValidTest is WarrantyChainTestBase {
    function beforeAll() public {
        deployFixture();
    }

    function testConstructorSetsState() public {
        Assert.equal(wc.manufacturer(), address(this), "Deployer should be the manufacturer");
        Assert.equal(wc.brandName(), "NovaTech Electronics", "Brand name should be stored");
        Assert.equal(wc.maxWarrantyMonths(), uint256(36), "Max warranty should be 36 months");
    }

    function testAddRetailer() public {
        wc.addRetailer(address(retailer), "City Electronics");
        Assert.ok(wc.isRetailer(address(retailer)), "Retailer should be authorised");
        Assert.equal(wc.retailerCount(), uint256(1), "Retailer count should be 1");
    }

    function testRegisterProduct() public {
        bytes memory result = act(
            retailer,
            abi.encodeCall(WarrantyChain.registerProduct, ("SN-1001", "NovaBook Pro 14", address(customerA), 24))
        );
        Assert.equal(abi.decode(result, (uint256)), uint256(1), "First product ID should be 1");
        WarrantyChain.Product memory p = wc.getProduct(1);
        Assert.equal(p.currentOwner, address(customerA), "Owner should be customer A");
        Assert.equal(p.warrantyExpiry - p.purchaseDate, uint256(24 * 30 days), "Warranty should be 24 x 30 days");
    }

    function testVerifySerial() public {
        (bool registered, uint256 productId, bool underWarranty, address owner) = wc.verifySerial("SN-1001");
        Assert.ok(registered && underWarranty, "Serial should be registered and under warranty");
        Assert.equal(productId, uint256(1), "Product ID should be 1");
        Assert.equal(owner, address(customerA), "Owner should be customer A");

        (bool fakeRegistered, , , ) = wc.verifySerial("SN-FAKE");
        Assert.ok(!fakeRegistered, "Unknown serial should not be registered");
    }

    function testFileAndApproveClaim() public {
        act(customerA, abi.encodeCall(WarrantyChain.fileClaim, (1, "Screen flickers")));
        Assert.equal(wc.pendingClaimCount(), uint256(1), "One claim should be pending");

        wc.resolveClaim(1, true, "Display panel replaced");
        Assert.ok(wc.getClaim(1).status == WarrantyChain.ClaimStatus.Approved, "Claim should be approved");
        Assert.equal(wc.pendingClaimCount(), uint256(0), "No claims should be pending");
    }

    function testTransferWarranty() public {
        act(customerA, abi.encodeCall(WarrantyChain.transferWarranty, (1, address(customerB))));
        Assert.equal(wc.getProduct(1).currentOwner, address(customerB), "Owner should be customer B");
        Assert.equal(wc.getProductsByOwner(address(customerA)).length, uint256(0), "Customer A should own nothing");
        Assert.equal(wc.getProductsByOwner(address(customerB)).length, uint256(1), "Customer B should own 1 product");
    }
}

/// Invalid and unauthorised inputs. Fixture: product #1 sold to customer A,
/// claim #1 approved, then the warranty transferred to customer B.
contract WarrantyChainRejectTest is WarrantyChainTestBase {
    function beforeAll() public {
        deployFixture();
        wc.addRetailer(address(retailer), "City Electronics");
        act(retailer, abi.encodeCall(WarrantyChain.registerProduct, ("SN-1001", "NovaBook Pro 14", address(customerA), 24)));
        act(customerA, abi.encodeCall(WarrantyChain.fileClaim, (1, "Screen flickers")));
        wc.resolveClaim(1, true, "Display panel replaced");
        act(customerA, abi.encodeCall(WarrantyChain.transferWarranty, (1, address(customerB))));
    }

    // ---------------------------------------------------------------- invalid

    function testRejectDuplicateSerial() public {
        expectRevert(
            address(retailer),
            abi.encodeCall(WarrantyChain.registerProduct, ("SN-1001", "NovaBook", address(customerB), 12)),
            "Serial number already registered"
        );
    }

    function testRejectWarrantyAboveMax() public {
        expectRevert(
            address(retailer),
            abi.encodeCall(WarrantyChain.registerProduct, ("SN-1002", "NovaPad", address(customerA), 37)),
            "Warranty period out of allowed range"
        );
    }

    function testRejectEmptySerial() public {
        expectRevert(
            address(retailer),
            abi.encodeCall(WarrantyChain.registerProduct, ("", "NovaPad", address(customerA), 12)),
            "Serial number must be 1-64 characters"
        );
    }

    function testRejectZeroAddressRetailer() public {
        expectRevert(
            address(this),
            abi.encodeCall(WarrantyChain.addRetailer, (address(0), "Ghost")),
            "Invalid retailer address"
        );
    }

    function testRejectEmptyClaimIssue() public {
        expectRevert(
            address(customerB),
            abi.encodeCall(WarrantyChain.fileClaim, (1, "")),
            "Issue description must be 1-280 characters"
        );
    }

    function testRejectResolvingResolvedClaim() public {
        expectRevert(
            address(this),
            abi.encodeCall(WarrantyChain.resolveClaim, (1, false, "Changed mind")),
            "Claim already resolved"
        );
    }

    // ----------------------------------------------------------- unauthorised

    function testOutsiderCannotAddRetailer() public {
        expectRevert(
            address(outsider),
            abi.encodeCall(WarrantyChain.addRetailer, (address(outsider), "Fake Shop")),
            "Only the manufacturer can perform this action"
        );
    }

    function testCustomerCannotRegisterProduct() public {
        expectRevert(
            address(customerA),
            abi.encodeCall(WarrantyChain.registerProduct, ("SN-9999", "Fake", address(customerA), 12)),
            "Only an authorised retailer can perform this action"
        );
    }

    function testPreviousOwnerCannotClaim() public {
        expectRevert(
            address(customerA),
            abi.encodeCall(WarrantyChain.fileClaim, (1, "Broken again")),
            "Only the product owner can perform this action"
        );
    }

    function testCustomerCannotResolveClaim() public {
        act(customerB, abi.encodeCall(WarrantyChain.fileClaim, (1, "Water damage")));
        expectRevert(
            address(customerB),
            abi.encodeCall(WarrantyChain.resolveClaim, (2, true, "Approve my own claim")),
            "Only the manufacturer can perform this action"
        );
    }

    function testOutsiderCannotTransfer() public {
        expectRevert(
            address(outsider),
            abi.encodeCall(WarrantyChain.transferWarranty, (1, address(outsider))),
            "Only the product owner can perform this action"
        );
    }
}
