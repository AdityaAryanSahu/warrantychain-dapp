// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Shared helpers for tests/WarrantyChain_test.sol.
// Kept in a separate file because Remix deploys every contract defined in a
// *_test.sol file without constructor arguments, and treats it as a test suite.

import "remix_tests.sol";
import "../../contracts/WarrantyChain.sol";

/// @dev Forwards raw calldata so WarrantyChain sees this contract as msg.sender
///      (used for the retailer, customer and outsider roles).
contract Actor {
    address private immutable target;

    constructor(address _target) {
        target = _target;
    }

    function exec(bytes calldata _data) external returns (bool success, bytes memory result) {
        return target.call(_data);
    }
}

/// @dev The deriving test contract is the deployer, i.e. the manufacturer.
abstract contract WarrantyChainTestBase {
    WarrantyChain internal wc;
    Actor internal retailer;
    Actor internal customerA;
    Actor internal customerB;
    Actor internal outsider;

    function deployFixture() internal {
        wc = new WarrantyChain("NovaTech Electronics", 36);
        retailer = new Actor(address(wc));
        customerA = new Actor(address(wc));
        customerB = new Actor(address(wc));
        outsider = new Actor(address(wc));
    }

    /// Executes `_data` as `_who` and returns the call's return data; fails the test on revert.
    function act(Actor _who, bytes memory _data) internal returns (bytes memory) {
        (bool success, bytes memory result) = _who.exec(_data);
        Assert.ok(success, reason(result));
        return result;
    }

    /// Asserts that `_data` executed as `_who` (address(this) = manufacturer) reverts with `_expected`.
    function expectRevert(address _who, bytes memory _data, string memory _expected) internal {
        bool success;
        bytes memory result;
        if (_who == address(this)) {
            (success, result) = address(wc).call(_data);
        } else {
            (success, result) = Actor(_who).exec(_data);
        }
        Assert.ok(!success, "Call should have reverted");
        Assert.equal(reason(result), _expected, "Unexpected revert reason");
    }

    /// Decodes an Error(string) revert payload.
    function reason(bytes memory _result) internal pure returns (string memory) {
        if (_result.length < 68) return "";
        bytes memory payload = new bytes(_result.length - 4);
        for (uint256 i = 4; i < _result.length; i++) payload[i - 4] = _result[i];
        return abi.decode(payload, (string));
    }
}
