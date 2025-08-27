// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract MockForgeTokenCore is ERC20, ERC20Burnable, Pausable {
    mapping(address => bool) private _excludedFromFees;
    mapping(string => address) public managers;
    bool public tradingEnabled;

    constructor() ERC20("Mock Forge Token", "MFORGE") {
        _mint(msg.sender, 1000000 * (10 ** decimals()));
        tradingEnabled = true;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function burn(uint256 amount) public override {
        _burn(msg.sender, amount);
    }

    function isExcludedFromFees(address account) external view returns (bool) {
        return _excludedFromFees[account];
    }

    function setExcludedFromFees(address account, bool isExcluded) public {
        _excludedFromFees[account] = isExcluded;
    }

    // Required interface methods for ForgeTokenManager
    function setManager(string calldata managerType, address manager) external {
        managers[managerType] = manager;
    }

    function setTradingEnabled(bool enabled) external {
        tradingEnabled = enabled;
    }

    function pause() external {
        _pause();
    }

    function unpause() external {
        _unpause();
    }

    // Additional required interface method for ForgeUtilityManager
    function setAddressFlags(address account, uint8 flags) external {
        // Mock implementation - could store flags in mapping if needed for testing
        // For now, just a no-op implementation
    }
}