// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BatchOperations} from "../libraries/BatchOperations.sol";

contract MockBatchOperations {
    function testValidateArrays(uint256 length1, uint256 length2, uint256 maxSize) external pure {
        BatchOperations.validateArrays(length1, length2, maxSize);
    }

    function testValidateArray(uint256 length, uint256 maxSize) external pure {
        BatchOperations.validateArray(length, maxSize);
    }

    function testValidateBatchTransfers(
        BatchOperations.BatchTransfer[] calldata transfers
    ) external view returns (BatchOperations.BatchResult memory) {
        return BatchOperations.validateBatchTransfers(transfers);
    }

    function testValidateAddressBatch(address[] calldata addresses) external pure returns (bool) {
        return BatchOperations.validateAddressBatch(addresses);
    }

    function testValidateAmountBatch(
        uint256[] calldata amounts,
        uint256 minAmount,
        uint256 maxAmount
    ) external pure returns (bool) {
        return BatchOperations.validateAmountBatch(amounts, minAmount, maxAmount);
    }

    function testCalculateBatchSum(uint256[] calldata amounts) external pure returns (uint256, bool) {
        return BatchOperations.calculateBatchSum(amounts);
    }

    function testHasDuplicateAddresses(address[] calldata addresses) external pure returns (bool) {
        return BatchOperations.hasDuplicateAddresses(addresses);
    }

    function testPackBatchUserData(
        address[] calldata users,
        uint256[] calldata values1,
        uint256[] calldata values2,
        uint32[] calldata flags
    ) external pure returns (bytes memory) {
        return BatchOperations.packBatchUserData(users, values1, values2, flags);
    }

    function testUnpackBatchUserData(bytes calldata packedData) external pure returns (BatchOperations.BatchUserData[] memory) {
        return BatchOperations.unpackBatchUserData(packedData);
    }

    function testCalculateOptimalBatchSize(
        uint256 totalItems,
        uint256 gasPerItem,
        uint256 gasLimit
    ) external pure returns (uint256) {
        return BatchOperations.calculateOptimalBatchSize(totalItems, gasPerItem, gasLimit);
    }

    function testCalculateBatchProcessingParams(
        uint256[] calldata data,
        uint256 gasPerItem
    ) external view returns (
        uint256 totalItems,
        uint256 optimalBatchSize,
        uint256 estimatedGas
    ) {
        return BatchOperations.calculateBatchProcessingParams(data, gasPerItem);
    }

    
}