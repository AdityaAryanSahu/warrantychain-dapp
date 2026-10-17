// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  WarrantyChain - Decentralised Product Warranty Registry
 * @notice A manufacturer authorises retailers. Retailers register every sold
 *         product (serial number + warranty period) against the buyer's wallet.
 *         Buyers can verify, transfer (on resale) and claim their warranty, and
 *         the manufacturer approves or rejects each claim. Every step is stored
 *         on-chain, so paper warranty cards can no longer be lost, forged or
 *         disputed.
 */
contract WarrantyChain {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum ClaimStatus { Pending, Approved, Rejected }

    struct Product {
        uint256 id;
        string serialNumber;
        string model;
        address currentOwner;
        address retailer;
        uint256 purchaseDate;
        uint256 warrantyExpiry;
        uint256 claimCount;
        bool hasPendingClaim;
    }

    struct Claim {
        uint256 id;
        uint256 productId;
        address claimant;
        string issue;
        ClaimStatus status;
        uint256 filedAt;
        uint256 resolvedAt;
        string resolutionNote;
    }

    // ---------------------------------------------------------------------
    // State variables
    // ---------------------------------------------------------------------

    uint256 public constant MONTH = 30 days;
    uint256 public constant MAX_TEXT_LENGTH = 280;
    uint256 public constant MAX_SERIAL_LENGTH = 64;

    address public immutable manufacturer;
    string public brandName;
    uint256 public immutable maxWarrantyMonths;

    uint256 public productCount;
    uint256 public claimCount;
    uint256 public retailerCount;
    uint256 public pendingClaimCount;

    mapping(address => bool) public isRetailer;
    mapping(address => string) public retailerName;

    mapping(uint256 => Product) private products;
    mapping(uint256 => Claim) private claims;
    mapping(bytes32 => uint256) private serialToProductId;
    mapping(uint256 => uint256[]) private productClaimIds;
    mapping(address => uint256[]) private ownerHistory;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event RetailerAdded(address indexed retailer, string name);
    event RetailerRemoved(address indexed retailer);
    event ProductRegistered(
        uint256 indexed productId,
        string serialNumber,
        address indexed owner,
        address indexed retailer,
        uint256 warrantyExpiry
    );
    event WarrantyTransferred(uint256 indexed productId, address indexed from, address indexed to);
    event ClaimFiled(uint256 indexed claimId, uint256 indexed productId, address indexed claimant);
    event ClaimResolved(uint256 indexed claimId, uint256 indexed productId, ClaimStatus status);

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyManufacturer() {
        require(msg.sender == manufacturer, "Only the manufacturer can perform this action");
        _;
    }

    modifier onlyRetailer() {
        require(isRetailer[msg.sender], "Only an authorised retailer can perform this action");
        _;
    }

    modifier productExists(uint256 _productId) {
        require(_productId > 0 && _productId <= productCount, "Product does not exist");
        _;
    }

    modifier onlyProductOwner(uint256 _productId) {
        require(products[_productId].currentOwner == msg.sender, "Only the product owner can perform this action");
        _;
    }

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /**
     * @param _brandName          Manufacturer / brand name shown in the DApp.
     * @param _maxWarrantyMonths  Upper limit for any warranty period (1 - 120).
     */
    constructor(string memory _brandName, uint256 _maxWarrantyMonths) {
        require(bytes(_brandName).length > 0, "Brand name cannot be empty");
        require(_maxWarrantyMonths > 0 && _maxWarrantyMonths <= 120, "Max warranty must be 1-120 months");

        manufacturer = msg.sender;
        brandName = _brandName;
        maxWarrantyMonths = _maxWarrantyMonths;
    }

    // ---------------------------------------------------------------------
    // Manufacturer functions
    // ---------------------------------------------------------------------

    function addRetailer(address _retailer, string calldata _name) external onlyManufacturer {
        require(_retailer != address(0), "Invalid retailer address");
        require(_retailer != manufacturer, "Manufacturer cannot be a retailer");
        require(!isRetailer[_retailer], "Retailer already authorised");
        require(bytes(_name).length > 0 && bytes(_name).length <= MAX_SERIAL_LENGTH, "Retailer name must be 1-64 characters");

        isRetailer[_retailer] = true;
        retailerName[_retailer] = _name;
        retailerCount++;

        emit RetailerAdded(_retailer, _name);
    }

    function removeRetailer(address _retailer) external onlyManufacturer {
        require(isRetailer[_retailer], "Address is not an authorised retailer");

        isRetailer[_retailer] = false;
        retailerCount--;

        emit RetailerRemoved(_retailer);
    }

    function resolveClaim(uint256 _claimId, bool _approve, string calldata _note) external onlyManufacturer {
        require(_claimId > 0 && _claimId <= claimCount, "Claim does not exist");
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.Pending, "Claim already resolved");
        require(bytes(_note).length > 0 && bytes(_note).length <= MAX_TEXT_LENGTH, "Resolution note must be 1-280 characters");

        claim.status = _approve ? ClaimStatus.Approved : ClaimStatus.Rejected;
        claim.resolvedAt = block.timestamp;
        claim.resolutionNote = _note;

        products[claim.productId].hasPendingClaim = false;
        pendingClaimCount--;

        emit ClaimResolved(_claimId, claim.productId, claim.status);
    }

    // ---------------------------------------------------------------------
    // Retailer functions
    // ---------------------------------------------------------------------

    function registerProduct(
        string calldata _serialNumber,
        string calldata _model,
        address _buyer,
        uint256 _warrantyMonths
    ) external onlyRetailer returns (uint256) {
        require(
            bytes(_serialNumber).length > 0 && bytes(_serialNumber).length <= MAX_SERIAL_LENGTH,
            "Serial number must be 1-64 characters"
        );
        require(bytes(_model).length > 0 && bytes(_model).length <= MAX_SERIAL_LENGTH, "Model must be 1-64 characters");
        require(_buyer != address(0), "Invalid buyer address");
        require(_buyer != msg.sender, "Retailer cannot register a product to itself");
        require(_warrantyMonths > 0 && _warrantyMonths <= maxWarrantyMonths, "Warranty period out of allowed range");

        bytes32 serialHash = keccak256(bytes(_serialNumber));
        require(serialToProductId[serialHash] == 0, "Serial number already registered");

        productCount++;
        uint256 newId = productCount;

        products[newId] = Product({
            id: newId,
            serialNumber: _serialNumber,
            model: _model,
            currentOwner: _buyer,
            retailer: msg.sender,
            purchaseDate: block.timestamp,
            warrantyExpiry: block.timestamp + (_warrantyMonths * MONTH),
            claimCount: 0,
            hasPendingClaim: false
        });
        serialToProductId[serialHash] = newId;
        ownerHistory[_buyer].push(newId);

        emit ProductRegistered(newId, _serialNumber, _buyer, msg.sender, products[newId].warrantyExpiry);
        return newId;
    }

    // ---------------------------------------------------------------------
    // Product owner (customer) functions
    // ---------------------------------------------------------------------

    function transferWarranty(uint256 _productId, address _newOwner)
        external
        productExists(_productId)
        onlyProductOwner(_productId)
    {
        Product storage product = products[_productId];
        require(_newOwner != address(0), "Invalid new owner address");
        require(_newOwner != msg.sender, "Cannot transfer to yourself");
        require(block.timestamp <= product.warrantyExpiry, "Warranty has expired");
        require(!product.hasPendingClaim, "Cannot transfer while a claim is pending");

        product.currentOwner = _newOwner;
        ownerHistory[_newOwner].push(_productId);

        emit WarrantyTransferred(_productId, msg.sender, _newOwner);
    }

    function fileClaim(uint256 _productId, string calldata _issue)
        external
        productExists(_productId)
        onlyProductOwner(_productId)
        returns (uint256)
    {
        Product storage product = products[_productId];
        require(block.timestamp <= product.warrantyExpiry, "Warranty has expired");
        require(!product.hasPendingClaim, "A claim is already pending for this product");
        require(bytes(_issue).length > 0 && bytes(_issue).length <= MAX_TEXT_LENGTH, "Issue description must be 1-280 characters");

        claimCount++;
        uint256 newId = claimCount;

        claims[newId] = Claim({
            id: newId,
            productId: _productId,
            claimant: msg.sender,
            issue: _issue,
            status: ClaimStatus.Pending,
            filedAt: block.timestamp,
            resolvedAt: 0,
            resolutionNote: ""
        });
        productClaimIds[_productId].push(newId);
        product.claimCount++;
        product.hasPendingClaim = true;
        pendingClaimCount++;

        emit ClaimFiled(newId, _productId, msg.sender);
        return newId;
    }

    // ---------------------------------------------------------------------
    // View functions (blockchain data retrieval)
    // ---------------------------------------------------------------------

    function getProduct(uint256 _productId) external view productExists(_productId) returns (Product memory) {
        return products[_productId];
    }

    function getClaim(uint256 _claimId) external view returns (Claim memory) {
        require(_claimId > 0 && _claimId <= claimCount, "Claim does not exist");
        return claims[_claimId];
    }

    function getProductClaims(uint256 _productId) external view productExists(_productId) returns (uint256[] memory) {
        return productClaimIds[_productId];
    }

    function isUnderWarranty(uint256 _productId) public view productExists(_productId) returns (bool) {
        return block.timestamp <= products[_productId].warrantyExpiry;
    }

    /// @notice Returns the IDs of the products currently owned by `_owner`.
    function getProductsByOwner(address _owner) external view returns (uint256[] memory) {
        uint256[] storage history = ownerHistory[_owner];
        uint256 count;
        for (uint256 i = 0; i < history.length; i++) {
            if (products[history[i]].currentOwner == _owner && !_seenBefore(history, i)) count++;
        }

        uint256[] memory owned = new uint256[](count);
        uint256 idx;
        for (uint256 i = 0; i < history.length; i++) {
            if (products[history[i]].currentOwner == _owner && !_seenBefore(history, i)) owned[idx++] = history[i];
        }
        return owned;
    }

    /// @notice Public authenticity check that anyone (e.g. a second-hand buyer) can run.
    function verifySerial(string calldata _serialNumber)
        external
        view
        returns (bool registered, uint256 productId, bool underWarranty, address owner)
    {
        productId = serialToProductId[keccak256(bytes(_serialNumber))];
        if (productId == 0) return (false, 0, false, address(0));
        Product storage product = products[productId];
        return (true, productId, block.timestamp <= product.warrantyExpiry, product.currentOwner);
    }

    function getStats()
        external
        view
        returns (uint256 totalProducts, uint256 totalClaims, uint256 pendingClaims, uint256 activeRetailers)
    {
        return (productCount, claimCount, pendingClaimCount, retailerCount);
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    /// @dev True if history[i] already appeared earlier (an owner may receive the same product back).
    function _seenBefore(uint256[] storage history, uint256 i) private view returns (bool) {
        for (uint256 j = 0; j < i; j++) {
            if (history[j] == history[i]) return true;
        }
        return false;
    }
}
