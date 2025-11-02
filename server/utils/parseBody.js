// utils/parseBody.js
export const parseBody = (req) => {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const contentType = req.headers['content-type'] || '';

        // 🧩 Handle multipart/form-data (file uploads)
        if (contentType.includes('multipart/form-data')) {
          // Return raw body for now — can be parsed later by a library like 'busboy' or 'formidable'
          resolve({ raw: body });
          return;
        }

        // 🧩 Handle JSON
        if (contentType.includes('application/json')) {
          resolve(JSON.parse(body || '{}'));
          return;
        }

        // 🧩 Handle URL-encoded forms
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(body);
          const obj = Object.fromEntries(params.entries());
          resolve(obj);
          return;
        }

        // 🧩 Fallback: return plain text or empty
        resolve(body ? { body } : {});
      } catch (err) {
        reject(err);
      }
    });

    req.on('error', (err) => reject(err));
  });
};
