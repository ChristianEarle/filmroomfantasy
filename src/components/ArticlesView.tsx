import { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Clock, ChevronRight, BookOpen, TrendingUp, Zap, Award, HelpCircle } from 'lucide-react';
import { api } from '../services/api';
import { ARTICLE_CATEGORIES } from '../data/articles';
import { SEO } from './SEO';

interface ArticlesViewProps {
  isDarkMode: boolean;
  onNavigate: (view: string) => void;
  onArticleSelect: (slug: string) => void;
}

interface ArticleData {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  author: string;
  readingTime: number;
  publishedAt: string | null;
}

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  strategy: Zap,
  rankings: TrendingUp,
  news: BookOpen,
  tools: Award,
  beginners: HelpCircle,
};

export function ArticlesView({ isDarkMode, onNavigate, onArticleSelect }: ArticlesViewProps) {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ articles: ArticleData[] }>('/articles');
      setArticles(data.articles);
    } catch {
      setError('Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const filteredArticles = useMemo(() => {
    if (selectedCategory === 'all') return articles;
    return articles.filter(a => a.category === selectedCategory);
  }, [selectedCategory, articles]);

  const featuredArticle = filteredArticles[0];
  const restArticles = filteredArticles.slice(1);

  return (
    <div className="max-w-5xl mx-auto px-1 sm:px-2">
      <SEO
        title="Fantasy Football Articles & Guides | FilmRoom"
        description="Expert fantasy football strategy guides, rankings analysis, waiver wire tips, and beginner resources. Learn how to win your fantasy league with data-driven insights."
        path="/articles"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            'name': 'Fantasy Football Articles & Guides',
            'description': 'Expert fantasy football strategy guides and analysis.',
            'url': 'https://filmroomfantasy.com/articles',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': [
              { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://filmroomfantasy.com' },
              { '@type': 'ListItem', 'position': 2, 'name': 'Articles', 'item': 'https://filmroomfantasy.com/articles' },
            ],
          },
        ]}
      />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Articles & Guides
            </h1>
          </div>
        </div>
        <p className={`text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Strategy guides, rankings breakdowns, and tips to help you win your fantasy league.
        </p>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : isDarkMode ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          All Articles
        </button>
        {Object.entries(ARTICLE_CATEGORIES).map(([key, { label, color }]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
              selectedCategory === key
                ? 'text-white shadow-md'
                : isDarkMode ? 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
            style={selectedCategory === key ? { background: color, boxShadow: `0 4px 14px ${color}40` } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}
      {error && (
        <div className={`text-center py-16 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          <p>{error}</p>
          <button onClick={fetchArticles} className="mt-3 text-blue-500 text-sm font-medium">Try again</button>
        </div>
      )}

      {/* Article list */}
      {!loading && !error && (
        <>
          {filteredArticles.length === 0 ? (
            <div className={`text-center py-16 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No articles yet</p>
              <p className="text-sm mt-1">Check back soon for new content!</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Featured article (first one, large card) */}
              {featuredArticle && (
                <FeaturedCard
                  article={featuredArticle}
                  isDarkMode={isDarkMode}
                  onClick={() => onArticleSelect(featuredArticle.slug)}
                />
              )}

              {/* Rest of articles in grid */}
              {restArticles.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {restArticles.map((article) => (
                    <ArticleCard
                      key={article.slug}
                      article={article}
                      isDarkMode={isDarkMode}
                      onClick={() => onArticleSelect(article.slug)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Internal links section */}
      <div className="mt-14 pt-8">
        <h2 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Explore FilmRoom Tools
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Player Rankings', view: 'Board' },
            { label: 'Trade Analyzer', view: 'TradeAnalyzer' },
            { label: 'Waiver Wire', view: 'Waivers' },
            { label: 'NFL Games', view: 'GameSlate' },
          ].map((link) => (
            <button
              key={link.view}
              onClick={() => onNavigate(link.view)}
              className={`px-4 py-3.5 rounded-lg text-sm font-medium text-left transition-colors ${
                isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {link.label} &rarr;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeaturedCard({ article, isDarkMode, onClick }: { article: ArticleData; isDarkMode: boolean; onClick: () => void }) {
  const category = ARTICLE_CATEGORIES[article.category as keyof typeof ARTICLE_CATEGORIES];
  const CategoryIcon = CATEGORY_ICONS[article.category] || BookOpen;
  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  if (!category) return null;

  return (
    <article
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 ${
        isDarkMode
          ? 'bg-slate-900 border border-slate-700 hover:border-slate-500'
          : 'bg-white border border-slate-200 hover:shadow-lg hover:shadow-slate-200/50'
      }`}
    >
      {/* Gradient accent bar */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(to right, ${category.color}, ${category.color}88)` }}
      />
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-5">
          {/* Category icon */}
          <div
            className="hidden sm:flex w-14 h-14 rounded-xl items-center justify-center flex-shrink-0"
            style={{ background: `${category.color}15` }}
          >
            <CategoryIcon className="w-7 h-7" style={{ color: category.color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <span
                className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md"
                style={{ color: category.color, background: `${category.color}15` }}
              >
                {category.label}
              </span>
              <span className={`text-xs flex items-center gap-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <Clock className="w-3 h-3" />
                {article.readingTime} min read
              </span>
            </div>

            <h2 className={`text-xl sm:text-2xl font-bold mb-2 leading-snug group-hover:text-blue-500 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {article.title}
            </h2>

            <p className={`text-sm sm:text-base leading-relaxed mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              {article.description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {article.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className={`flex items-center gap-1 text-sm font-semibold transition-colors ${isDarkMode ? 'text-blue-400 group-hover:text-blue-300' : 'text-blue-600 group-hover:text-blue-700'}`}>
                Read <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {date && (
              <p className={`text-xs mt-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                {article.author} &middot; {date}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function ArticleCard({ article, isDarkMode, onClick }: { article: ArticleData; isDarkMode: boolean; onClick: () => void }) {
  const category = ARTICLE_CATEGORIES[article.category as keyof typeof ARTICLE_CATEGORIES];
  const CategoryIcon = CATEGORY_ICONS[article.category] || BookOpen;
  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  if (!category) return null;

  return (
    <article
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl cursor-pointer transition-all duration-300 ${
        isDarkMode
          ? 'bg-slate-900 border border-slate-700 hover:border-slate-500'
          : 'bg-white border border-slate-200 hover:shadow-md hover:shadow-slate-200/50'
      }`}
    >
      {/* Gradient accent */}
      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(to right, ${category.color}, ${category.color}66)` }}
      />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${category.color}15` }}
          >
            <CategoryIcon className="w-4 h-4" style={{ color: category.color }} />
          </div>
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: category.color }}
          >
            {category.label}
          </span>
          <span className={`text-[11px] ml-auto ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            {date}
          </span>
        </div>

        <h2 className={`text-base font-bold mb-1.5 leading-snug group-hover:text-blue-500 transition-colors line-clamp-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {article.title}
        </h2>

        <p className={`text-sm leading-relaxed line-clamp-2 mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          {article.description}
        </p>

        <div className="flex items-center justify-between">
          <span className={`text-xs flex items-center gap-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <Clock className="w-3.5 h-3.5" />
            {article.readingTime} min
          </span>
          <span className={`text-xs font-semibold flex items-center gap-1 transition-colors ${isDarkMode ? 'text-blue-400 group-hover:text-blue-300' : 'text-blue-600 group-hover:text-blue-700'}`}>
            Read <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </article>
  );
}
