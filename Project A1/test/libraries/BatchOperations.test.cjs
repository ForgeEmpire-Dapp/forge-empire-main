const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BatchOperations Library", function () {
    let mockBatchOps;
    let owner, addr1, addr2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        const MockBatchOperations = await ethers.getContractFactory("MockBatchOperations");
        mockBatchOps = await MockBatchOperations.deploy();
        await mockBatchOps.waitForDeployment();
    });

    describe("validateArrays", function () {
        it("should not revert for valid arrays", async function () {
            await expect(mockBatchOps.testValidateArrays(10, 10, 20)).to.not.be.reverted;
        });

        it("should revert if first array is empty", async function () {
            await expect(mockBatchOps.testValidateArrays(0, 10, 20)).to.be.revertedWithCustomError(mockBatchOps, "EmptyArrays");
        });

        it("should revert if array lengths do not match", async function () {
            await expect(mockBatchOps.testValidateArrays(10, 11, 20)).to.be.revertedWithCustomError(mockBatchOps, "ArrayLengthMismatch");
        });

        it("should revert if length exceeds max size", async function () {
            await expect(mockBatchOps.testValidateArrays(21, 21, 20)).to.be.revertedWithCustomError(mockBatchOps, "BatchSizeExceeded");
        });
    });

    describe("validateArray", function () {
        it("should not revert for a valid array", async function () {
            await expect(mockBatchOps.testValidateArray(10, 20)).to.not.be.reverted;
        });

        it("should revert if array is empty", async function () {
            await expect(mockBatchOps.testValidateArray(0, 20)).to.be.revertedWithCustomError(mockBatchOps, "EmptyArrays");
        });

        it("should revert if length exceeds max size", async function () {
            await expect(mockBatchOps.testValidateArray(21, 20)).to.be.revertedWithCustomError(mockBatchOps, "BatchSizeExceeded");
        });
    });

    describe("validateAddressBatch", function () {
        it("should return true for a valid batch of addresses", async function () {
            const addresses = [addr1.address, addr2.address];
            expect(await mockBatchOps.testValidateAddressBatch(addresses)).to.be.true;
        });

        it("should return false if any address is the zero address", async function () {
            const addresses = [addr1.address, ethers.ZeroAddress, addr2.address];
            expect(await mockBatchOps.testValidateAddressBatch(addresses)).to.be.false;
        });

        it("should revert if the address array is empty", async function () {
            await expect(mockBatchOps.testValidateAddressBatch([])).to.be.revertedWithCustomError(mockBatchOps, "EmptyArrays");
        });
    });

    describe("validateAmountBatch", function () {
        it("should return true for a valid batch of amounts", async function () {
            const amounts = [100, 200, 300];
            expect(await mockBatchOps.testValidateAmountBatch(amounts, 50, 500)).to.be.true;
        });

        it("should return false if any amount is below the minimum", async function () {
            const amounts = [100, 49, 300];
            expect(await mockBatchOps.testValidateAmountBatch(amounts, 50, 500)).to.be.false;
        });

        it("should return false if any amount is above the maximum", async function () {
            const amounts = [100, 501, 300];
            expect(await mockBatchOps.testValidateAmountBatch(amounts, 50, 500)).to.be.false;
        });

        it("should revert if the amount array is empty", async function () {
            await expect(mockBatchOps.testValidateAmountBatch([], 50, 500)).to.be.revertedWithCustomError(mockBatchOps, "EmptyArrays");
        });
    });

    describe("calculateBatchSum", function () {
        it("should correctly calculate the sum of a batch of amounts", async function () {
            const amounts = [100, 200, 300];
            const [total, overflow] = await mockBatchOps.testCalculateBatchSum(amounts);
            expect(total).to.equal(600);
            expect(overflow).to.be.false;
        });

        it("should detect an overflow", async function () {
            const maxUint = ethers.MaxUint256;
            const amounts = [maxUint, 1];
            const [total, overflow] = await mockBatchOps.testCalculateBatchSum(amounts);
            expect(overflow).to.be.true;
        });
    });

    describe("hasDuplicateAddresses", function () {
        it("should return true if there are duplicate addresses", async function () {
            const addresses = [addr1.address, addr2.address, addr1.address];
            expect(await mockBatchOps.testHasDuplicateAddresses(addresses)).to.be.true;
        });

        it("should return false if there are no duplicate addresses", async function () {
            const addresses = [owner.address, addr1.address, addr2.address];
            expect(await mockBatchOps.testHasDuplicateAddresses(addresses)).to.be.false;
        });

        it("should return false for an empty or single-element array", async function () {
            expect(await mockBatchOps.testHasDuplicateAddresses([])).to.be.false;
            expect(await mockBatchOps.testHasDuplicateAddresses([addr1.address])).to.be.false;
        });
    });

    describe("packBatchUserData and unpackBatchUserData", function () {
        it("should correctly pack and unpack user data", async function () {
            const users = [owner.address];
            const values1 = [100];
            const values2 = [1000];
            const flags = [1];

            const packedData = await mockBatchOps.testPackBatchUserData(users, values1, values2, flags);
            console.log("packedData", packedData);
            const unpackedData = await mockBatchOps.testUnpackBatchUserData(packedData, { gasLimit: 30000000 });

            console.log("unpackedData", unpackedData);

            expect(unpackedData.length).to.equal(1);

            expect(unpackedData[0].user).to.equal(users[0]);
            expect(unpackedData[0].value1).to.equal(values1[0]);
            expect(unpackedData[0].value2).to.equal(values2[0]);
            expect(unpackedData[0].flags).to.equal(flags[0]);
        });

        it("should revert if arrays are empty", async function () {
            await expect(mockBatchOps.testPackBatchUserData([], [], [], [])).to.be.revertedWithCustomError(mockBatchOps, "EmptyArrays");
        });

        it("should revert if array lengths mismatch", async function () {
            await expect(mockBatchOps.testPackBatchUserData([owner.address], [100, 200], [1000], [1])).to.be.revertedWithCustomError(mockBatchOps, "ArrayLengthMismatch");
        });
    });

    describe("calculateOptimalBatchSize", function () {
        it("should return MAX_BATCH_SIZE if gasPerItem is zero", async function () {
            const MAX_BATCH_SIZE = 200; // Assuming this constant from the contract
            expect(await mockBatchOps.testCalculateOptimalBatchSize(1000, 0, 1000000)).to.equal(MAX_BATCH_SIZE);
        });

        it("should calculate optimal batch size based on gas limit", async function () {
            // totalItems, gasPerItem, gasLimit
            expect(await mockBatchOps.testCalculateOptimalBatchSize(1000, 1000, 100000)).to.equal(100);
        });

        it("should cap optimal batch size at MAX_BATCH_SIZE", async function () {
            const MAX_BATCH_SIZE = 200; // Assuming this constant from the contract
            expect(await mockBatchOps.testCalculateOptimalBatchSize(1000, 100, 1000000)).to.equal(MAX_BATCH_SIZE);
        });

        it("should cap optimal batch size at totalItems", async function () {
            expect(await mockBatchOps.testCalculateOptimalBatchSize(50, 1000, 100000)).to.equal(50);
        });

        it("should return 1 if optimalBatchSize calculates to zero", async function () {
            expect(await mockBatchOps.testCalculateOptimalBatchSize(1000, 1000000, 10)).to.equal(1);
        });
    });

    describe("calculateBatchProcessingParams", function () {
        it("should calculate correct processing parameters", async function () {
            const data = [1, 2, 3, 4, 5];
            const gasPerItem = 1000;
            const [totalItems, optimalBatchSize, estimatedGas] = await mockBatchOps.testCalculateBatchProcessingParams(data, gasPerItem);

            expect(totalItems).to.equal(data.length);
            // Optimal batch size will depend on the gasleft() at the time of call, so we can't assert a fixed value.
            // However, we can assert it's within reasonable bounds or test its calculation logic separately.
            expect(optimalBatchSize).to.be.at.most(200); // MAX_BATCH_SIZE
            expect(optimalBatchSize).to.be.at.least(1);
            expect(estimatedGas).to.equal(data.length * gasPerItem);
        });

        it("should revert if data array is empty", async function () {
            await expect(mockBatchOps.testCalculateBatchProcessingParams([], 1000)).to.be.revertedWithCustomError(mockBatchOps, "EmptyArrays");
        });
    });

    describe("validateBatchTransfers", function () {
        it("should correctly validate a batch of transfers", async function () {
            const transfers = [
                { to: addr1.address, amount: 100 },
                { to: addr2.address, amount: 200 },
            ];
            const result = await mockBatchOps.testValidateBatchTransfers(transfers);
            expect(result.successCount).to.equal(2);
            expect(result.failureCount).to.equal(0);
            expect(result.errors.length).to.equal(2);
        });

        it("should mark transfers with zero address as failures", async function () {
            const transfers = [
                { to: addr1.address, amount: 100 },
                { to: ethers.ZeroAddress, amount: 200 },
            ];
            const result = await mockBatchOps.testValidateBatchTransfers(transfers);
            expect(result.successCount).to.equal(1);
            expect(result.failureCount).to.equal(1);
        });

        it("should mark transfers with zero amount as failures", async function () {
            const transfers = [
                { to: addr1.address, amount: 100 },
                { to: addr2.address, amount: 0 },
            ];
            const result = await mockBatchOps.testValidateBatchTransfers(transfers);
            expect(result.successCount).to.equal(1);
            expect(result.failureCount).to.equal(1);
        });

        it("should revert if the transfers array is empty", async function () {
            await expect(mockBatchOps.testValidateBatchTransfers([])).to.be.revertedWithCustomError(mockBatchOps, "EmptyArrays");
        });

        it("should revert if the batch size exceeds MAX_BATCH_SIZE", async function () {
            const transfers = [];
            for (let i = 0; i < 201; i++) {
                transfers.push({ to: addr1.address, amount: 1 });
            }
            await expect(mockBatchOps.testValidateBatchTransfers(transfers)).to.be.revertedWithCustomError(mockBatchOps, "BatchSizeExceeded");
        });
    });
});
