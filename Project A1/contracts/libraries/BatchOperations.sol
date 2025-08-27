// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BatchOperations
 * @dev Gas-optimized library for batch operations across the ecosystem
 * @notice Provides efficient batch processing with assembly optimizations
 */
library BatchOperations {
    
    // ============ ERRORS ============
    error EmptyArrays();
    error ArrayLengthMismatch();
    error BatchSizeExceeded(uint256 maxAllowed, uint256 current);
    error InvalidBatchOperation();
    
    // ============ CONSTANTS ============
    uint256 internal constant MAX_BATCH_SIZE = 200;
    uint256 internal constant BATCH_GAS_LIMIT = 8_000_000; // 8M gas
    
    // ============ STRUCTS ============
    
    struct BatchTransfer {
        address to;
        uint256 amount;
    }
    
    struct BatchUserData {
        address user;
        uint256 value1;
        uint256 value2;
        uint32 flags;
    }
    
    struct BatchResult {
        uint256 successCount;
        uint256 failureCount;
        uint256 totalGasUsed;
        bytes[] errors;
    }
    
    // ============ VALIDATION FUNCTIONS ============
    
    /**
     * @dev Validate arrays have same length and within limits
     */
    function validateArrays(uint256 length1, uint256 length2, uint256 maxSize) internal pure {
        if (length1 == 0) revert EmptyArrays();
        if (length1 != length2) revert ArrayLengthMismatch();
        if (length1 > maxSize) revert BatchSizeExceeded(maxSize, length1);
    }
    
    /**
     * @dev Validate single array within limits
     */
    function validateArray(uint256 length, uint256 maxSize) internal pure {
        if (length == 0) revert EmptyArrays();
        if (length > maxSize) revert BatchSizeExceeded(maxSize, length);
    }
    
    // ============ BATCH PROCESSING FUNCTIONS ============
    
    /**
     * @dev Validate batch transfers with gas optimization
     * Note: Actual transfer execution should be done in calling contract
     */
    function validateBatchTransfers(
        BatchTransfer[] calldata transfers
    ) internal view returns (BatchResult memory result) {
        uint256 length = transfers.length;
        validateArray(length, MAX_BATCH_SIZE);
        
        result.errors = new bytes[](length);
        uint256 gasStart = gasleft();
        
        // Assembly optimized loop
        assembly {
            let transfersPtr := add(transfers.offset, 0x00)
            let successCount := 0
            let failureCount := 0
            
            for { let i := 0 } lt(i, length) { i := add(i, 1) } {
                // Check gas limit
                if lt(gas(), 50000) { break }
                
                let transferPtr := add(transfersPtr, mul(i, 0x40)) // 64 bytes per BatchTransfer
                let to := calldataload(transferPtr)
                let amount := calldataload(add(transferPtr, 0x20))
                
                // Basic validation in assembly
                if iszero(to) {
                    failureCount := add(failureCount, 1)
                    continue
                }
                
                if iszero(amount) {
                    failureCount := add(failureCount, 1)
                    continue
                }
                
                successCount := add(successCount, 1)
            }
            
            mstore(add(result, 0x00), successCount)
            mstore(add(result, 0x20), failureCount)
        }
        
        // Execute transfers outside assembly for safety
        for (uint256 i = 0; i < length && gasleft() > 50000;) {
            // Note: transferFunc cannot be called directly in library context
            // This would need to be implemented in the calling contract
            // For now, we'll track the validation results from assembly
            unchecked { ++i; }
        }
        
        result.totalGasUsed = gasStart - gasleft();
    }
    
    /**
     * @dev Optimized batch address validation
     */
    function validateAddressBatch(address[] calldata addresses) internal pure returns (bool allValid) {
        uint256 length = addresses.length;
        validateArray(length, MAX_BATCH_SIZE);
        
        assembly {
            let addressesPtr := add(addresses.offset, 0x00)
            allValid := 1
            
            for { let i := 0 } lt(i, length) { i := add(i, 1) } {
                let addr := calldataload(add(addressesPtr, mul(i, 0x20)))
                if iszero(addr) {
                    allValid := 0
                    break
                }
            }
        }
    }
    
    /**
     * @dev Optimized batch amount validation
     */
    function validateAmountBatch(
        uint256[] calldata amounts,
        uint256 minAmount,
        uint256 maxAmount
    ) internal pure returns (bool allValid) {
        uint256 length = amounts.length;
        validateArray(length, MAX_BATCH_SIZE);
        
        assembly {
            let amountsPtr := add(amounts.offset, 0x00)
            allValid := 1
            
            for { let i := 0 } lt(i, length) { i := add(i, 1) } {
                let amount := calldataload(add(amountsPtr, mul(i, 0x20)))
                
                if or(lt(amount, minAmount), gt(amount, maxAmount)) {
                    allValid := 0
                    break
                }
            }
        }
    }
    
    /**
     * @dev Batch sum calculation with overflow protection
     */
    function calculateBatchSum(uint256[] calldata amounts) internal pure returns (uint256 total, bool overflow) {
        uint256 length = amounts.length;
        validateArray(length, MAX_BATCH_SIZE);
        
        assembly {
            let amountsPtr := add(amounts.offset, 0x00)
            total := 0
            overflow := 0
            
            for { let i := 0 } lt(i, length) { i := add(i, 1) } {
                let amount := calldataload(add(amountsPtr, mul(i, 0x20)))
                let newTotal := add(total, amount)
                
                // Check overflow
                if lt(newTotal, total) {
                    overflow := 1
                    break
                }
                
                total := newTotal
            }
        }
    }
    
    /**
     * @dev Efficient batch duplicate detection for small arrays
     */
    function hasDuplicateAddresses(address[] calldata addresses) internal pure returns (bool) {
        uint256 length = addresses.length;
        if (length <= 1) return false;
        
        // For small to medium batches, use O(n²) comparison
        // This is acceptable for reasonable batch sizes
        for (uint256 i = 0; i < length - 1;) {
            for (uint256 j = i + 1; j < length;) {
                if (addresses[i] == addresses[j]) return true;
                unchecked { ++j; }
            }
            unchecked { ++i; }
        }
        
        return false;
    }
    
    /**
     * @dev Gas-efficient batch data packing
     */
                        function packBatchUserData(
        address[] calldata users,
        uint256[] calldata values1,
        uint256[] calldata values2,
        uint32[] calldata flags
    ) internal pure returns (bytes memory packedData) {
        uint256 length = users.length;
        validateArrays(length, values1.length, MAX_BATCH_SIZE);
        validateArrays(length, values2.length, MAX_BATCH_SIZE);
        validateArrays(length, flags.length, MAX_BATCH_SIZE);

        packedData = new bytes(length * 128);
        uint256 offset = 0;
        for (uint256 i = 0; i < length; i++) {
            bytes memory encoded = abi.encode(users[i], values1[i], values2[i], flags[i]);
            for (uint256 j = 0; j < 128; j++) {
                packedData[offset + j] = encoded[j];
            }
            offset += 128;
        }
    }

    /**
     * @dev Unpack batch user data
     */
    function unpackBatchUserData(bytes calldata packedData) internal pure returns (BatchUserData[] memory userData) {
        uint256 length = packedData.length / 128;
        userData = new BatchUserData[](length);
        
        for (uint256 i = 0; i < length; i++) {
            (address user, uint256 value1, uint256 value2, uint32 flags) = abi.decode(
                packedData[i*128:(i+1)*128],
                (address, uint256, uint256, uint32)
            );
            userData[i] = BatchUserData(user, value1, value2, flags);
        }
    }
    
    /**
     * @dev Optimized batch event emission
     */
    function emitBatchEvent(
        bytes32 eventSignature,
        address[] calldata addresses,
        uint256[] calldata values
    ) internal {
        uint256 length = addresses.length;
        validateArrays(length, values.length, MAX_BATCH_SIZE);
        
        // Emit events in batches to avoid gas limit issues
        uint256 batchSize = 50; // Smaller batches for event emission
        
        for (uint256 start = 0; start < length; start += batchSize) {
            uint256 end = start + batchSize;
            if (end > length) end = length;
            
            assembly {
                let addressesPtr := add(addresses.offset, mul(start, 0x20))
                let valuesPtr := add(values.offset, mul(start, 0x20))
                let batchLength := sub(end, start)
                
                // Emit batch event with packed data
                log3(
                    addressesPtr,
                    mul(batchLength, 0x40), // 32 bytes per address + 32 bytes per value
                    eventSignature,
                    start, // Batch start index
                    batchLength // Batch size
                )
            }
        }
    }
    
    /**
     * @dev Calculate optimal batch size based on gas limit
     */
    function calculateOptimalBatchSize(
        uint256 totalItems,
        uint256 gasPerItem,
        uint256 gasLimit
    ) internal pure returns (uint256 optimalBatchSize) {
        if (gasPerItem == 0) return MAX_BATCH_SIZE;
        
        optimalBatchSize = gasLimit / gasPerItem;
        
        if (optimalBatchSize > MAX_BATCH_SIZE) {
            optimalBatchSize = MAX_BATCH_SIZE;
        }
        
        if (optimalBatchSize > totalItems) {
            optimalBatchSize = totalItems;
        }
        
        if (optimalBatchSize == 0) {
            optimalBatchSize = 1;
        }
    }
    
    /**
     * @dev Calculate optimal batch processing parameters
     * Note: Actual processing should be implemented in calling contract
     */
    function calculateBatchProcessingParams(
        uint256[] calldata data,
        uint256 gasPerItem
    ) internal view returns (
        uint256 totalItems,
        uint256 optimalBatchSize,
        uint256 estimatedGas
    ) {
        totalItems = data.length;
        if (totalItems == 0) revert EmptyArrays();
        optimalBatchSize = calculateOptimalBatchSize(totalItems, gasPerItem, gasleft() * 80 / 100);
        estimatedGas = totalItems * gasPerItem;
    }
}