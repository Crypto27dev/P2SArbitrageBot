// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/Ownable.sol";
import { IERC20 } from "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/IERC20.sol";
import { SafeMath } from "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/SafeMath.sol";
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
//import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/lib/contracts/libraries/Babylonian.sol';

interface IWETH9 {
    function withdraw(uint wad) external;
}

interface IPancakeRouter01 {
    function factory() external pure returns (address);

    function WETH() external pure returns (address);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        );

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        payable
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        );

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);

    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountToken, uint256 amountETH);

    function removeLiquidityWithPermit(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline,
        bool approveMax,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 amountA, uint256 amountB);

    function removeLiquidityETHWithPermit(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline,
        bool approveMax,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 amountToken, uint256 amountETH);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) external pure returns (uint256 amountB);

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256 amountOut);

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256 amountIn);

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);

    function getAmountsIn(uint256 amountOut, address[] calldata path) external view returns (uint256[] memory amounts);
}

interface IPancakeRouter02 is IPancakeRouter01 {
    function removeLiquidityETHSupportingFeeOnTransferTokens(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountETH);

    function removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline,
        bool approveMax,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 amountETH);

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable;

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

contract NormalArbitrage is Ownable {
    using SafeMath for uint256;

    uint256 private constant DEADLINE = 300;

    /* BSC */
    //address private constant PANCAKE_ROUTER_ADDRESS = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    //address private constant SUSHISWAP_ROUTER_ADDRESS = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    //address private constant WETH_ADDRESS = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c; // WBNB on Binance Smart Chain

    /* BSC testnet */
    address private constant PANCAKE_ROUTER_ADDRESS = 0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3;
    address private constant SUSHISWAP_ROUTER_ADDRESS = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address private constant WETH_ADDRESS = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd; // WBNB on Binance Smart Chain

    IPancakeRouter02 private pancakeRouter;
    IUniswapV2Router02 private sushiRouter;
    IWETH9 private weth;

    constructor() {
        pancakeRouter = IPancakeRouter02(PANCAKE_ROUTER_ADDRESS);
        sushiRouter = IUniswapV2Router02(SUSHISWAP_ROUTER_ADDRESS);
        weth = IWETH9(WETH_ADDRESS);
    }

    // Events
    event Received(address sender, uint256 value);
    event Withdraw(address to, uint256 value);
    event Minner_fee(uint256 value);
    event Withdraw_token(address to, uint256 value);

    receive() external payable {}

    fallback() external payable {}

    /*function withdraw(uint256 _amount) public onlyOwner returns (bool) {
        require(_amount <= address(this).balance, "Insufficient ETH amount!");
        payable(msg.sender).transfer(_amount);
        
        emit Withdraw(msg.sender, _amount);
        return true;
    }

    function withdrawWeth(uint8 _percentage) public onlyOwner returns (bool) {
        require(IERC20(WETH_ADDRESS).balanceOf(address(this)) > 0, "There is no WETH balance!");
        require((0 < _percentage) && (_percentage <= 100), "Invalid percentage!");

        weth.withdraw(IERC20(WETH_ADDRESS).balanceOf(address(this)));

        uint256 amount_to_withdraw = SafeMath.mul(SafeMath.div(address(this).balance, 100), _percentage);
        block.coinbase.transfer(amount_to_withdraw);
        emit Minner_fee(amount_to_withdraw);

        return withdraw(address(this).balance);
    }*/

    function withdrawToken(address _token) public onlyOwner returns (bool) {
        uint256 balance = IERC20(_token).balanceOf(address(this));
        require(balance > 0, "There is no token balance!");
        bool check = IERC20(_token).transfer(msg.sender, balance);

        emit Withdraw_token(msg.sender, balance);
        return check;
    }

    /*function swapTokenWithWethOnPancakeswap(address token, uint256 amount) external {
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = WETH_ADDRESS;

        IERC20(token).approve(address(pancakeRouter), amount);
        pancakeRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amount,
            0,
            path,
            address(this),
            block.timestamp + DEADLINE
        );
    }

    function swapTokensOnPancakeswap(address tokenIn, address tokenOut, uint256 amountIn) external {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        IERC20(tokenIn).approve(address(pancakeRouter), amountIn);
        uint[] memory amounts = pancakeRouter.getAmountsOut(amountIn, path);

        //IERC20(tokenOut).approve(address(pancakeRouter), amounts[amounts.length - 1]);
        pancakeRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            amounts[amounts.length - 1],
            path,
            address(this),
            block.timestamp + DEADLINE
        );
    }

    function swapTokenWithWethOnSushiswap(address token, uint256 amount) external {
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = WETH_ADDRESS;

        IERC20(token).approve(address(sushiRouter), amount);
        sushiRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amount,
            0,
            path,
            address(this),
            block.timestamp + DEADLINE
        );
    }

    function swapTokensOnSushiswap(address tokenIn, address tokenOut, uint256 amountIn) external {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        IERC20(tokenIn).approve(address(sushiRouter), amountIn);
        uint256[] memory amounts = sushiRouter.getAmountsOut(amountIn, path);

        sushiRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            amounts[amounts.length - 1],
            path,
            address(this),
            block.timestamp + DEADLINE
        );
    }*/

    function trade(address token0, address token1, uint256 amount, bool firstPancake) external {
        address[] memory path = new address[](2);

        if (firstPancake) {
            /* Swap using Pancakeswap */
            path[0] = token0;
            path[1] = token1;

            IERC20(token0).approve(address(pancakeRouter), amount);
            //uint256[] memory amounts = pancakeRouter.getAmountsOut(amount, path);
            pancakeRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amount,
                0,//amounts[amounts.length - 1],
                path,
                address(this),
                block.timestamp + DEADLINE
            );

            /* Swap using Sushiswap */
            path[0] = token1;
            path[1] = token0;

            uint256 amount2 = IERC20(token1).balanceOf(address(this));
            IERC20(token1).approve(address(sushiRouter), amount2);
            sushiRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amount2,
                0,
                path,
                address(this),
                block.timestamp + DEADLINE
            );
        }
        else {
            /* Swap using Sushiswap */
            path[0] = token0;
            path[1] = token1;

            IERC20(token0).approve(address(sushiRouter), amount);
            //uint256[] memory amounts = sushiRouter.getAmountsOut(amount, path);
            sushiRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amount,
                0,//amounts[amounts.length - 1],
                path,
                address(this),
                block.timestamp + DEADLINE
            );

            /* Swap using Pancakeswap */
            path[0] = token1;
            path[1] = token0;

            uint256 amount2 = IERC20(token1).balanceOf(address(this));
            IERC20(token1).approve(address(pancakeRouter), amount2);
            pancakeRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                amount2,
                0,
                path,
                address(this),
                block.timestamp + DEADLINE
            );
        }
    }
}
