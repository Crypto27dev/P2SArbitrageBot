const Web3 = require('web3');
const FactoryABI = require('./abi/pancakeswapFactory.json');
const PairABI = require('./abi/pancakeswapPair.json');
const ERC20ABI = require('./abi/erc20.json');

const web3 = new Web3('https://bsc-dataseed.binance.org/');
const pancakeFactoryAddress = '0xBCfCcbde45cE874adCB698cC183deBcF17952812';
const pancakeFactoryContract = new web3.eth.Contract(FactoryABI, pancakeFactoryAddress);

const printPairsOnPancakeswap = async () => {
    const allPairsLength = await pancakeFactoryContract.methods.allPairsLength().call();
    console.log(allPairsLength);

    for (let i = 0; i < /*allPairsLength*/10; i++) {
        const pairAddr = await pancakeFactoryContract.methods.allPairs(i).call();
        const pairContract = await new web3.eth.Contract(PairABI, pairAddr);

        const token0Addr = await pairContract.methods.token0().call();
        const token0Contract = await new web3.eth.Contract(ERC20ABI, token0Addr);
        //const token0Name = await token0Contract.methods.name().call();
        const token0Symbol = await token0Contract.methods.symbol().call();

        const token1Addr = await pairContract.methods.token1().call();
        const token1Contract = await new web3.eth.Contract(ERC20ABI, token1Addr);
        //const token1Name = await token1Contract.methods.name().call();
        const token1Symbol = await token1Contract.methods.symbol().call();

        console.log(`Pair ${i}: <${token0Addr}(${token0Symbol}), ${token1Addr}(${token1Symbol})>`);
    }
}

const getTokenPrice = async ()=> {
    const TOKEN0 = "0x55d398326f99059fF775485246999027B3197955"; // USDT
    const TOKEN1 = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"; // WBNB
    const pairAddr = await pancakeFactoryContract.methods.getPair(TOKEN0, TOKEN1).call();
    const pairContract = await new web3.eth.Contract(PairABI, pairAddr);

    const reserves = await pairContract.methods.getReserves().call();
    const tokenPrice = reserves[1] / reserves[0];
    console.log(`Token price: ${tokenPrice}`);
}

getTokenPrice();
//printPairsOnPancakeswap();
