const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FlashloanArbitrage", function () {
    let FlashloanArbitrage, flashloanArbitrage, owner;

    beforeEach(async () => {
        FlashloanArbitrage = await ethers.getContractFactory("FlashloanArbitrage");
        [owner] = await ethers.getSigners();
        const AAVE_LENDING_POOL_ADDRESS_PROVIDER = "0xC911B590248d127aD18546B186cC6B324e99F02c"; // PoolAddressesProvider-Aave on Goerli
        flashloanArbitrage = await FlashloanArbitrage.deploy(AAVE_LENDING_POOL_ADDRESS_PROVIDER);
        await flashloanArbitrage.deployed();
        console.log("Flash loan contract deployed: ", flashloanArbitrage.address);
        console.log("owner", owner);
    });

    // describe("FlashloanArbitrage deployment", () => {
    //     it("Should set the right owner", async () => {
    //         expect(await flashloanArbitrage.owner()).to.equal(owner.address);
    //     });
    // });

    it("Should deploy and initiate a flashloan", async () => {
        const flashloanAmount = ethers.utils.parseUnits("1000", 6); // 10 USDT

        // Approve and deposit some USDT into the contract to cover fees (for testing purposes only)
        // You would need to add the USDT ABI and USDT address on the network you're using
        const USDT_ABI = [
            
        ];
        const USDT_ADDRESS = "0x2E8D98fd126a32362F2Bd8aA427E59a1ec63F780"; // Replace with the actual USDT address on the network you're using
        const usdtToken = new ethers.Contract(USDT_ADDRESS, USDT_ABI, owner);
        await usdtToken.approve(flashloanArbitrage.address, flashloanAmount.mul(2));
        await flashloanArbitrage.depositTokens(USDT_ADDRESS, flashloanAmount.mul(2));

        // Initiate the flashloan
        await flashloanArbitrage.fn_RequestFlashLoan("0x2E8D98fd126a32362F2Bd8aA427E59a1ec63F780", flashloanAmount);
    });
});
