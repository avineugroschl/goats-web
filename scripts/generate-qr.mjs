import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url =
  'https://goatssportsapp.com/download?utm_source=website&utm_medium=qr';
const outputPath = join(__dirname, '..', 'public', 'qr-download.png');

async function generate() {
  // Generate QR code PNG
  await QRCode.toFile(outputPath, url, {
    errorCorrectionLevel: 'H',
    width: 600,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  console.log(`Generated: ${outputPath}`);

  // Verify by decoding the PNG back
  const buffer = readFileSync(outputPath);
  const png = PNG.sync.read(buffer);
  const code = jsQR(
    new Uint8ClampedArray(png.data),
    png.width,
    png.height,
  );

  if (!code) {
    console.error('FAIL: could not decode QR from generated PNG');
    process.exit(1);
  }

  if (code.data !== url) {
    console.error(`FAIL: decoded "${code.data}" but expected "${url}"`);
    process.exit(1);
  }

  console.log(`Verified: encodes "${code.data}"`);
  console.log(`Size: ${buffer.length} bytes, ${png.width}x${png.height}px`);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
