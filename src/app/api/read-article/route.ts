import { NextResponse } from 'next/server';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status}`);
    }

    const html = await response.text();
    
    // We must pass the original URL to JSDOM so relative image links resolve correctly
    const doc = new JSDOM(html, { url });
    
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article) {
      throw new Error('Readability failed to parse the article');
    }

    return NextResponse.json({
      title: article.title,
      byline: article.byline,
      content: article.content, // HTML string
      textContent: article.textContent, // Plain text
      siteName: article.siteName,
      originalUrl: url
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400'
      }
    });

  } catch (error: any) {
    console.error('Article Extraction Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
