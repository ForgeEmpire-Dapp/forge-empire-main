// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ForgeTokenCore
 * @dev Core ERC20 functionality for the Forge Token - optimized for size
 * @notice Basic token operations without advanced features
 * @author Avax Forge Empire Team
 */
contract ForgeTokenCore is 
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ERC20PausableUpgradeable,
    ERC20PermitUpgradeable,
    ERC20VotesUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    
    // Token Configuration
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**18; // 100 million initial
    uint256 public constant MAX_DAILY_MINT = 10_000_000 * 10**18; // 10M tokens per day
    
    // External managers
    address public feeManager;
    address public utilityManager;
    
    // Daily minting limits
    mapping(uint256 => uint256) public dailyMintAmount;
    
    // Basic flags (packed for gas efficiency)
    mapping(address => uint8) public addressFlags; // 0=excludedFromFees, 1=excludedFromLimits, 2=blacklisted
    
    // Trading control
    bool public tradingEnabled;
    uint256 public launchTime;
    
    // Events
    event TradingEnabled(uint256 timestamp);
    event ManagerUpdated(string indexed managerType, address indexed oldManager, address indexed newManager);
    event FlagsUpdated(address indexed account, uint8 flags);
    
    // Custom Errors
    error ExceedsMaxSupply();
    error AccountBlacklisted();
    error TradingNotEnabled();
    error InvalidManager();
    error DailyMintLimitExceeded();
    error UnauthorizedManager();
    
    /**
     * @notice Initializes the FORGE token core
     */
    function initialize() public initializer {
        __ERC20_init("Forge Token", "FORGE");
        __ERC20Burnable_init();
        __ERC20Pausable_init();
        __ERC20Permit_init("Forge Token");
        __ERC20Votes_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(FEE_MANAGER_ROLE, msg.sender);
        
        // Exclude deployer from fees and limits
        addressFlags[msg.sender] = 3; // Both flags set
        addressFlags[address(this)] = 3;
        
        // Mint initial supply to deployer
        _mint(msg.sender, INITIAL_SUPPLY);
        
        launchTime = block.timestamp;
        tradingEnabled = false;
    }
    
    /**
     * @notice Mint new tokens with daily limit (only MINTER_ROLE)
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        
        uint256 today = block.timestamp / 86400;
        if (dailyMintAmount[today] + amount > MAX_DAILY_MINT) revert DailyMintLimitExceeded();
        
        dailyMintAmount[today] += amount;
        _mint(to, amount);
    }
    
    /**
     * @notice Burn tokens from a specific address (only BURNER_ROLE)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burnFrom(address from, uint256 amount) public override onlyRole(BURNER_ROLE) {
        super.burnFrom(from, amount);
    }
    
    /**
     * @notice Enable/disable trading (only admin)
     * @param enabled Whether trading should be enabled
     */
    function setTradingEnabled(bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tradingEnabled = enabled;
        if (enabled) {
            emit TradingEnabled(block.timestamp);
        }
    }
    
    /**
     * @notice Set manager contracts (only admin)
     * @param managerType Type of manager ("fee" or "utility")
     * @param manager Manager contract address
     */
    function setManager(string calldata managerType, address manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 typeHash = keccak256(bytes(managerType));
        address oldManager;
        
        if (typeHash == keccak256("fee")) {
            oldManager = feeManager;
            feeManager = manager;
            _grantRole(FEE_MANAGER_ROLE, manager);
        } else if (typeHash == keccak256("utility")) {
            oldManager = utilityManager;
            utilityManager = manager;
        } else {
            revert InvalidManager();
        }
        
        emit ManagerUpdated(managerType, oldManager, manager);
    }
    
    /**
     * @notice Update address flags (only admin or managers)
     * @param account Account to update
     * @param flags New flags value
     */
    function setAddressFlags(address account, uint8 flags) external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && 
            msg.sender != feeManager && 
            msg.sender != utilityManager) {
            revert UnauthorizedManager();
        }
        
        addressFlags[account] = flags;
        emit FlagsUpdated(account, flags);
    }
    
    /**
     * @notice Check if address is excluded from fees
     * @param account Address to check
     * @return true if excluded from fees
     */
    function isExcludedFromFees(address account) public view returns (bool) {
        return (addressFlags[account] & 1) != 0;
    }
    
    /**
     * @notice Check if address is excluded from limits
     * @param account Address to check
     * @return true if excluded from limits
     */
    function isExcludedFromLimits(address account) public view returns (bool) {
        return (addressFlags[account] & 2) != 0;
    }
    
    /**
     * @notice Check if address is blacklisted
     * @param account Address to check
     * @return true if blacklisted
     */
    function isBlacklisted(address account) public view returns (bool) {
        return (addressFlags[account] & 4) != 0;
    }
    
    /**
     * @notice Override nonces function to resolve conflict between ERC20PermitUpgradeable and NoncesUpgradeable
     */
    function nonces(address owner) public view virtual override(ERC20PermitUpgradeable, NoncesUpgradeable) returns (uint256) {
        return super.nonces(owner);
    }

    /**
     * @notice Override transfer with basic validation
     */
    function _update(address from, address to, uint256 value) internal override(
        ERC20Upgradeable,
        ERC20PausableUpgradeable,
        ERC20VotesUpgradeable
    ) {
        // Basic validations
        if (from != address(0) && to != address(0)) {
            // Check blacklist
            if (isBlacklisted(from) || isBlacklisted(to)) revert AccountBlacklisted();
            
            // Check trading enabled (unless excluded)
            if (!tradingEnabled && !isExcludedFromFees(from) && !isExcludedFromFees(to)) {
                revert TradingNotEnabled();
            }
        }
        
        // Handle fees through fee manager if set
        uint256 transferAmount = value;
        if (from != address(0) && to != address(0) && feeManager != address(0)) {
            // Call fee manager to handle fees
            try IFeeManager(feeManager).processFees(from, to, value) returns (uint256 netAmount) {
                transferAmount = netAmount;
            } catch {
                // Fallback to no fees if manager fails
                transferAmount = value;
            }
        }
        
        super._update(from, to, transferAmount);
    }
    
    /**
     * @notice Get daily mint amount for a specific day
     * @param day Day (days since epoch)
     * @return amount minted on that day
     */
    function getDailyMintAmount(uint256 day) external view returns (uint256) {
        return dailyMintAmount[day];
    }
    
    /**
     * @notice Get current day (days since epoch)
     * @return current day number
     */
    function getCurrentDay() external view returns (uint256) {
        return block.timestamp / 86400;
    }
    
    /**
     * @notice Pause transfers (only PAUSER_ROLE)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause transfers (only PAUSER_ROLE)
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Get manager addresses
     * @return feeManagerAddr Address of fee manager
     * @return utilityManagerAddr Address of utility manager
     */
    function getManagers() external view returns (address feeManagerAddr, address utilityManagerAddr) {
        return (feeManager, utilityManager);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

/**
 * @dev Interface for fee manager contract
 */
interface IFeeManager {
    function processFees(address from, address to, uint256 amount) external returns (uint256 netAmount);
}