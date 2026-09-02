import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const rssSources = [
  { name: 'প্রথম আলো', url: 'https://www.prothomalo.com/stories.rss' },
  { name: 'বিডিনিউজ টোয়েন্টিফোর', url: 'https://bdnews24.com/?widgetName=rssfeed&widgetId=1150&getXmlFeed=true' },
  { name: 'জাগো নিউজ', url: 'https://www.jagonews24.com/rss/rss.xml' },
  { name: 'যুগান্তর', url: 'https://www.jugantor.com/feed/rss.xml' },
  { name: 'কালের কণ্ঠ', url: 'https://www.kalerkantho.com/rss.xml' },
  { name: 'বাংলানিউজ২৪', url: 'https://www.banglanews24.com/rss/rss.xml' },
  { name: 'বিডি২৪লাইভ', url: 'https://www.bd24live.com/feed' },
  { name: 'রাইজিংবিডি', url: 'https://www.risingbd.com/rss/rss.xml' },
  { name: 'বাংলা ট্রিবিউন', url: 'https://www.banglatribune.com/feed' },
  { name: 'বিডি-জার্নাল', url: 'https://www.bd-journal.com/feed/latest-rss' },
  { name: 'The Daily Star', url: 'https://www.thedailystar.net/frontpage/rss.xml' },
  { name: 'ঢাকা পোস্ট', url: 'https://www.dhakapost.com/rss' },
  { name: 'নয়া দিগন্ত', url: 'https://www.dailynayadiganta.com/rss.xml' },
  { name: 'মানবজমিন', url: 'https://mzamin.com/rss.xml' },
  { name: 'বাংলাদেশ প্রতিদিন', url: 'https://www.bd-pratidin.com/rss.xml' },
  { name: 'সমকাল', url: 'https://samakal.com/rss.xml' },
  { name: 'The Financial Express', url: 'https://thefinancialexpress.com.bd/rss' },
  { name: 'New Age', url: 'https://www.newagebd.net/rss' }
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    
    const parser = new Parser({
      customFields: {
        item: [
          ['media:content', 'mediaContent'],
          ['enclosure', 'enclosure'],
          ['category', 'categoryList', {keepArray: true}]
        ]
      }
    });

    // Fetch all feeds concurrently, timeout each after 5 seconds to prevent stalling
    const feedPromises = rssSources.map(async (source) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        // Use fetch directly to apply timeout and bypass potential rss-parser fetch issues
        const response = await fetch(source.url, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' } // some RSS feeds block default agents
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const xml = await response.text();
        const feed = await parser.parseString(xml);
        
        return feed.items.map((item, index) => {
          let image_url = null;
          if (item.enclosure && item.enclosure.url) {
            image_url = item.enclosure.url;
          } else if (item.mediaContent && item.mediaContent['$'] && item.mediaContent['$'].url) {
            image_url = item.mediaContent['$'].url;
          } else if (item.content) {
            const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch) image_url = imgMatch[1];
          }

          // Generate a string combining title, categories, and link for keyword filtering
          const searchString = `${item.title || ''} ${item.link || ''} ${
            item.categoryList ? JSON.stringify(item.categoryList) : ''
          }`.toLowerCase();

          return {
            article_id: item.guid || (item as any).id || `${source.name}-${index}`,
            title: item.title || '',
            link: item.link || '',
            pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
            source_name: source.name,
            source_icon: null,
            image_url: image_url,
            _searchString: searchString
          };
        });
      } catch (e) {
        console.error(`Failed to fetch ${source.name}:`, e);
        return [];
      }
    });

    const settledResults = await Promise.allSettled(feedPromises);
    let allNews: any[] = [];
    
    for (const result of settledResults) {
      if (result.status === 'fulfilled') {
        allNews = allNews.concat(result.value);
      }
    }

    // Filter by category if requested
    if (category) {
      let keywords: string[] = [];
      const catLower = category.toLowerCase();
      
      if (catLower === 'sports') {
        keywords = ['sports', 'khela', 'খেলা', 'খেলাধুলা', 'ক্রিকেট', 'ফুটবল', 'cricket', 'football', 'messi', 'ronaldo', 'bcbb'];
      } else if (catLower === 'tech') {
        keywords = ['tech', 'technology', 'science', 'বিজ্ঞান', 'প্রযুক্তি', 'আইটি', 'তথ্যপ্রযুক্তি'];
      } else if (catLower === 'business') {
        keywords = ['business', 'economy', 'finance', 'বাণিজ্য', 'অর্থনীতি', 'শেয়ারবাজার', 'ব্যাংক', 'অর্থ'];
      }

      if (keywords.length > 0) {
        allNews = allNews.filter(item => {
          return keywords.some(keyword => item._searchString.includes(keyword));
        });
      }
    }

    // Remove the temporary search string before returning
    allNews = allNews.map(item => {
      const { _searchString, ...rest } = item;
      return rest;
    });

    // Sort by pubDate descending (newest first)
    allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    // Cap at 100 items for performance
    const limitedNews = allNews.slice(0, 100);

    return NextResponse.json({ status: 'success', results: limitedNews }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30'
      }
    });
  } catch (error) {
    console.error('Error in RSS aggregation:', error);
    return NextResponse.json({ status: 'error', results: [] }, { status: 500 });
  }
}
