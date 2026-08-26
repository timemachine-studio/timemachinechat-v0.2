import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedRequestUser } from './_lib/auth.js';
import { applyCors, hasAcceptableOrigin, isSameOriginSubresource } from './_lib/cors.js';

const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasAcceptableOrigin(req)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  // These URLs are loaded as <img src> / <audio src>, so they cannot carry an
  // Authorization header. The gate is the browser's own fetch metadata plus the
  // origin allowlist — see isSameOriginSubresource. A bearer token is still
  // accepted for non-browser callers we control.
  const bearer = await getAuthenticatedRequestUser(req);
  if (!bearer && !isSameOriginSubresource(req)) {
    return res.status(401).json({ error: 'Not authorized' });
  }

  try {
    const { prompt, duration = '60', seed } = req.query;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid prompt parameter' });
    }

    const url = new URL(`https://gen.pollinations.ai/audio/${encodeURIComponent(prompt)}`);
    url.searchParams.set('model', 'acestep');
    url.searchParams.set('duration', typeof duration === 'string' ? duration : '60');
    url.searchParams.set('key', POLLINATIONS_API_KEY);
    
    if (seed && typeof seed === 'string') {
      url.searchParams.set('seed', seed);
    }

    const debugUrl = url.toString().replace(/key=[^&]+/, 'key=***');
    console.log('Pollinations request URL (music):', debugUrl);

    // Fetch the audio from Pollinations server-side
    const audioResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'audio/*'
      }
    });

    if (!audioResponse.ok) {
      const errorText = await audioResponse.text().catch(() => '');
      return res.status(502).json({
        error: 'Failed to generate audio',
        pollinationsStatus: audioResponse.status,
        pollinationsError: errorText,
      });
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Length', audioBuffer.byteLength);

    return res.status(200).send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('Audio proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
