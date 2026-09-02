"use client";
import React, { useEffect, useState } from "react";
import { Headphones, Share2, MoreHorizontal, Globe, Loader2, FileWarning } from "lucide-react";
import ArticleReader from "./ArticleReader";

type NewsArticle = {
  article_id: string;
  title: string;
  link: string;
  image_url: string | null;
  source_icon: string | null;
  source_name: string;
  pubDate: string;
};

export default function NewsSection() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState("For You");
  const [now, setNow] = useState<number>(0);
  const [liveTime, setLiveTime] = useState("");
  const [selectedArticleUrl, setSelectedArticleUrl] = useState<string | null>(null);

  const tabs = ["For You", "Top Stories", "Tech & Science", "Business", "Sports"];

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    
    const updateTime = () => {
      setLiveTime(new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Dhaka", hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateTime();
    const timeInterval = setInterval(updateTime, 1000);
    
    return () => {
      clearInterval(timer);
      clearInterval(timeInterval);
    };
  }, []);

  useEffect(() => {
    async function fetchNews() {
      try {
        setLoading(true);
        setError(false);
        let category = "";
        if (activeTab === "Tech & Science") category = "tech";
        if (activeTab === "Business") category = "business";
        if (activeTab === "Sports") category = "sports";

        const catParam = category ? `?category=${category}` : "";

        // Fetching Aggregated RSS feeds via backend proxy
        const res = await fetch(`/api/news${catParam}`);
        const data = await res.json();
        
        if (data.status === "success" && data.results) {
          setNews(data.results);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, [activeTab]);

  const getTimeAgo = (dateStr: string) => {
    if (!now) return "";
    const date = new Date(dateStr + " UTC");
    const diff = Math.floor((now - date.getTime()) / 60000); // diff in minutes
    if (diff < 60) return `${diff} min ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours} hr ago`;
    return `${Math.floor(hours / 24)} days ago`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 flex flex-col items-center pb-12">
      
      {/* Bangladesh Live Time */}
      <div className="w-full flex items-center justify-between px-4 mb-4 border border-white/10 bg-[#1a1a1a] rounded-xl py-3 mx-2 max-w-[calc(100%-1rem)]">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
           <span className="text-gray-300 text-sm font-semibold">Bangladesh Live</span>
        </div>
        <span className="text-white font-bold tracking-wider text-sm">{liveTime}</span>
      </div>

      {/* Tabs */}
      <div className="w-full flex items-center gap-2 overflow-x-auto hide-scrollbar pb-3 mb-2 px-2">
        {tabs.map((tab) => (
          <button type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-white/20 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* News Feed */}
      <div className="w-full flex flex-col gap-6 px-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="animate-spin mr-2" size={24} />
            Loading live updates...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-10 text-red-400 gap-2">
            <FileWarning size={32} />
            <p>Failed to load news. Please check your network or API limit.</p>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center text-gray-500 py-10">
            No recent news available for this category.
          </div>
        ) : (
          news.map((item) => (
            <div key={item.article_id} className="w-full bg-black/20 border border-white/5 rounded-2xl overflow-hidden hover:bg-[#252525] transition-colors cursor-pointer" onClick={() => setSelectedArticleUrl(item.link)}>
              {/* Image */}
              {item.image_url && (
                <div className="w-full h-48 sm:h-56 overflow-hidden bg-[#151515]">
                  <img src={item.image_url} alt={item.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                </div>
              )}
              
              {/* Content */}
              <div className="p-4 sm:p-5">
                <h3 className="text-white font-bold text-lg leading-snug line-clamp-3 mb-3">
                  {item.title}
                </h3>
                
                {/* Footer metadata */}
                <div className="flex flex-wrap items-center justify-between text-xs text-gray-400 mt-2 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 font-medium truncate max-w-[150px]">
                      {item.source_icon ? (
                         <img src={item.source_icon} className="w-4 h-4 rounded-full" alt="" />
                      ) : (
                         <Globe size={14} className="text-blue-400" />
                      )}
                      <span className="truncate">globalgeniusai</span>
                    </div>
                    <span className="text-gray-600">•</span>
                    <span>{getTimeAgo(item.pubDate)}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 sm:gap-4">
                    <button type="button" onClick={(e) => { e.stopPropagation(); }} className="hover:text-white flex items-center gap-1.5 transition-colors" title="Listen">
                      <Headphones size={15} />
                      <span className="hidden sm:inline">Listen</span>
                    </button>
                    <div className="w-px h-3 bg-gray-600"></div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.link); alert("Link copied!"); }} className="hover:text-white transition-colors" title="Share">
                      <Share2 size={15} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); }} className="hover:text-white transition-colors" title="More Options">
                      <MoreHorizontal size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Article Reader Overlay */}
      {selectedArticleUrl && (
        <ArticleReader 
          url={selectedArticleUrl} 
          onClose={() => setSelectedArticleUrl(null)} 
        />
      )}
    </div>
  );
}
