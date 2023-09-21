const Web3 = require("web3");
const dotenv = require("dotenv");
const tokenABI = require("./abi/erc20.json");
const flashyABI = require("./abi/flashloan.json");
const uniswapv2ABI = require("./abi/uniswapV2Router.json");
const ethers = require("ethers");
const axios = require("axios");
dotenv.config();

const ETHER_UNITS = {
    noether: "0",
    wei: "1",
    kwei: "1000",
    Kwei: "1000",
    babbage: "1000",
    femtoether: "1000",
    mwei: "1000000",
    Mwei: "1000000",
    lovelace: "1000000",
    picoether: "1000000",
    gwei: "1000000000",
    Gwei: "1000000000",
    shannon: "1000000000",
    nanoether: "1000000000",
    nano: "1000000000",
    szabo: "1000000000000",
    microether: "1000000000000",
    micro: "1000000000000",
    finney: "1000000000000000",
    milliether: "1000000000000000",
    milli: "1000000000000000",
    ether: "1000000000000000000",
    kether: "1000000000000000000000",
    grand: "1000000000000000000000",
    mether: "1000000000000000000000000",
    gether: "1000000000000000000000000000",
    tether: "1000000000000000000000000000000",
};

const poolABIV3 = [
    `  function slot0() external view returns
        (uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked)`,
];

const factoryABIV3 = [
    `  function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)`,
];

const PRIV_KEY = process.env.KKEEYY;
const RPC_URL = process.env.GOERLI_RPC_URL;
const FLASH_LOAN_ARBITRAGE_ADDRESS = process.env.FLASHY_CONTRACT_ADDRESS;
const ERC20_TOKEN_ADDRESS = process.env.TOKEN_TO_LOAN; // USDC Smart Contract
const LOAN_AMOUNT = process.env.TEKEN_AMOUNT_TO_LOAN; // 100 USDC
const WETH_ADDRESS = process.env.WETH_ADDRESS; // WETH Smart Contract
const ROUTER_ADDRESS_V2 = process.env.UNISWAP_V2_ROUTER_ADDRESS; // Uniswap V2 Router Smart Contract
const FACTORY_ADDRESS_V3 = process.env.UNISWAP_V3_FACTORY_ADDRESS; // Uniswap V3 Factory Smart Contract
//now we use USDC token address on gerli network, and loan amount is 100 USDC

const web3 = new Web3(RPC_URL);
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const myAccount = web3.eth.accounts.privateKeyToAccount(PRIV_KEY);
const flashLoanArbitrageContract = new web3.eth.Contract(flashyABI, FLASH_LOAN_ARBITRAGE_ADDRESS);
const erc20TokenContract = new web3.eth.Contract(tokenABI, ERC20_TOKEN_ADDRESS);
const uniswapV2RouterContract = new web3.eth.Contract(uniswapv2ABI, ROUTER_ADDRESS_V2);
const uniswapV3FactoryContract = new ethers.Contract(FACTORY_ADDRESS_V3, factoryABIV3, provider);
let uniswapV3PoolContract;

const getCurrentGasPrices = async () => {
    try {
        //this URL is for Ethereum mainnet and Ethereum testnets
        let GAS_STATION = `https://api.debank.com/chain/gas_price_dict_v2?chain=eth`;
        var response = await axios.get(GAS_STATION);
        var prices = {
            low: Math.floor(response.data.data.slow.price),
            medium: Math.floor(response.data.data.normal.price),
            high: Math.floor(response.data.data.fast.price),
        };
        return prices;
    } catch (error) {
        //console.log(error);
        return {
            low: 25000000000,
            medium: 26000000000,
            high: 30000000000,
        };
    }
};

const getUniswapV2Price = async () => {
    let price = 0;
    try {
        // constructor(chainId: ChainId, address: string, decimals: number, symbol?: string, name?: string);
        const tokenDecimals = await erc20TokenContract.methods.decimals().call();
        //console.log("Token Decimals: ", tokenDecimals);
        const ethUnitName = Object.keys(ETHER_UNITS).find((key) => Math.pow(10, tokenDecimals).toString() == ETHER_UNITS[key]);
        //console.log("ETH Unit: ", ethUnitName);
        let unitAmount = web3.utils.toWei("1", ethUnitName.toString());
        //console.log("Unit Amount:", unitAmount);
        const amountsOut = await uniswapV2RouterContract.methods.getAmountsOut(unitAmount, [ERC20_TOKEN_ADDRESS, WETH_ADDRESS]).call();
        //console.log("Amounts Out: ", amountsOut);
        const ethAmountOnWei = amountsOut[1];
        const ethAmount = web3.utils.fromWei(ethAmountOnWei.toString(), "ether");
        //console.log("ETH Amount: ", ethAmount);
        price = Number(ethAmount.toString());
    } catch (error) {
        console.log(error);
    }
    return price;
};

const getUniswapV3Price = async () => {
    let tokenPrice = 0;
    try {
        const slot0 = await uniswapV3PoolContract.slot0();
        const sqrtPriceX96 = web3.utils.toBN(slot0?.sqrtPriceX96._hex.toString());

        var priceX96, Q192;
        if (sqrtPriceX96.gt(web3.utils.toBN("0xffffffffffffffffffffffff")) === true) {
            let shiftedSqrtPriceX96 = sqrtPriceX96.div(web3.utils.toBN('18446744073709551616'));  // 2^64 = 18446744073709551616
            priceX96 = shiftedSqrtPriceX96.mul(shiftedSqrtPriceX96);
            Q192 = web3.utils.toBN('18446744073709551616');
        }
        else {
            priceX96 = sqrtPriceX96.mul(sqrtPriceX96);
            Q192 = web3.utils.toBN("0x100000000000000000000000000000000000000000000000000000");
        }
        //console.log("priceX96 >>>> ", priceX96.toString());
        //console.log("Q192 >>>> ", Q192.toString());

        if (WETH_ADDRESS.toLowerCase() < ERC20_TOKEN_ADDRESS.toLowerCase())
            tokenPrice = Q192.div(priceX96);
        else
            tokenPrice = priceX96.div(Q192);
    } catch (error) {
        console.log(error, "this is the error for getPrice");
    }
    return 1 / Number(tokenPrice.toString());
};

const signAndSendTx = async (data, from, to) => {
    let currentGasPrice = await getCurrentGasPrices();
    var nonce = await web3.eth.getTransactionCount(myAccount.address, "pending");
    nonce = web3.utils.toHex(nonce);
    let encodedABI = data.encodeABI();
    let gasEst = await data.estimateGas({ from: myAccount.address });

    let tx = {
        from: from,
        to: to,
        gas: gasEst * 10,
        gasPrice: currentGasPrice.high,
        data: encodedABI,
        nonce,
    };
    console.log("tx ===> ", tx);
    let signedTx = await myAccount.signTransaction(tx);
    await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
    .on("transactionHash", function (hash) {
        console.log("ts hash = ", hash);
    })
    .on("receipt", function (receipt) {
        console.log("");
        console.log("---------------------- tx succeed ---------------------");
        console.log("");
    })
    .on("error", function (error, receipt) {
        console.log("");
        console.log("---------------------- tx failed ---------------------");
        console.error(" error : ", error);
    });
};

const processArbitrage = async (premiumAmountOnWeiToLoan, amountOnWeiToLoan) => {
    try {
        let myBalance = await erc20TokenContract.methods.balanceOf(myAccount.address).call();
        console.log("Wallet Balance: ", Number(myBalance));
        console.log("Premium Amount to Loan: ", premiumAmountOnWeiToLoan);

        const priceOnv2 = await getUniswapV2Price();
        console.log("Price(Uniswap V2): ", priceOnv2);
        
        const priceOnv3 = await getUniswapV3Price();
        console.log("Price(Uniswap V3): ", priceOnv3);
        
        let dex_path = 7;
        if (priceOnv2 > priceOnv3)
            dex_path = 0;
        else if (priceOnv2 < priceOnv3)
            dex_path = 1;
        
        if (Number(myBalance) >= premiumAmountOnWeiToLoan) {
            //deposit premium to platform
            //   let transferPremiums = tokenContract.methods.transfer(
            //     PLATFORM_ADDRESS,
            //     premiumAmountOnWeiToLoan
            //   );
            //   await signAndSendTx(
            //     transferPremiums,
            //     bossWallet.address,
            //     TOKEN_ADDRESS
            //   );
            //do flash loan
            console.log("Amount to Loan: ", amountOnWeiToLoan, ", Dex Path: ", dex_path);
            let doFlashy = flashLoanArbitrageContract.methods.fn_RequestFlashLoan(ERC20_TOKEN_ADDRESS, amountOnWeiToLoan, dex_path);
            await signAndSendTx(doFlashy, myAccount.address, FLASH_LOAN_ARBITRAGE_ADDRESS);
        }
        else {
            console.log("Token balance error.");
            const tokenSymbol = await erc20TokenContract.methods.symbol().call();
            console.log(`You should deposit about ${Number(LOAN_AMOUNT) * 0.01} ${tokenSymbol} to platform smart contract before run flash loan.`);
        }
    }
    catch (error) {
        console.log("ERROR:");
        console.log(error.message);
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const main = async () => {
    const poolAddr = await uniswapV3FactoryContract.getPool(WETH_ADDRESS, ERC20_TOKEN_ADDRESS, 3000);
    uniswapV3PoolContract = new ethers.Contract(poolAddr, poolABIV3, provider);

    const tokenDecimals = await erc20TokenContract.methods.decimals().call();
    const ethUnitName = Object.keys(ETHER_UNITS).find((key) => Math.pow(10, tokenDecimals).toString() == ETHER_UNITS[key]);
    let premiumAmountOnWeiToLoan = web3.utils.toWei((Number(LOAN_AMOUNT) * 0.01).toString(), ethUnitName.toString());
    let amountOnWeiToLoan = web3.utils.toWei(LOAN_AMOUNT.toString(), ethUnitName.toString());
    
    let transCount = 1;
    while (true) {
        await processArbitrage(Number(premiumAmountOnWeiToLoan), Number(amountOnWeiToLoan));
        await sleep(1000);
        transCount--;
        if (transCount == 0)
            break;
    }
};

/*const test = async () => {
    setInterval(async () => {
        let v2Price = await getUniswapV2Price();
        let v3Price = await getUniswapV3Price();
        console.log("===========================");
        console.log("Uniswap V2 Price: ", v2Price);
        console.log("Uniswap V3 Price: ", v3Price);
    }, 1000);
}
test();*/

/*const printAllLiquidityList = () => {
    const url = "https://api.pancakeswap.info/api/v2/pairs";

    fetch(url)
    .then(response => response.json())
    .then(data => {
        console.log(data);
        for (let pair of data.data) {
            console.log(pair.pairName);
            console.log(pair.token0);
            console.log(pair.token1);
            console.log(pair.reserve0);
            console.log(pair.reserve1);
            console.log(pair.totalSupply);
        }
    })
    .catch(error => console.error(error));
}*/

main();
