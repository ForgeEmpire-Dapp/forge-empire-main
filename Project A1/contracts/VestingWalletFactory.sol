// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./VestingWallet.sol"; // Assuming VestingWallet is in the same directory
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title VestingWalletFactory
 * @dev A factory contract for deploying VestingWallet instances.
 */
contract VestingWalletFactory is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant WALLET_CREATOR_ROLE = keccak256("WALLET_CREATOR_ROLE");
    event VestingWalletCreated(address indexed beneficiary, uint256 start, uint256 duration, address vestingWallet);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(WALLET_CREATOR_ROLE, msg.sender);
    }

    /**
     * @dev Deploys a new VestingWallet contract.
     * @param _beneficiary The address of the beneficiary of the vesting schedule.
     * @param _start The timestamp when the vesting schedule starts.
     * @param _duration The duration of the vesting schedule in seconds.
     * @return The address of the newly deployed VestingWallet.
     */
    function createVestingWallet(address _beneficiary, uint64 _start, uint64 _duration) external onlyRole(WALLET_CREATOR_ROLE) nonReentrant whenNotPaused returns (address) {
        ForgeVestingWallet vestingWallet = new ForgeVestingWallet(_beneficiary, _start, _duration);
        emit VestingWalletCreated(_beneficiary, _start, _duration, address(vestingWallet));
        return address(vestingWallet);
    }

    /**
     * @dev Pauses the contract.
     * Only accounts with the PAUSER_ROLE can call this.
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpauses the contract.
     * Only accounts with the PAUSER_ROLE can call this.
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
