const Web3 = require('web3');
//const RouterABI = require('./abi/uniswapV2Router.json');
const FactoryABI = require('./abi/sushiswapV2Factory.json');
const PairABI = require('./abi/uniswapV2Pair.json');
const ERC20ABI = require('./abi/erc20.json');

const web3 = new Web3('https://bsc-dataseed1.binance.org:443');
//const sushiswapRouterAddress = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';
const sushiswapFactoryAddress = '0xc35DADB65012eC5796536bD9864eD8773aBc74C4';

//const sushiswapRouter = new web3.eth.Contract(RouterABI, sushiswapRouterAddress);
const sushiswapFactory = new web3.eth.Contract(FactoryABI, sushiswapFactoryAddress);

const printPairsOnSushswap = async () => {
    const allPairsLength = await sushiswapFactory.methods.allPairsLength().call();
    console.log(allPairsLength);

    for (let i = 0; i < 10/*allPairsLength*/; i++) {
        const pairAddr = await sushiswapFactory.methods.allPairs(i).call();
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
        //const pair = await sushiswapRouter.methods.getPair(pairAddr, web3.utils.toChecksumAddress('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c')).call();
        //if (pair !== '0x0000000000000000000000000000000000000000') {
        //    console.log(pairAddr);
        //}
    }
}

printPairsOnSushswap();