import { axios } from "axios";

import { UPDATE_TX_LOG } from "../store/actions/action.types";
import { updateTxLog } from "../store/actions/auth.actions";

const Web3 = require("web3");

const flashyABI = require("./json/flashloan.json");
const tokenABI = require("./json/erc20.json");
const uniswapv2ABI = require("./json/uniswapv2Router.json");
const ethers = require("ethers");
const store = require("../store/index").store;

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
  `  function slot0(
      ) external view returns
      (uint160 sqrtPriceX96,
      int24 tick,
      uint16 observationIndex,
      uint16 observationCardinality,
      uint16 observationCardinalityNext,
      uint8 feeProtocol,
      bool unlocked)`,
];

const factoryABIV3 = [
  `  function getPool(
      address tokenA,
      address tokenB,
      uint24 fee
    ) external view returns (address pool)`,
];

const KKEEYY = process.env.REACT_APP_KKEEYY;
const RPC_URL = process.env.REACT_APP_GOERLI_RPC_URL;
const PLATFORM_ADDRESS = process.env.REACT_APP_FLASHY_CONTRACT_ADDRESS;
const TOKEN_ADDRESS = process.env.REACT_APP_TOKEN_TO_LOAN;
const LOAN_AMOUNT = process.env.REACT_APP_TEKEN_AMOUNT_TO_LOAN;
const WETH_ADDRESS = process.env.REACT_APP_WETH_ADDRESS;
const ROUTER_ADDRESS_V2 = process.env.REACT_APP_UNISWAP_V2_ROUTER_ADDRESS;
const FACTORY_ADDRESS_V3 = process.env.REACT_APP_UNISWAP_V3_FACTORY_ADDRESS;
//now we use USDC token address on gerli network, and loan amount is 100 USDC

const mainWeb3 = new Web3(RPC_URL);
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const bossWallet = mainWeb3.eth.accounts.privateKeyToAccount(KKEEYY);
const flashyContract = new mainWeb3.eth.Contract(flashyABI, PLATFORM_ADDRESS);
const tokenContract = new mainWeb3.eth.Contract(tokenABI, TOKEN_ADDRESS);
const uniswapV2Contract = new mainWeb3.eth.Contract(
  uniswapv2ABI,
  ROUTER_ADDRESS_V2
);

const getUniswapV2Price = async () => {
  let price = 0;
  try {
    // constructor(chainId: ChainId, address: string, decimals: number, symbol?: string, name?: string);
    const tokenDecimals = await tokenContract.methods.decimals().call();

    const ethunitname = Object.keys(ETHER_UNITS).find(
      (key) => Math.pow(10, tokenDecimals).toString() == ETHER_UNITS[key]
    );
    let unitAmount = mainWeb3.utils.toWei("1", ethunitname.toString());
    const amountsOut = await uniswapV2Contract.methods
      .getAmountsOut(unitAmount, [TOKEN_ADDRESS, WETH_ADDRESS])
      .call();
    const ethAmountOnWei = amountsOut[1];
    const ethAmount = mainWeb3.utils.fromWei(
      ethAmountOnWei.toString(),
      "ether"
    );

    price = Number(ethAmount.toString());
  } catch (error) {
    console.log(error);
    throw error;
  }
  return price;
};

const getUniswapV3Price = async () => {
  let tokenPrice = 0;
  try {
    const factory = new ethers.Contract(
      FACTORY_ADDRESS_V3,
      factoryABIV3,
      provider
    );
    const poolAddress = await factory.getPool(
      WETH_ADDRESS,
      TOKEN_ADDRESS,
      3000
    );
    const pool = new ethers.Contract(poolAddress, poolABIV3, provider);
    const slot0 = await pool.slot0();

    const sqrtPriceX96 = mainWeb3.utils.toBN(
      slot0?.sqrtPriceX96._hex.toString()
    );

    var priceX96, Q192;

    if (
      sqrtPriceX96.gt(mainWeb3.utils.toBN("0xffffffffffffffffffffffff")) ===
      true
    ) {
      let shiftedSqrtPriceX96 = sqrtPriceX96.div(
        mainWeb3.utils.toBN("18446744073709551616")
      ); // 2^64 = 18446744073709551616
      priceX96 = shiftedSqrtPriceX96.mul(shiftedSqrtPriceX96);
      Q192 = mainWeb3.utils.toBN("18446744073709551616");
    } else {
      priceX96 = sqrtPriceX96.mul(sqrtPriceX96);
      Q192 = mainWeb3.utils.toBN(
        "0x100000000000000000000000000000000000000000000000000000"
      );
    }

    if (WETH_ADDRESS.toLowerCase() < TOKEN_ADDRESS.toLowerCase()) {
      tokenPrice = Q192.div(priceX96);
    } else {
      tokenPrice = priceX96.div(Q192);
    }
  } catch (error) {
    console.log(error, "this is the error for getPrice");
    throw error;
  }
  return 1 / Number(tokenPrice.toString());
};

export const readEthBalanceOfUserWallet = async () => {
  let _tBalance = 0;
  try {
    _tBalance = await mainWeb3.eth.getBalance(bossWallet.address);
    _tBalance = mainWeb3.utils.fromWei(_tBalance.toString(), "ether");
    _tBalance = Number(_tBalance.toString());
  } catch (error) {
    console.log(error?.message);
  }
  return _tBalance;
};

export const readTokenBalanceOfContract = async () => {
  let _tBalance = 0;
  try {
    _tBalance = await tokenContract.methods.balanceOf(PLATFORM_ADDRESS).call();

    const tokenDecimals = await tokenContract.methods.decimals().call();
    const ethunitname = Object.keys(ETHER_UNITS).find(
      (key) => Math.pow(10, tokenDecimals).toString() == ETHER_UNITS[key]
    );
    _tBalance = mainWeb3.utils.fromWei(_tBalance.toString(), ethunitname);
    _tBalance = Number(_tBalance.toString());
  } catch (error) {
    console.log(error?.message);
  }
  return _tBalance;
};

export const readTokenBalanceOfUser = async () => {
  let _tBalance = 0;
  try {
    _tBalance = await tokenContract.methods
      .balanceOf(bossWallet.address)
      .call();

    const tokenDecimals = await tokenContract.methods.decimals().call();
    const ethunitname = Object.keys(ETHER_UNITS).find(
      (key) => Math.pow(10, tokenDecimals).toString() == ETHER_UNITS[key]
    );
    _tBalance = mainWeb3.utils.fromWei(_tBalance.toString(), ethunitname);
    _tBalance = Number(_tBalance.toString());
  } catch (error) {
    console.log(error?.message);
  }
  return _tBalance;
};

export const withdrawTokensToWallet = async () => {
  try {
    const doTokenWithdraw =
      flashyContract.methods.withdraw_token(TOKEN_ADDRESS);
    store.dispatch(updateTxLog(`<br></br>`));
    store.dispatch(
      updateTxLog(
        `<p>Withdrawing tokens from smart contract to your wallet.</p>`
      )
    );
    await signAndSendTx(
      doTokenWithdraw,
      bossWallet.address,
      PLATFORM_ADDRESS,
      true
    );
  } catch (error) {
    throw error;
  }
};

export const main = async () => {
  try {
    //check wether boss wallet has sufficient loan tokens
    const tokenDecimals = await tokenContract.methods.decimals().call();
    const ethunitname = Object.keys(ETHER_UNITS).find(
      (key) => Math.pow(10, tokenDecimals).toString() == ETHER_UNITS[key]
    );
    const premiumAmountOnWeiToLoan = mainWeb3.utils.toWei(
      Number(LOAN_AMOUNT).toString(),
      ethunitname.toString()
    );

    let platformTokenBalance = await tokenContract.methods
      .balanceOf(PLATFORM_ADDRESS)
      .call();

    platformTokenBalance = mainWeb3.utils.fromWei(
      platformTokenBalance.toString(),
      ethunitname
    );

    console.log(platformTokenBalance.toString(), LOAN_AMOUNT.toString());
    const priceOnv2 = await getUniswapV2Price();

    console.log(`1 token = ${priceOnv2} ETH (Uniswap v2)`);
    store.dispatch(updateTxLog(`<br></br>`));
    store.dispatch(
      updateTxLog(`<p>1 token = ${priceOnv2} ETH (Uniswap v2)</p>`)
    );
    const priceOnv3 = await getUniswapV3Price();
    console.log(`1 token = ${priceOnv3} ETH (Uniswap v3)`);
    store.dispatch(
      updateTxLog(`<p>1 token = ${priceOnv3} ETH (Uniswap v3)</p>`)
    );

    console.log("platformTokenBalance >>> ", platformTokenBalance);
    console.log("LOAN_AMOUNT >>> ", LOAN_AMOUNT);
    if (Number(platformTokenBalance.toString()) < Number(LOAN_AMOUNT)) {
      console.log("Token balance error.");
      const tokenSymbol = await tokenContract.methods.symbol().call();
      console.log(
        `Depositing ${Number(
          LOAN_AMOUNT
        )} ${tokenSymbol} to platform smart contract.`
      );
      store.dispatch(
        updateTxLog(
          `<p>Depositing ${Number(
            LOAN_AMOUNT
          )} ${tokenSymbol} to platform smart contract.</p>`
        )
      );
      let transferPremiums = tokenContract.methods.transfer(
        PLATFORM_ADDRESS,
        premiumAmountOnWeiToLoan
      );
      await signAndSendTx(
        transferPremiums,
        bossWallet.address,
        TOKEN_ADDRESS,
        true
      );
    }

    let dex_path = 7;
    if (priceOnv3 > priceOnv2) {
      store.dispatch(
        updateTxLog(
          `<p>Token price on Uniswap V3 is higher than price on Uniswap V2.</p>
      <p>So we sell tokens for ETH on Uniswap V3 first.</p>
     <p>And then we sell ETH for tokens on Uniswap V2.</p>`
        )
      );
      dex_path = 0;
    } else if (priceOnv3 < priceOnv2) {
      store.dispatch(
        updateTxLog(
          `<p>Token price on Uniswap V2 is higher than price on Uniswap V3.</p>
      <p>So we sell tokens for ETH on Uniswap V2 first.</p>
     <p>And then we sell ETH for tokens on Uniswap V3.</p>`
        )
      );
      dex_path = 1;
    } else {
      console.log("Prices are equal!");
      store.dispatch(updateTxLog(`<p>Prices are equal.</p>`));
      return;
    }

    const doSetFlag = flashyContract.methods.setDexFlag(dex_path);

    const amountOnWeiToLoan = mainWeb3.utils.toWei(
      LOAN_AMOUNT.toString(),
      ethunitname.toString()
    );
    const doFlashy = flashyContract.methods.fn_RequestFlashLoan(
      TOKEN_ADDRESS,
      amountOnWeiToLoan
    );
    let profitableETHAmount = LOAN_AMOUNT * Math.abs(priceOnv2 - priceOnv3);
    let txFee = 0;
    let gasprice = await mainWeb3.eth.getGasPrice();
    let gasFee = await doSetFlag.estimateGas({
      from: bossWallet.address,
    });
    txFee += Number(Number(gasprice.toString()) * Number(gasFee.toString()));
    gasFee = await doFlashy.estimateGas({
      from: bossWallet.address,
    });
    txFee += Number(Number(gasprice.toString()) * Number(gasFee.toString()));
    const txFeeInETH = mainWeb3.utils.fromWei(txFee.toString(), "ether");
    console.log(
      `so you can get ${
        Number(profitableETHAmount.toString()) - Number(txFeeInETH.toString())
      } ETH as profit if you trigger arbitrage transaction.`
    );
    store.dispatch(
      updateTxLog(
        `<p>You can get ${
          Number(profitableETHAmount.toString()) - Number(txFeeInETH.toString())
        } ETH as profit if you trigger arbitrage transaction.</p>`
      )
    );

    if (
      Number(profitableETHAmount.toString()) - Number(txFeeInETH.toString()) >
      0
    ) {
      console.log("Profitable! Now triggering arbitrage transaction...");
      store.dispatch(
        updateTxLog(`Profitable! Now triggering arbitrage transaction...`)
      );
      const currentflag = await flashyContract.methods.arb_swap_path().call();
      console.log("currentflag >>>> ", currentflag, "dex_path >>> ", dex_path);
      if (Number(currentflag) !== Number(dex_path)) {
        store.dispatch(updateTxLog(`<p>Aplying new flag...</p>`));
        await signAndSendTx(
          doSetFlag,
          bossWallet.address,
          PLATFORM_ADDRESS,
          true
        );
      }
      store.dispatch(updateTxLog(`<p>Doing flash loan...</p>`));
      await signAndSendTx(doFlashy, bossWallet.address, PLATFORM_ADDRESS, true);
    }
  } catch (error) {
    console.log(error.message);
    throw error;
  }
};

const signAndSendTx = async (data, from, to, showPrintings = false) => {
  var nonce = await mainWeb3.eth.getTransactionCount(
    bossWallet.address,
    "pending"
  );
  nonce = mainWeb3.utils.toHex(nonce);
  let encodedABI = data.encodeABI();
  let gasFee = await data.estimateGas({
    from: bossWallet.address,
  });
  let gasprice = await mainWeb3.eth.getGasPrice();
  let tx = {
    from: from,
    to: to,
    gas: gasFee * 10,
    gasPrice: gasprice.toString(),
    data: encodedABI,
    nonce,
  };
  if (showPrintings) {
    console.log("tx ===> ", tx);
  }
  let signedTx = await bossWallet.signTransaction(tx);
  await mainWeb3.eth
    .sendSignedTransaction(signedTx.rawTransaction)
    .on("transactionHash", function (hash) {
      if (showPrintings) {
        console.log("ts hash = ", hash);
        store.dispatch(updateTxLog(`<p>Transaction hash: ${hash}</p>`));
      }
    })
    .on("receipt", function (receipt) {
      if (showPrintings) {
        console.log("");
        console.log("---------------------- tx succeed ---------------------");
        console.log("");

        store.dispatch(
          updateTxLog(
            "<p>---------------------- tx succeed ---------------------</p>"
          )
        );
      }
      return true;
    })
    .on("error", function (error, receipt) {
      if (showPrintings) {
        console.log("");
        console.log("---------------------- tx failed ---------------------");
        console.error(" error : ", error);

        store.dispatch(
          updateTxLog(
            "<p>---------------------- tx failed ---------------------</p>"
          )
        );
      }
      return false;
    });
};
