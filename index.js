const TronWeb = require('tronweb');
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Setup TronWeb (ensure PRIVATE_KEY is in .env)
const tronWeb = new TronWeb({
  fullHost: 'https://nile.trongrid.io',
  privateKey: process.env.PRIVATE_KEY
});

// USDT contract on Nile testnet
const USDT_CONTRACT = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';

// 🏠 Home
app.get('/', (req, res) => {
  res.send('✅ TetherFlash Backend is running successfully');
});

// 📦 Send USDT TRC20
app.post('/send-usdt', async (req, res) => {
  try {
    const recipient = req.body.recipient || req.body.to || req.body.address;
    const amountRaw = req.body.amount || req.body.value;
    if (!recipient || !amountRaw) {
      return res.status(400).json({ success: false, error: 'recipient and amount required' });
    }

    // Convert to 6-decimal USDT units
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

    console.log(`🚀 Sending ${amountRaw} USDT to ${recipient}`);

    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const tx = await contract.methods.transfer(recipient, amount).send({ feeLimit: 1000000000 });

    console.log('Transaction result:', tx);

    let txHash = typeof tx === 'string' ? tx : tx.txID || tx.txId || null;
    if (!txHash) txHash = tx?.transaction?.txID || tx?.result?.txID || 'unknown';

    res.json({ success: true, txHash });
  } catch (err) {
    console.error('❌ Send error:', err.message || err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// 💰 Balance check
app.get('/balance', async (req, res) => {
  try {
    const address = tronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY);
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const balance = await contract.methods.balanceOf(address).call();
    const readable = Number(balance) / 1_000_000;
    res.json({ success: true, balance: readable });
  } catch (err) {
    console.error('❌ Balance error:', err.message || err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// ✉️ Send email
app.post('/send-email', async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    if (!to || !subject || !message) {
      return res.status(400).json({ success: false, error: 'to, subject, message required' });
    }

    // Gmail SMTP setup
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // your Gmail address
        pass: process.env.EMAIL_PASS  // Gmail App Password (not normal password)
      }
    });

    const mailOptions = {
      from: `"TetherFlash" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
          <img src="https://i.ibb.co/9mySM5Hr/easemoni-ic-security-count-bg.png" width="100" style="margin-bottom: 10px;">
          <h2 style="color:#2196F3;">${subject}</h2>
          <p>${message}</p>
          <p style="font-size:12px; color:gray;">This message was sent automatically from TetherFlash.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('📧 Email sent to', to);

    res.json({ success: true, message: 'Email sent' });
  } catch (err) {
    console.error('Email error:', err.message || err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));