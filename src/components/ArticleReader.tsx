import React, { useEffect, useState } from "react";
import { Loader2, FileWarning, ArrowLeft } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";

interface ArticleReaderProps {
  url: string;
  onClose: () => void;
}

export default function ArticleReader({ url, onClose }: ArticleReaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<any>(null);

  useEffect(() => {
    async function loadArticle() {
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch(`/api/read-article?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to load article");
        }
        
        // Enhance security for external links
        const cleanHtml = DOMPurify.sanitize(data.content, { 
          ADD_ATTR: ['target'] 
        });
        
        // We can manipulate the HTML slightly if needed to ensure targets are _blank
        // But for now sanitize is enough
        data.cleanHtml = cleanHtml;
        setArticle(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    
    if (url) {
      loadArticle();
    }
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 bg-[#121212] flex flex-col h-[100dvh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="h-14 shrink-0 border-b border-white/10 flex items-center justify-between px-4 bg-[#1a1a1a]">
        <div className="text-gray-400 text-xs font-medium truncate max-w-[200px] sm:max-w-[400px]">
          globalgeniusai
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <button 
            onClick={onClose}
            className="px-3 py-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors flex items-center gap-2"
            title="Go Back"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto scroll-smooth hide-scrollbar bg-[#0f0f0f]">
        <div className="w-full max-w-3xl mx-auto px-5 py-8 sm:py-12 pb-32">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-400">
              <Loader2 className="animate-spin mb-4 text-blue-500" size={32} />
              <p>Extracting clean reading mode...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-red-400 gap-3 text-center">
              <FileWarning size={48} />
              <p className="font-medium text-lg">Unable to extract reading mode</p>
              <p className="text-sm text-red-400/80 max-w-md">{error}</p>
              <button 
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={16} /> Go Back
              </button>
            </div>
          ) : article ? (
            <div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-100 mb-4 sm:mb-6 leading-tight">
                {article.title}
              </h1>
              
              {article.byline && (
                <div className="text-gray-400 font-medium mb-8 pb-8 border-b border-white/10">
                  {article.byline}
                </div>
              )}
              
              {/* Custom CSS for article body to mimic Typography plugin */}
              <style dangerouslySetInnerHTML={{__html: `
                .article-body {
                  color: #d1d5db;
                  font-size: 1.125rem;
                  line-height: 1.8;
                }
                .article-body p { margin-bottom: 1.5em; }
                .article-body img { 
                  max-width: 100%; 
                  height: auto; 
                  border-radius: 0.75rem; 
                  margin: 2em auto; 
                  display: block; 
                }
                .article-body a { color: #60a5fa; text-decoration: none; }
                .article-body a:hover { text-decoration: underline; }
                .article-body h2 { color: #f3f4f6; font-size: 1.5rem; font-weight: bold; margin-top: 2em; margin-bottom: 1em; }
                .article-body h3 { color: #f3f4f6; font-size: 1.25rem; font-weight: bold; margin-top: 1.5em; margin-bottom: 1em; }
                .article-body blockquote { 
                  border-left: 4px solid #3b82f6; 
                  padding-left: 1em; 
                  font-style: italic; 
                  color: #9ca3af;
                  background: rgba(255,255,255,0.02);
                  padding: 1em;
                  border-radius: 0 0.5rem 0.5rem 0;
                }
                .article-body ul, .article-body ol { padding-left: 1.5em; margin-bottom: 1.5em; }
                .article-body li { margin-bottom: 0.5em; }
                .article-body figure { margin: 2em 0; }
                .article-body figcaption { text-align: center; font-size: 0.875rem; color: #9ca3af; margin-top: 0.5em; }
              `}} />
              
              <div 
                className="article-body font-serif"
                dangerouslySetInnerHTML={{ __html: article.cleanHtml }}
              />
              
              <div className="mt-16 pt-8 border-t border-white/10 text-center">
                <button 
                  onClick={onClose}
                  className="px-6 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-full transition-colors inline-flex items-center gap-2 text-sm"
                >
                  <ArrowLeft size={14} /> Back to News
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
