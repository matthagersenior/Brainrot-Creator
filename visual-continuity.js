(() => {
  const nativeFetch = window.fetch.bind(window);
  let generationEpoch = 0;
  let anchorReferencePromise = null;

  function requestPath(input) {
    try {
      const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
      return new URL(raw, window.location.href).pathname;
    } catch {
      return '';
    }
  }

  function requestMethod(input, init) {
    return String(init?.method || input?.method || 'GET').toUpperCase();
  }

  function loadReferenceImage(dataURI) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('reference image decode failed'));
      image.src = dataURI;
    });
  }

  async function makeReferenceDataURI(dataURI) {
    if (!String(dataURI || '').startsWith('data:image/')) return null;
    const image = await loadReferenceImage(dataURI);
    const targetWidth = 256;
    const targetHeight = 455;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) return null;

    const targetRatio = targetWidth / targetHeight;
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;
    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = image.naturalWidth / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }

    context.drawImage(image, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  window.fetch = async function continuityAwareFetch(input, init = {}) {
    const path = requestPath(input);
    const method = requestMethod(input, init);

    if (path === '/api/story' && method === 'POST') {
      generationEpoch += 1;
      anchorReferencePromise = null;
      return nativeFetch(input, init);
    }

    if (path !== '/api/visualize' || method !== 'POST') {
      return nativeFetch(input, init);
    }

    const epoch = generationEpoch;

    // Existing app workers request scene 1 first. Hold every later visual request
    // until that first response becomes a small identity reference image.
    if (!anchorReferencePromise) {
      let resolveAnchor;
      anchorReferencePromise = new Promise(resolve => { resolveAnchor = resolve; });
      try {
        const response = await nativeFetch(input, init);
        response.clone().json()
          .then(data => makeReferenceDataURI(data?.dataURI))
          .then(reference => resolveAnchor(epoch === generationEpoch ? reference : null))
          .catch(() => resolveAnchor(null));
        return response;
      } catch (error) {
        resolveAnchor(null);
        throw error;
      }
    }

    const referenceDataURI = await anchorReferencePromise;
    if (!referenceDataURI || epoch !== generationEpoch) {
      return nativeFetch(input, init);
    }

    try {
      const payload = JSON.parse(String(init?.body || '{}'));
      payload.referenceDataURI = referenceDataURI;
      return nativeFetch(input, {
        ...init,
        body: JSON.stringify(payload),
      });
    } catch {
      return nativeFetch(input, init);
    }
  };
})();
