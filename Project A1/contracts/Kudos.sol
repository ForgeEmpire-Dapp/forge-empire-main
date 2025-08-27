// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Kudos
 * @dev A simple contract to allow users to give "kudos" to each other.
 */
contract Kudos is AccessControl {
    /**
     * @dev Emitted when a user gives kudos to another user.
     * @param from The address of the user who gave the kudos.
     * @param to The address of the user who received the kudos.
     */
    event KudosSent(address indexed from, address indexed to);

    /**
     * @dev A mapping from user addresses to the number of kudos they have received.
     */
    mapping(address => uint256) public kudosReceived;

    /**
     * @dev Thrown when a user tries to send kudos to themselves.
     */
    error CannotSendKudosToSelf();

    /**
     * @dev Sends kudos from the caller to the specified address.
     * @param to The address of the user to send kudos to.
     */
    function sendKudos(address to) external {
        if (to == msg.sender) {
            revert CannotSendKudosToSelf();
        }

        kudosReceived[to]++;
        emit KudosSent(msg.sender, to);
    }

    /**
     * @dev Returns the number of kudos a user has received.
     * @param user The address of the user to query.
     * @return The number of kudos the user has received.
     */
    function getKudos(address user) external view returns (uint256) {
        return kudosReceived[user];
    }
}
