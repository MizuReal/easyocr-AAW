const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export async function uploadDataCardForOCR(asset) {
  if (!asset) {
    throw new Error('No image asset supplied for OCR');
  }

  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName || `data-card-${Date.now()}.jpg`,
    type: asset.mimeType || 'image/jpeg',
  });

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/ocr/data-card`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
    });
  } catch (networkError) {
    throw new Error(
      `Network request failed while contacting ${API_BASE_URL}. ` +
        'Ensure the backend is running and EXPO_PUBLIC_API_URL matches that host. ' +
        `Details: ${networkError?.message || 'unknown error'}`,
    );
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message ||
        `OCR service responded with ${response.status}. Verify the backend logs for /ocr/data-card.`,
    );
  }

  return response.json();
}

/**
 * Validate fiducial markers in an image for real-time capture guidance.
 * This is a lightweight endpoint optimized for repeated calls during camera preview.
 * 
 * @param {Object} asset - Image asset with uri property
 * @returns {Promise<{detected: number, corners: Object, quality: number, ready: boolean}>}
 */
export async function validateFiducials(asset) {
  if (!asset?.uri) {
    throw new Error('No image asset supplied for fiducial validation');
  }

  const formData = new FormData();
  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName || `fiducial-check-${Date.now()}.jpg`,
    type: asset.mimeType || 'image/jpeg',
  });

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/fiducial/validate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      body: formData,
    });
  } catch (networkError) {
    // Silently fail for validation - it's not critical
    console.debug('[fiducial] Network error during validation:', networkError?.message);
    return { detected: 0, corners: {}, quality: 0, ready: false };
  }

  if (!response.ok) {
    console.debug('[fiducial] Validation failed with status:', response.status);
    return { detected: 0, corners: {}, quality: 0, ready: false };
  }

  return response.json();
}

export async function submitWaterSample(sample) {
  const response = await fetch(`${API_BASE_URL}/predict/potability`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sample),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = payload?.detail || payload?.message;
    throw new Error(detail || 'Unable to submit water sample.');
  }

  return response.json();
}

export { API_BASE_URL };
