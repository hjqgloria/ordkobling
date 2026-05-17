export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.toLowerCase().trim();

  // Validation
  if (!word || word.length < 2 || word.length > 20) {
    return Response.json({ valid: false });
  }
  if (!/^[a-zæøå]+$/i.test(word)) {
    return Response.json({ valid: false });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const API_BASE = process.env.DICTIONARY_API_URL || 'https://ord.uib.no/api/articles';
    
    const res = await fetch(
      `${API_BASE}?w=${encodeURIComponent(word)}&dict=bm,nn&scope=ei`,
      { 
        next: { revalidate: 86400 },
        signal: controller.signal 
      }
    );
    clearTimeout(timeoutId);
    
    const data = await res.json();
    const hasBm = Array.isArray(data.articles?.bm) && data.articles.bm.length > 0;
    const hasNn = Array.isArray(data.articles?.nn) && data.articles.nn.length > 0;
    return Response.json({ valid: hasBm || hasNn });
  } catch (error) {
    console.error('Dictionary validation error:', error);
    return Response.json({ valid: false });
  }
}