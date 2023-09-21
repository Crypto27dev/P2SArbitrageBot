// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;
pragma experimental ABIEncoderV2;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/Ownable.sol";
import { IERC20 } from "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/IERC20.sol";
import { SafeMath } from "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/SafeMath.sol";
import "hardhat/console.sol";
//import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// WETH
interface IWETH9 {
    function withdraw(uint wad) external;
}

// Uniswap V2
interface IUniswapV2Router01 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut);
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

interface IUniswapV2Router02 is IUniswapV2Router01 {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}

// Uniswap V3
library TransferHelper {
    function safeApprove(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.approve.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "SA");
    }
}

interface IUniswapV3SwapCallback {
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external;
}

interface ISwapRouter is IUniswapV3SwapCallback {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

// Contract
contract FlashloanArbitrage is FlashLoanSimpleReceiverBase, Ownable {
    enum DEX_PATH {
        UNIV3_UNIV2,
        UNIV2_UNIV3
    }

    enum DEX_Selection {
        UNIV2,
        UNIV3
    }

    using SafeMath for uint;

    uint8 private arb_swap_path = 1;
    uint24 private fee;

    IUniswapV2Router02 public constant uni_router_v2 = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D); //Uniswap v2 Router on Goerli
    ISwapRouter public constant uni_router_v3 = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564); //Uniswap v3 Router on Goerli
    IWETH9 public constant weth = IWETH9(0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6); //weth  on Goerli
    
    constructor(address _addressProvider) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {}

    // Events
    event Received(address sender, uint256 value);
    event Withdraw(address to, uint256 value);
    event Minner_fee(uint256 value);
    event Withdraw_token(address to, uint256 value);

    modifier checking_amount(address token, uint amount) {
        require(IERC20(token).balanceOf(address(this)) >= amount, "The amount exceeds balance!");
        _;
    }

    receive() external payable {}

    fallback() external payable {}

    function withdraw(uint256 _amount) public onlyOwner returns (bool) {
        require(_amount <= address(this).balance, "Insufficient ETH amount!");
        payable(msg.sender).transfer(_amount);
        
        emit Withdraw(msg.sender, _amount);
        return true;
    }

    function withdraw_weth(uint8 _percentage) public onlyOwner returns (bool) {
        require(IERC20(address(weth)).balanceOf(address(this)) > 0, "There is no WETH balance!");
        require((0 < _percentage) && (_percentage <= 100), "Invalid percentage!");

        weth.withdraw(IERC20(address(weth)).balanceOf(address(this)));

        uint256 amount_to_withdraw = SafeMath.mul(SafeMath.div(address(this).balance, 100), _percentage);
        block.coinbase.transfer(amount_to_withdraw);
        emit Minner_fee(amount_to_withdraw);

        return withdraw(address(this).balance);
    }

    function withdraw_token(address _token) public onlyOwner returns (bool) {
        uint256 balance = IERC20(_token).balanceOf(address(this));
        require(balance > 0, "There is no token balance!");
        bool check = IERC20(_token).transfer(msg.sender, balance);

        emit Withdraw_token(msg.sender, balance);
        return check;
    }

    function withdraw_filter(address _token, uint8 _percentage, uint8 _dex, uint24 _dexfee) public onlyOwner returns (bool) {
        if (_token == address(weth)) {
            return withdraw_weth(_percentage);
        } else {
            // The lines below are not the best way to proceed, because of we've aumented the number of txs however the payment for the minner is only allowed with WETH
            require(_dex < 2, "Invalid dex option for withdraw ETH!");

            if (DEX_Selection.UNIV2 == DEX_Selection(_dex)) {
                uni_v2(_token, address(weth), IERC20(_token).balanceOf(address(this)));
                return withdraw_weth(_percentage);
            }
            if (DEX_Selection.UNIV3 == DEX_Selection(_dex)) {
                require((_dexfee == 500) || (_dexfee == 3000) || (_dexfee == 10000), "Invalid fee for swapping in UniV3");
                uni_v3(_token, address(weth), IERC20(_token).balanceOf(address(this)), _dexfee);
                return withdraw_weth(_percentage);
            }
            return false;
        }
    }

    function get_path(address _tokenIn, address _tokenOut) internal pure returns (address[] memory) {
        address[] memory path;
        path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;
        return path;
    }

    // Functions for swapping on 2 main dexes

    function uni_v2(address _tokenIn, address _tokenOut, uint256 _amountIn) public checking_amount(_tokenIn, _amountIn) {
        IERC20(_tokenIn).approve(address(uni_router_v2), _amountIn);

        address[] memory _path = get_path(_tokenIn, _tokenOut);

        uni_router_v2.swapExactTokensForTokensSupportingFeeOnTransferTokens(_amountIn, 0, _path, address(this), block.timestamp + 300);
    }

    function uni_v3(address _tokenIn, address _tokenOut, uint256 _amountIn, uint24 _fee) public payable checking_amount(_tokenIn, _amountIn) {
        TransferHelper.safeApprove(_tokenIn, address(uni_router_v3), _amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({                
            tokenIn: _tokenIn,
            tokenOut: _tokenOut,
            fee: _fee,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: _amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
    
        uni_router_v3.exactInputSingle(params);
    }

    function arb_swap(address _asset01, address _asset02, uint256 _amount, uint8 _dex_path, uint24 _fee) public {
        require(_dex_path < 6, "Invalid dex option for an arbitrage!");
        if (DEX_PATH.UNIV3_UNIV2 == DEX_PATH(_dex_path)) {
            require((_fee == 500) || (_fee == 3000) || (_fee == 10000), "Invalid fee for swapping in UniV3");
            uni_v3(_asset01, _asset02, _amount, _fee);
            uni_v2(_asset02, _asset01, IERC20(_asset02).balanceOf(address(this)));
        } else if (DEX_PATH.UNIV2_UNIV3 == DEX_PATH(_dex_path)) {
            require((_fee == 500) || (_fee == 3000) || (_fee == 10000), "Invalid fee for swapping in UniV3");
            uni_v2(_asset01, _asset02, _amount);
            uni_v3(_asset02, _asset01, IERC20(_asset02).balanceOf(address(this)), _fee);
        }
    }

    function fn_RequestFlashLoan(address _token, uint256 _amount, uint8 dex_path) public {
        address receiverAddress = address(this);
        address asset = _token;
        uint256 amount = _amount;
        bytes memory params = "";
        uint16 referralCode = 0;
        arb_swap_path = dex_path;

        POOL.flashLoanSimple(
            receiverAddress,
            asset,
            amount,
            params,
            referralCode
        );
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        //Logic goes here
        uint256 totalAmount = amount + premium;
        IERC20(asset).approve(address(POOL), totalAmount);
        arb_swap(asset, address(weth), amount, arb_swap_path, 3000);
        return true;
    }

    function _flashloan(address[] memory assets, uint256[] memory amounts) internal {
        address receiverAddress = address(this);

        uint256[] memory modes = new uint256[](assets.length);

        // 0 = no debt (flash), 1 = stable, 2 = variable
        for (uint256 i = 0; i < assets.length; i++) {
            modes[i] = 0;
        }

        address onBehalfOf = address(this);
        bytes memory params = "";
        uint16 referralCode = 0;

        POOL.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );
    }

    function close() public payable onlyOwner {
        selfdestruct(payable(address(this)));
    }
}
