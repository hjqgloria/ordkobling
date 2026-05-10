export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word")?.toLowerCase().trim();

  if (!word || word.length < 2) {
    return Response.json({ valid: false });
  }

  try {
    const res = await fetch(
      `https://ord.uib.no/api/articles?w=${encodeURIComponent(word)}&dict=bm,nn&scope=ei`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();
    // Sometimes the API returns empty arrays or nulls if no articles exist
    const hasBm = Array.isArray(data.articles?.bm) && data.articles.bm.length > 0;
    const hasNn = Array.isArray(data.articles?.nn) && data.articles.nn.length > 0;
    return Response.json({ valid: hasBm || hasNn });
  } catch {
    return Response.json({ valid: false }, { status: 500 });
  }
}