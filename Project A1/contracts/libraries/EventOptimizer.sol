// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EventOptimizer
 * @dev Gas-optimized event emission library with compression and batching
 * @notice Provides efficient patterns for emitting events with reduced gas costs
 */
library EventOptimizer {
    
    // ============ COMPRESSED EVENT STRUCTURES ============
    
    // Pack multiple boolean flags into single uint256
    struct PackedFlags {
        uint256 data; // Can store up to 256 boolean flags
    }
    
    // Compressed user action event
    struct CompressedUserAction {
        address user;           // 20 bytes
        uint32 actionType;      // 4 bytes - enum compressed to uint32
        uint32 timestamp;       // 4 bytes - relative timestamp
        uint128 value1;         // 16 bytes - primary value
        uint64 value2;          // 8 bytes - secondary value
        // Total: 72 bytes vs 96+ bytes for individual fields
    }
    
    // Batch event data
    struct BatchEventData {
        uint256 batchId;
        uint256 timestamp;
        bytes packedData;
    }
    
    // ============ EVENTS ============
    
    // Standard events
    event UserAction(address indexed user, uint32 indexed actionType, uint128 value1, uint64 value2, uint32 timestamp);
    event BatchUserActions(uint256 indexed batchId, bytes packedData);
    event PackedEvent(uint256 indexed category, bytes data);
    
    // Compressed events for high-frequency actions
    event CompressedXPAward(uint256 packed); // Pack user(20) + amount(12) = 32 bytes total
    event CompressedTransfer(uint256 packed1, uint256 packed2); // from(20) + to(20) + amount(24) = 64 bytes
    
    // ============ CONSTANTS ============
    
    uint256 private constant BATCH_EVENT_LIMIT = 100;
    uint256 private constant MAX_PACKED_SIZE = 8192; // 8KB limit for packed data
    
    // ============ EVENT EMISSION FUNCTIONS ============
    
    /**
     * @dev Emit compressed XP award event
     * Packs user address and amount into single uint256
     */
    function emitCompressedXPAward(address user, uint256 amount) internal {
        // Ensure amount fits in 96 bits (12 bytes)
        require(amount <= type(uint96).max, "Amount too large for compression");
        
        uint256 packed;
        assembly {
            // Pack: user(160 bits) + amount(96 bits) = 256 bits total
            packed := or(shl(96, user), amount)
        }
        
        emit CompressedXPAward(packed);
    }
    
    /**
     * @dev Emit compressed transfer event
     */
    function emitCompressedTransfer(address from, address to, uint256 amount) internal {
        // Ensure amount fits in 64 bits (8 bytes) for this compression
        require(amount <= type(uint64).max, "Amount too large for compression");
        
        uint256 packed1;
        uint256 packed2;
        
        assembly {
            // Pack1: from(160 bits) + upper_to(96 bits) = 256 bits
            packed1 := or(shl(96, from), shr(64, to))
            // Pack2: lower_to(64 bits) + amount(64 bits) + padding(128 bits) = 256 bits
            packed2 := or(shl(192, and(to, 0xFFFFFFFFFFFFFFFF)), shl(128, amount))
        }
        
        emit CompressedTransfer(packed1, packed2);
    }
    
    /**
     * @dev Emit batch user actions with optimized packing
     */
    function emitBatchUserActions(
        address[] calldata users,
        uint32[] calldata actionTypes,
        uint128[] calldata values1,
        uint64[] calldata values2
    ) internal {
        require(users.length <= BATCH_EVENT_LIMIT, "Batch too large");
        require(
            users.length == actionTypes.length &&
            users.length == values1.length &&
            users.length == values2.length,
            "Array length mismatch"
        );
        
        uint256 batchId = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, users.length)));
        bytes memory packedData = _packUserActions(users, actionTypes, values1, values2);
        
        emit BatchUserActions(batchId, packedData);
    }
    
    /**
     * @dev Emit optimized single user action
     */
    function emitOptimizedUserAction(
        address user,
        uint32 actionType,
        uint128 value1,
        uint64 value2
    ) internal {
        uint32 compressedTimestamp = uint32(block.timestamp % type(uint32).max);
        emit UserAction(user, actionType, value1, value2, compressedTimestamp);
    }
    
    /**
     * @dev Emit packed event with category
     */
    function emitPackedEvent(uint256 category, bytes memory data) internal {
        require(data.length <= MAX_PACKED_SIZE, "Data too large");
        emit PackedEvent(category, data);
    }
    
    // ============ PACKING FUNCTIONS ============
    
    /**
     * @dev Pack user actions into compressed bytes
     */
    function _packUserActions(
        address[] calldata users,
        uint32[] calldata actionTypes,
        uint128[] calldata values1,
        uint64[] calldata values2
    ) internal pure returns (bytes memory packedData) {
        uint256 length = users.length;
        
        // Each entry: address(20) + actionType(4) + value1(16) + value2(8) = 48 bytes
        packedData = new bytes(length * 48);
        
        assembly {
            let dataPtr := add(packedData, 0x20) // Skip length prefix
            
            for { let i := 0 } lt(i, length) { i := add(i, 1) } {
                let offset := mul(i, 48)
                let entryPtr := add(dataPtr, offset)
                
                // Pack address (20 bytes)
                let user := calldataload(add(users.offset, mul(i, 0x20)))
                mstore(entryPtr, shl(96, user))
                
                // Pack actionType (4 bytes)
                let actionType := calldataload(add(actionTypes.offset, mul(i, 0x20)))
                mstore(add(entryPtr, 20), shl(224, actionType))
                
                // Pack value1 (16 bytes)
                let value1 := calldataload(add(values1.offset, mul(i, 0x20)))
                mstore(add(entryPtr, 24), shl(128, value1))
                
                // Pack value2 (8 bytes)
                let value2 := calldataload(add(values2.offset, mul(i, 0x20)))
                mstore(add(entryPtr, 40), shl(192, value2))
            }
        }
    }
    
    /**
     * @dev Pack boolean flags into single uint256
     */
    function packFlags(bool[256] memory flags) internal pure returns (uint256 packed) {
        assembly {
            let flagsPtr := add(flags, 0x20)
            
            for { let i := 0 } lt(i, 256) { i := add(i, 1) } {
                let flag := mload(add(flagsPtr, mul(i, 0x20)))
                if flag {
                    packed := or(packed, shl(i, 1))
                }
            }
        }
    }
    
    /**
     * @dev Unpack boolean flags from uint256
     */
    function unpackFlags(uint256 packed) internal pure returns (bool[256] memory flags) {
        assembly {
            let flagsPtr := add(flags, 0x20)
            
            for { let i := 0 } lt(i, 256) { i := add(i, 1) } {
                let flag := and(shr(i, packed), 1)
                mstore(add(flagsPtr, mul(i, 0x20)), flag)
            }
        }
    }
    
    // ============ UNPACKING FUNCTIONS ============
    
    /**
     * @dev Unpack compressed XP award event
     */
    function unpackXPAward(uint256 packed) internal pure returns (address user, uint256 amount) {
        assembly {
            user := shr(96, packed)
            amount := and(packed, sub(shl(96, 1), 1)) // Mask to get lower 96 bits
        }
    }
    
    /**
     * @dev Unpack compressed transfer event
     */
    function unpackTransfer(uint256 packed1, uint256 packed2) internal pure returns (
        address from,
        address to,
        uint256 amount
    ) {
        assembly {
            from := shr(96, packed1)
            
            // Reconstruct 'to' address from both packed values
            let toUpper := and(packed1, sub(shl(96, 1), 1)) // Lower 96 bits of packed1
            let toLower := shr(192, packed2) // Upper 64 bits of packed2
            to := or(shl(64, toUpper), toLower)
            
            // Extract amount
            amount := and(shr(128, packed2), sub(shl(64, 1), 1))
        }
    }
    
    /**
     * @dev Unpack batch user actions
     */
    function unpackUserActions(bytes calldata packedData) internal view returns (
        CompressedUserAction[] memory actions
    ) {
        uint256 length = packedData.length / 48;
        actions = new CompressedUserAction[](length);
        
        assembly {
            let dataPtr := add(packedData.offset, 0x00)
            let actionsPtr := add(actions, 0x20)
            
            for { let i := 0 } lt(i, length) { i := add(i, 1) } {
                let offset := mul(i, 48)
                let entryPtr := add(dataPtr, offset)
                let actionPtr := add(actionsPtr, mul(i, 0xa0)) // 160 bytes per struct
                
                // Unpack address
                let user := shr(96, calldataload(entryPtr))
                mstore(actionPtr, user)
                
                // Unpack actionType
                let actionType := shr(224, calldataload(add(entryPtr, 20)))
                mstore(add(actionPtr, 0x20), actionType)
                
                // Set timestamp (current block timestamp as fallback) 
                let currentTime := timestamp()
                mstore(add(actionPtr, 0x40), currentTime)
                
                // Unpack value1
                let value1 := shr(128, calldataload(add(entryPtr, 24)))
                mstore(add(actionPtr, 0x60), value1)
                
                // Unpack value2
                let value2 := shr(192, calldataload(add(entryPtr, 40)))
                mstore(add(actionPtr, 0x80), value2)
            }
        }
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    /**
     * @dev Calculate gas cost for different event emission strategies
     */
    function calculateEventGasCost(
        uint256 dataSize,
        uint256 topicCount,
        bool useCompression
    ) internal pure returns (uint256 gasCost) {
        // Base LOG operation costs
        uint256 baseCost = 375; // Base LOG cost
        uint256 topicCost = topicCount * 375; // Cost per topic
        uint256 dataCost = dataSize * 8; // Cost per byte of data
        
        gasCost = baseCost + topicCost + dataCost;
        
        // Apply compression savings
        if (useCompression) {
            gasCost = (gasCost * 70) / 100; // ~30% savings with compression
        }
    }
    
    /**
     * @dev Get optimal batch size for event emission
     */
    function getOptimalEventBatchSize(
        uint256 itemCount,
        uint256 gasPerItem,
        uint256 gasLimit
    ) internal pure returns (uint256 batchSize) {
        batchSize = gasLimit / gasPerItem;
        
        if (batchSize > BATCH_EVENT_LIMIT) {
            batchSize = BATCH_EVENT_LIMIT;
        }
        
        if (batchSize > itemCount) {
            batchSize = itemCount;
        }
        
        if (batchSize == 0) {
            batchSize = 1;
        }
    }
    
    /**
     * @dev Emit events in optimal batches
     */
    function emitInBatches(
        address[] calldata addresses,
        uint256[] calldata values,
        bytes32 eventSignature,
        uint256 gasPerEvent
    ) internal {
        uint256 totalItems = addresses.length;
        uint256 batchSize = getOptimalEventBatchSize(totalItems, gasPerEvent, gasleft() * 80 / 100);
        
        for (uint256 start = 0; start < totalItems; start += batchSize) {
            uint256 end = start + batchSize;
            if (end > totalItems) end = totalItems;
            
            // Check gas availability
            if (gasleft() < gasPerEvent * (end - start) + 21000) break;
            
            // Emit batch
            assembly {
                let addressesPtr := add(addresses.offset, mul(start, 0x20))
                let valuesPtr := add(values.offset, mul(start, 0x20))
                let batchLength := sub(end, start)
                
                log3(
                    addressesPtr,
                    mul(batchLength, 0x40),
                    eventSignature,
                    start,
                    batchLength
                )
            }
        }
    }
    
    /**
     * @dev Create event signature hash
     */
    function createEventSignature(string memory eventString) internal pure returns (bytes32) {
        return keccak256(bytes(eventString));
    }
    
    /**
     * @dev Validate event data size
     */
    function validateEventData(bytes memory data) internal pure returns (bool) {
        return data.length <= MAX_PACKED_SIZE;
    }
}