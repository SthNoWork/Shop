require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Load Cloudinary credentials from env. Set these in a local .env file.
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';

if (!CLOUDINARY_API_SECRET || !CLOUDINARY_API_KEY || !CLOUDINARY_CLOUD_NAME) {
  console.warn('Warning: Cloudinary env vars not fully set. Ensure CLOUDINARY_API_SECRET, CLOUDINARY_API_KEY, CLOUDINARY_CLOUD_NAME are provided.');
}

// Helper: build signature for Cloudinary signed upload
function buildSignature(paramsToSign) {
  // paramsToSign: object of key->value (strings/numbers). Cloudinary requires keys sorted alphabetically.
  const keys = Object.keys(paramsToSign).filter(k => paramsToSign[k] !== undefined && paramsToSign[k] !== null && paramsToSign[k] !== '').sort();
  const toSign = keys.map(k => `${k}=${paramsToSign[k]}`).join('&');
  return crypto.createHash('sha1').update(toSign + CLOUDINARY_API_SECRET).digest('hex');
}

// POST /sign
// Body: { params: { optional params to include in signature, e.g. eager, folder, public_id } }
// Returns: { signature, timestamp, api_key, cloud_name }
app.post('/sign', (req, res) => {
  try {
    const requested = req.body && req.body.params ? req.body.params : {};
    // Always include timestamp
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = Object.assign({}, requested, { timestamp });

    const signature = buildSignature(paramsToSign);

    res.json({ signature, timestamp, api_key: CLOUDINARY_API_KEY, cloud_name: CLOUDINARY_CLOUD_NAME });
  } catch (err) {
    console.error('Sign error', err);
    res.status(500).json({ error: 'Failed to generate signature' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cloudinary sign server listening on port ${PORT}`);
});
