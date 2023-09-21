const http = require("http");
const Web3 = require("web3");
const dotenv = require("dotenv");
const erc20ABI = require("./abi/erc20.json");
const config = require("./config.json");
const pancakeRouterABI = require("./abi/pancakeswapRouter.json");
const pancakeFactoryABI = require("./abi/pancakeswapFactory.json");
const pancakePairABI = require("./abi/pancakeswapPair.json");
const sushiRouterABI = require("./abi/uniswapV2Router.json");
const sushiFactoryABI = require("./abi/sushiswapV2Factory.json");
const sushiPairABI = require("./abi/uniswapV2Pair.json");
const arbitrageABI = require("./abi/arbitrage.json");

dotenv.config();

const host = 'localhost';
const port = 8080;

const requestListener = function(req, res) {
    res.writeHead(200);
    res.end("Hello World from Node.js HTTP Server");
}

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
})

const activeConfig = config["bsc_testnet"];
const web3 = new Web3(activeConfig.RPC_URL);
const myAccount = web3.eth.accounts.privateKeyToAccount(process.env.KKEEYY2);

const pancakeRouterContract = new web3.eth.Contract(pancakeRouterABI, activeConfig.PANCAKE_ROUTER_ADDRESS);
let pancakeFactoryContract, pancakePairContract;

const sushiRouterContract = new web3.eth.Contract(sushiRouterABI, activeConfig.SUSHI_ROUTER_ADDRESS);
let sushiFactoryContract, sushiPairContract;

const arbitrageContract = activeConfig.ARBITRAGE_ADDRESS ? new web3.eth.Contract(arbitrageABI, activeConfig.ARBITRAGE_ADDRESS) : null;
const token0Contract = new web3.eth.Contract(erc20ABI, activeConfig.TOKEN0);

let priceEth = 0;

const getCurrentGasPrices = async () => {
    try {
        //this URL is for Ethereum mainnet and Ethereum testnets
        let GAS_STATION = `https://api.debank.com/chain/gas_price_dict_v2?chain=bsc`;
        var response = await axios.get(GAS_STATION);
        var prices = {
            low: Math.floor(response.data.data.slow.price),
            medium: Math.floor(response.data.data.normal.price),
            high: Math.floor(response.data.data.fast.price),
        };
        return prices;
    } catch (error) {
        //console.log(error);
        const price = await web3.eth.getGasPrice();
        return {
            low: price,
            medium: price,
            high: price
        }
    }    
}

const signAndSendTransaction = async (data, from, to, gas, gasPrice) => {
    var nonce = await web3.eth.getTransactionCount(from, "pending");
    nonce = web3.utils.toHex(nonce);
    let encodedABI = data.encodeABI();

    let tx = {
        from: from,
        to: to,
        gas: gas,
        gasPrice: gasPrice,
        data: encodedABI,
        nonce,
    };
    console.log("tx ===> ", tx);
    let signedTx = await myAccount.signTransaction(tx);
    await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
    .on("transactionHash", (hash) => {
        console.log("ts hash = ", hash);
    })
    .on("receipt", async (receipt) => {
        console.log("");
        console.log("---------------------- tx succeed ---------------------");
        let balance = await token0Contract.methods.balanceOf(arbitrageContract.options.address).call();
        balance = Number(web3.utils.fromWei(balance.toString(), "ether"));
        console.log("Post-Balance:", balance);
    })
    .on("error", (error, receipt) => {
        console.log("");
        console.log("---------------------- tx failed ---------------------");
        console.error(" error : ", error);
    });
};

const printPairs = async (pancakeswap, count) => {
    let factoryContract;
    let pairABI;
    if (pancakeswap) {
        factoryContract = pancakeFactoryContract;
        pairABI = pancakePairABI;
    }
    else {
        factoryContract = sushiFactoryContract;
        pairABI = sushiPairABI;
    }

    let allPairsLength = await factoryContract.methods.allPairsLength().call();
    console.log(`Detected ${allPairsLength} pairs in ${pancakeswap ? "Pancakeswap" : "Sushiswap"}`);

    if (count > 0 && allPairsLength > count)
        allPairsLength = count;

    console.log(`${allPairsLength} Pairs in ${pancakeswap ? "Pancakeswap" : "Sushiswap"}`);
    for (let i = 0; i < allPairsLength; i++) {
        const pairAddr = await factoryContract.methods.allPairs(i).call();
        const pairContract = await new web3.eth.Contract(pairABI, pairAddr);

        const token0Addr = await pairContract.methods.token0().call();
        const token0Contract = await new web3.eth.Contract(erc20ABI, token0Addr);
        const token0Name = await token0Contract.methods.name().call();
        const token0Symbol = await token0Contract.methods.symbol().call();

        const token1Addr = await pairContract.methods.token1().call();
        const token1Contract = await new web3.eth.Contract(erc20ABI, token1Addr);
        const token1Name = await token1Contract.methods.name().call();
        const token1Symbol = await token1Contract.methods.symbol().call();

        console.log(`Pair ${i}: <${token0Addr}(${token0Name}, ${token0Symbol}) - ${token1Addr}(${token1Name}, ${token1Symbol})>`);
    }
}

const init = async (token0, token1) => {
    console.log("init -- Starting...");

    /* Initialize Pancakeswap Factory */
    const pancakeFactoryAddr = await pancakeRouterContract.methods.factory().call();
    pancakeFactoryContract = new web3.eth.Contract(pancakeFactoryABI, pancakeFactoryAddr);
    
    /* Initialize Sushiswap Factory */
    const sushiFactoryAddr = await sushiRouterContract.methods.factory().call();
    sushiFactoryContract = new web3.eth.Contract(sushiFactoryABI, sushiFactoryAddr);

    //await printPairs(true, 10);
    //await printPairs(false, 10);

    /* Initialize Pancakeswap */
    const pancakePairAddr = await pancakeFactoryContract.methods.getPair(token0, token1).call();
    pancakePairContract = new web3.eth.Contract(pancakePairABI, pancakePairAddr);

    console.log(`[Pancakeswap] router: ${activeConfig.PANCAKE_ROUTER_ADDRESS}, factory: ${pancakeFactoryAddr}, pair: ${pancakePairAddr}`);

    try {
        const ethDaiPairAddr = await pancakeFactoryContract.methods.getPair(activeConfig.DAI, activeConfig.ETH).call();
        const ethDaiPairContract = new web3.eth.Contract(pancakePairABI, ethDaiPairAddr);
        RR = await ethDaiPairContract.methods.getReserves().call();
        uReserve0 = RR[0]; //dai
        uReserve1 = RR[1]; //eth
        priceEth = RR[0] / RR[1]; //dai per eth
        console.log("ETH Price:", priceEth);
    }
    catch (error) {
        console.log(error);
    }
    
    /* Initialize Sushiswap */
    const sushiPairAddr = await sushiFactoryContract.methods.getPair(token0, token1).call();
    sushiPairContract = new web3.eth.Contract(sushiPairABI, sushiPairAddr);

    console.log(`[Sushiswap] router: ${activeConfig.SUSHI_ROUTER_ADDRESS}, factory: ${sushiFactoryAddr}, pair: ${sushiPairAddr}`);

    //const price0 = await getTokenPriceOnPancake();
    //const price1 = await getTokenPriceOnSushi();
    //console.log("Price(P):", price0, ",  Price(S):", price1);

    console.log("init -- Done");
}

const getProfit = async (amountIn, firstPancake, PP, SS, gasFee) => {
    let profit;
    const amountIn2 = Number(web3.utils.fromWei(amountIn.toString(), "ether"));
    let fee = Number(web3.utils.fromWei(gasFee.toString(), "ether"));
    if (firstPancake) {
        const b = await pancakeRouterContract.methods.getAmountOut(amountIn, PP[0], PP[1]).call();
        const a = await sushiRouterContract.methods.getAmountOut(b, SS[1], SS[0]).call();
        let amountOut = Number(web3.utils.fromWei(a.toString(), "ether"));
        profit = (amountOut - amountIn2) / priceEth;
    }
    else {
        const b = await sushiRouterContract.methods.getAmountOut(amountIn, SS[0], SS[1]).call();
        const a = await pancakeRouterContract.methods.getAmountOut(b, PP[1], PP[0]).call();
        let amountOut = Number(web3.utils.fromWei(a.toString(), "ether"));
        profit = (amountOut - amountIn2) / priceEth;
    }
    profit -= fee;
    return profit;
}

const processArbitrage = async (token0, token1) => {
    try {
        let PP = await pancakePairContract.methods.getReserves().call();
        let SS = await sushiPairContract.methods.getReserves().call();
        const P1 = Number(web3.utils.fromWei(PP[1].toString(), "ether"));
        const P0 = Number(web3.utils.fromWei(PP[0].toString(), "ether"));
        const S1 = Number(web3.utils.fromWei(SS[1].toString(), "ether"));
        const S0 = Number(web3.utils.fromWei(SS[0].toString(), "ether"));

        let diffPrice = (P1 / P0) - (S1 / S0);
        if (diffPrice > -0.000000001 && diffPrice < 0.000000001) {
            console.log("Same prices!!! No arbitrage", diffPrice);
            return;
        }
        
        let firstPancake = diffPrice > 0;
        let amount;
        if (firstPancake) {
            amount = (P1 * S0 - P0 * S1) / (P1 + S1) / 2;
        }
        else {
            amount = (P0 * S1 - P1 * S0) / (P1 + S1) / 2;
        }

        console.log("Difference Price:", diffPrice);
        //console.log("Pancake:", P0, P1);
        //console.log("Sushi:", S0, S1);
        //console.log("Amount:", amount);

        let balance = await token0Contract.methods.balanceOf(arbitrageContract.options.address).call();
        balance = Number(web3.utils.fromWei(balance.toString(), "ether"));
        console.log("Pre-Balance:", balance);
        if (balance < amount) {
            let myBalance = await token0Contract.methods.balanceOf(myAccount.address).call();
            myBalance = Number(web3.utils.fromWei(myBalance.toString(), "ether"));
            console.log("My Balance:", myBalance);

            let neededAmount = amount - balance + 0.1;
            if (myBalance > neededAmount) {
                console.log("Transfering token from wallet to contract:", neededAmount);
                const amount2 = web3.utils.toWei(neededAmount.toString(), "ether");
                let transfering = token0Contract.methods.transfer(arbitrageContract.options.address, amount2);
                let currentGasPrice = await getCurrentGasPrices();
                let gasEst = await transfering.estimateGas({ from: myAccount.address });
                await signAndSendTransaction(transfering, myAccount.address, token0, gasEst, currentGasPrice.high);
            }
            else
                amount = balance;
            
            if (amount <= 0.000000001) {
                console.log("Insufficiant Balance, returing...");
                return;
            }
        }

        if (amount > 0) {
            amount = web3.utils.toWei(amount.toFixed(6).toString(), "ether");
            let trading = arbitrageContract.methods.trade(token0, token1, amount, firstPancake);
            const currentGasPrice = await getCurrentGasPrices();
            const gasEst = await trading.estimateGas({ from: myAccount.address });
            const gasPrice = currentGasPrice.high;
            console.log('Gasprice is:', gasPrice);
            let profit = await getProfit(amount, firstPancake, PP, SS, gasEst * Number(gasPrice));
            if (profit < 0) {
                console.log("No arbitrage!!!, Profit:", profit);
                return;
            }
            await signAndSendTransaction(trading, myAccount.address, arbitrageContract.options.address, gasEst, gasPrice);
        }
    }
    catch (error) {
        console.log(error);
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const main = async () => {
    await init(activeConfig.TOKEN0, activeConfig.TOKEN1);

    let maxCount = 0;
    while (true) {
        await processArbitrage(activeConfig.TOKEN0, activeConfig.TOKEN1);
        await sleep(100);
        if (maxCount > 0) {
            maxCount--;
            if (maxCount == 0)
                break;
        }
    }
}

main();
