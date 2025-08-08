const { Connection, PublicKey } = require("@solana/web3.js");

async function getSplTokenBalance(ownerAddress, tokenMintAddress) {
  const connection = new Connection("https://radial-multi-shadow.solana-mainnet.quiknode.pro/c270db6af00aa1550e6819c881944e7fbb7370a1");
  const ownerPublicKey = new PublicKey(ownerAddress);
  const tokenMintPublicKey = new PublicKey(tokenMintAddress);

  // 获取用户的所有 Token Accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
    mint: tokenMintPublicKey, // 筛选出特定 Mint 的账户
  });
  console.log(JSON.stringify(tokenAccounts));
  if (tokenAccounts.value.length === 0) {
    console.log("用户没有此代币的账户");
    return 0;
  }
  return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount; // 代币的可读余额
}

(async () => {
  const ownerAddress = "626YjgbR1kS37oyjGzNcM4opF7RbcyzqbQof6Ejcts8k"; // 替换为用户地址
  const tokenMintAddress = "F7cn8daUd7TLHt27ShMxyNKtDnstoVRFWGMp3dQ5kCuK"; // 替换为代币的 Mint 地址

  const balance = await getSplTokenBalance(ownerAddress, tokenMintAddress);
  console.log(`代币余额: ${balance}`);
})();
