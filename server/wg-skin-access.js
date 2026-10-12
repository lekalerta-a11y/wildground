// The server chooses the signature-verified wallet; caller-supplied addresses are ignored.
handlers.checkWgSkinAccess = function (_args, _context) {
  var mint = '3hZ7a3r5ghQPnceqyjj4KTKi3yneWeKMmSTsqxX4idos';
  var required = '100000000000'; // 100,000 WG, six decimals
  var user = server.ReadUserData(['Blockchain']);
  if (user.Success === false) throw new Error('Could not read verified wallet state.');
  var blockchain = user.Data ? user.Data.Blockchain : user.Blockchain;
  var login = blockchain && blockchain.LastWalletLogin;
  if (!login || login.NetworkID !== 'solana' || !login.Address) {
    return { unlocked: false, reason: 'wallet_required', mint: mint, required: required };
  }
  var response = server.HttpRequest({
    Method: 'POST', Url: 'https://api.mainnet-beta.solana.com',
    ContentType: 'application/json',
    Body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
      params: [login.Address, { mint: mint }, { encoding: 'jsonParsed', commitment: 'confirmed' }] }),
  });
  if (!response.Success || !response.Data || !response.Data.Ok || response.Data.BodyTooLarge) {
    throw new Error('WG balance service is unavailable. Please retry.');
  }
  var payload = JSON.parse(response.Data.Body);
  if (payload.error || !payload.result || !Array.isArray(payload.result.value)) {
    throw new Error('WG balance service returned an invalid response.');
  }
  // Decimal-string addition avoids any rounding and works in the CloudCode engine.
  var add = function (a, b) {
    var result = '', carry = 0, i = a.length - 1, j = b.length - 1;
    while (i >= 0 || j >= 0 || carry) {
      var n = (i >= 0 ? Number(a[i--]) : 0) + (j >= 0 ? Number(b[j--]) : 0) + carry;
      result = String(n % 10) + result;
      carry = Math.floor(n / 10);
    }
    return result.replace(/^0+(?=\d)/, '') || '0';
  };
  var balance = '0';
  payload.result.value.forEach(function (entry) {
    var info = entry && entry.account && entry.account.data && entry.account.data.parsed && entry.account.data.parsed.info;
    if (!info || info.mint !== mint || info.owner !== login.Address || !info.tokenAmount
      || info.tokenAmount.decimals !== 6 || typeof info.tokenAmount.amount !== 'string'
      || !/^\d+$/.test(info.tokenAmount.amount)) throw new Error('Invalid WG account.');
    balance = add(balance, info.tokenAmount.amount);
  });
  var unlocked = balance.length > required.length || (balance.length === required.length && balance >= required);
  return { unlocked: unlocked, address: login.Address, balance: balance, mint: mint, required: required };
};
