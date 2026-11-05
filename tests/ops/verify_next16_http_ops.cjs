const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function testHttpOperations() {
  const baseUrl = 'http://localhost:3001';
  console.log(`[HTTP Test] Starting Next.js 16 live HTTP verification on Node ${process.version}...`);

  // Step 1: Health check
  console.log('[Step 1] Probing /api/health...');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  if (!healthRes.ok) throw new Error(`Health check failed: ${healthRes.status}`);
  const healthJson = await healthRes.json();
  console.log('✓ Health check passed:', healthJson);

  // Step 2: Login to Payload Admin API
  console.log('[Step 2] Logging in to Payload via /api/users/login...');
  const loginRes = await fetch(`${baseUrl}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sharp-test-admin@mwheba.com',
      password: 'TestPassword123!Secure',
    }),
  });

  if (!loginRes.ok) {
    const errText = await loginRes.text();
    throw new Error(`Login failed with status ${loginRes.status}: ${errText}`);
  }

  const loginJson = await loginRes.json();
  const token = loginJson.token;
  const cookieHeader = loginRes.headers.get('set-cookie');
  console.log(`✓ Login succeeded for user: ${loginJson.user.email} (ID: ${loginJson.user.id}, Roles: ${loginJson.user.roles.join(', ')})`);

  // Step 3: Authenticated API request (/api/users/me)
  console.log('[Step 3] Verifying authenticated request to /api/users/me...');
  const meRes = await fetch(`${baseUrl}/api/users/me`, {
    headers: {
      Authorization: `JWT ${token}`,
    },
  });

  if (!meRes.ok) throw new Error(`/api/users/me failed: ${meRes.status}`);
  const meJson = await meRes.json();
  if (meJson.user?.email !== 'sharp-test-admin@mwheba.com') {
    throw new Error(`Unexpected user in /api/users/me: ${JSON.stringify(meJson)}`);
  }
  console.log('✓ Authenticated API identity verified:', meJson.user.email);

  // Step 4: Generate an authentic image using sharp and upload via multipart/form-data
  console.log('[Step 4] Generating image buffer with sharp and uploading via HTTP to /api/media...');
  const imageWidth = 350;
  const imageHeight = 250;
  const pngBuffer = await sharp({
    create: {
      width: imageWidth,
      height: imageHeight,
      channels: 4,
      background: { r: 18, g: 38, b: 58, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const filename = `http_test_upload_${Date.now()}.png`;

  // Construct multipart/form-data body
  const formData = new FormData();
  const blob = new Blob([pngBuffer], { type: 'image/png' });
  formData.append('file', blob, filename);
  formData.append('alt', 'صورة فحص الرفع المباشر عبر HTTP في Next 16');
  formData.append('mediaType', 'public');

  const uploadRes = await fetch(`${baseUrl}/api/media`, {
    method: 'POST',
    headers: {
      Authorization: `JWT ${token}`,
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    const uploadErr = await uploadRes.text();
    throw new Error(`File upload failed with status ${uploadRes.status}: ${uploadErr}`);
  }

  const uploadJson = await uploadRes.json();
  const createdDoc = uploadJson.doc;
  console.log(`✓ Upload succeeded! Asset ID: ${createdDoc.id}, filename: ${createdDoc.filename}`);
  console.log(`✓ Extracted Dimensions: ${createdDoc.width}x${createdDoc.height}, MIME: ${createdDoc.mimeType}, Size: ${createdDoc.filesize} bytes`);

  if (Number(createdDoc.width) !== imageWidth || Number(createdDoc.height) !== imageHeight) {
    throw new Error(`Dimension mismatch: expected ${imageWidth}x${imageHeight}, got ${createdDoc.width}x${createdDoc.height}`);
  }

  // Step 5: Read back the document via GET /api/media/:id
  console.log(`[Step 5] Reading uploaded media doc via GET /api/media/${createdDoc.id}...`);
  const getDocRes = await fetch(`${baseUrl}/api/media/${createdDoc.id}`, {
    headers: { Authorization: `JWT ${token}` },
  });
  if (!getDocRes.ok) throw new Error(`GET /api/media/${createdDoc.id} failed: ${getDocRes.status}`);
  const fetchedDoc = await getDocRes.json();
  console.log('✓ Successfully fetched asset via REST API. Title/Alt:', fetchedDoc.alt);

  // Step 6: Cleanup the test asset via DELETE /api/media/:id
  console.log(`[Step 6] Cleaning up test asset via DELETE /api/media/${createdDoc.id}...`);
  const deleteRes = await fetch(`${baseUrl}/api/media/${createdDoc.id}`, {
    method: 'DELETE',
    headers: { Authorization: `JWT ${token}` },
  });
  if (!deleteRes.ok) throw new Error(`DELETE failed: ${deleteRes.status}`);
  console.log('✓ Successfully deleted test asset.');

  console.log('================================================================');
  console.log('ALL NEXT.JS 16 LIVE HTTP OPERATIONS PASSED WITH ZERO ERRORS!');
  console.log('Tested without browser automation using native HTTP/fetch.');
  console.log('================================================================');
}

testHttpOperations().catch((err) => {
  console.error('HTTP Test Failure:', err);
  process.exit(1);
});
