require("@nomicfoundation/hardhat-chai-matchers")
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
const secrets = require("./secrets.json");

const ETHERSCAN_API_KEY = secrets.ether_scan_api_key;
const BSCSCAN_API_KEY = secrets.bsc_scan_api_key;
const PRIVATE_KEY = secrets.private_key;
const PRIVATE_KEY2 = secrets.private_key2;
// const MY_PRIVATE_KEY = secrets.my_private_key2;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.10",
    networks:{
        goerli: {
            url: "https://rpc.goerli.eth.gateway.fm",//"https://goerli.infura.io/v3/f65bf972517c4a60be9ce62a2207d6a8"; //"https://rpc.goerli.eth.gateway.fm"
            chainId: 5,
            accounts:[PRIVATE_KEY],
        },
        bsc: {
            url: "https://bsc-dataseed.binance.org/",
            chainId: 56,
            gasPrice: 20000000000,
            accounts: [PRIVATE_KEY],
        },
        bscTestnet: {
            url: "https://data-seed-prebsc-1-s1.binance.org:8545",
            chainId: 97,
            gasPrice: 20000000000,
            accounts: [PRIVATE_KEY2],
        },
        hardhat: {
            gasPrice: 10000000000, // Set the gas price to 20 Gwei
            // Other configurations...
        }
    },
    etherscan: {
        apiKey: {
            goerli: ETHERSCAN_API_KEY,
            bsc: BSCSCAN_API_KEY,
            bscTestnet: BSCSCAN_API_KEY
        }
    },
    settings: {
        optimizer: {
            enabled: true,
            runs: 200,
        },
    },
    allowUnlimitedContractSize: true,
};
