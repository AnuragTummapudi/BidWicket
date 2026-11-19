import { NextResponse } from 'next/server';

// Server-side proxy so the Giphy key never reaches the browser.
export async function GET(request) {
  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ data: [] });

  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 100);
  const path = q ? 'search' : 'trending';
  const url = `https://api.giphy.com/v1/gifs/${path}?api_key=${key}&limit=18&rating=pg-13${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return NextResponse.json({ data: Array.isArray(json?.data) ? json.data : [] });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
