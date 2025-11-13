const TronWeb = require('tronweb');
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

// Accept JSON and form data (Sketchware sends form data)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Setup TronWeb (PRIVATE_KEY must be set in environment)
const tronWeb = new TronWeb({
  fullHost: 'https://nile.trongrid.io',
  privateKey: process.env.PRIVATE_KEY
});

// USDT contract address on Nile testnet
const USDT_CONTRACT = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';

// Home route (optional)
app.get('/', (req, res) => {
  res.send('✅ TetherFlash Backend is running successfully');
});

// Send USDT (TRC20) route
app.post('/send-usdt', async (req, res) => {
  try {
    const recipient = req.body.recipient || req.body.to || req.body.address;
    const amountRaw = req.body.amount || req.body.value;
    if (!recipient || !amountRaw) {
      return res.status(400).json({ success:false, error: 'recipient and amount required' });
    }

    // tronWeb.toSun expects a number or numeric string in TRX units; for token decimals we'll use contract API
    // USDT (TRC20) on Nile uses 6 decimals. We'll convert decimal input (e.g., "1.5") to token units.
    function toTokenUnits(amount) {
      const parts = String(amount).split('.');
      let whole = parts[0] || '0';
      let frac = parts[1] || '';
      while (frac.length < 6) frac += '0';
      if (frac.length > 6) frac = frac.slice(0, 6);
      const wholeBig = BigInt(whole) * BigInt(1_000_000);
      const fracBig = BigInt(frac || '0');
      return (wholeBig + fracBig).toString();
    }

    const amount = toTokenUnits(amountRaw);

    console.log('Sending', amountRaw, 'USDT ->', recipient);

    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    // use methods.transfer for TRC20
    const tx = await contract.methods.transfer(recipient, amount).send({
      feeLimit: 1000000000
    });

    console.log('Transaction result:', tx);
    // Normalize tx hash
    let txHash = null;
    if (typeof tx === 'string') txHash = tx;
    else if (tx && tx.transaction && tx.transaction.txID) txHash = tx.transaction.txID;
    else if (tx && (tx.txId || tx.txID)) txHash = tx.txId || tx.txID;
    else if (tx && tx.result && tx.result.txID) txHash = tx.result.txID;

    return res.json({ success: true, txHash });
  } catch (err) {
    console.error('Send error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: (err && err.message) || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
