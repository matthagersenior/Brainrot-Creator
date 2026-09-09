const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=300',
};

const BLOCKED = [
  'shooting', 'shooter', 'murder', 'murdered', 'killed', 'death', 'dead', 'dies', 'died',
  'obituary', 'funeral', 'rape', 'assault', 'abuse', 'war', 'invasion', 'missile', 'bomb',
  'terror', 'terrorism', 'genocide', 'hostage', 'kidnap', 'missing person', 'earthquake',
  'hurricane', 'tornado', 'wildfire', 'flood', 'crash', 'accident', 'hospital', 'cancer',
  'suicide', 'overdose', 'election', 'president', 'senate', 'congress', 'governor',
  'prime minister', 'white house', 'supreme court', 'immigration raid', 'protest',
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function decodeXml(text) {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeTrend(value) {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  return normalized.trim().length > 1 && !BLOCKED.some(term => normalized.includes(term));
}

export async function onRequestGet() {
  try {
    const response = await fetch('https://trends.google.com/trending/rss?geo=US', {
      headers: {
        'user-agent': 'Brainrot-Creator/1.0',
        accept: 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) return json({ trends: [], source: 'unavailable' }, 200);
    const xml = await response.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
    const seen = new Set();
    const trends = [];

    for (const match of items) {
      const item = match[1];
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
      const title = decodeXml(titleMatch?.[1] || '');
      const key = title.toLowerCase();
      if (!title || seen.has(key) || !safeTrend(title)) continue;
      seen.add(key);
      trends.push(title.slice(0, 90));
      if (trends.length >= 16) break;
    }

    return json({ trends, source: 'google-trends-rss' });
  } catch {
    return json({ trends: [], source: 'unavailable' }, 200);
  }
}
