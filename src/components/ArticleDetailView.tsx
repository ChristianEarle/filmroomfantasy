import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Clock, User, ChevronRight, BookOpen, TrendingUp, Zap, Award, HelpCircle, Calendar } from 'lucide-react';
import { api } from '../services/api';
import { ARTICLE_CATEGORIES } from '../data/articles';
import { SEO } from './SEO';

interface ArticleDetailViewProps {
  slug: string;
  isDarkMode: boolean;
  onBack: () => void;
  onArticleSelect: (slug: string) => void;
  onNavigate: (view: string) => void;
}

interface ArticleData {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  readingTime: number;
  publishedAt: string | null;
  updatedAt: number;
}

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  strategy: Zap,
  rankings: TrendingUp,
  news: BookOpen,
  tools: Award,
  beginners: HelpCircle,
};

export function ArticleDetailView({ slug, isDarkMode, onBack, onArticleSelect, onNavigate }: ArticleDetailViewProps) {
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<ArticleData[]>([]);

  const fetchArticle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ article: ArticleData }>(`/articles/${slug}`);
      setArticle(data.article);

      // Fetch all published articles for "related" section
      const allData = await api.get<{ articles: ArticleData[] }>('/articles');
      const related = allData.articles
        .filter(a => a.slug !== slug && (
          a.category === data.article.category ||
          a.tags.some((t: string) => data.article.tags.includes(t))
        ))
        .slice(0, 3);
      setRelatedArticles(related);
    } catch {
      setError('Article not found');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <BookOpen className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`} />
        <h1 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Article Not Found</h1>
        <p className={`mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>The article you're looking for doesn't exist or has been removed.</p>
        <button onClick={onBack} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
          Back to Articles
        </button>
      </div>
    );
  }

  const category = ARTICLE_CATEGORIES[article.category as keyof typeof ARTICLE_CATEGORIES];
  const CategoryIcon = CATEGORY_ICONS[article.category] || BookOpen;
  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="max-w-3xl mx-auto px-1 sm:px-2">
      <SEO
        title={`${article.title} | FilmRoom`}
        description={article.description}
        path={`/articles/${article.slug}`}
        type="article"
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            'headline': article.title,
            'description': article.description,
            'author': { '@type': 'Organization', 'name': article.author },
            'publisher': { '@type': 'Organization', 'name': 'FilmRoom', 'url': 'https://filmroomfantasy.com' },
            'datePublished': article.publishedAt,
            'mainEntityOfPage': `https://filmroomfantasy.com/articles/${article.slug}`,
            'wordCount': article.content.split(/\s+/).length,
            'articleSection': category?.label,
            'keywords': article.tags.join(', '),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            'itemListElement': [
              { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://filmroomfantasy.com' },
              { '@type': 'ListItem', 'position': 2, 'name': 'Articles', 'item': 'https://filmroomfantasy.com/articles' },
              { '@type': 'ListItem', 'position': 3, 'name': article.title, 'item': `https://filmroomfantasy.com/articles/${article.slug}` },
            ],
          },
        ]}
      />

      {/* Breadcrumb nav */}
      <nav className="flex items-center gap-2 mb-8">
        <button
          onClick={onBack}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <ArrowLeft className="w-4 h-4" /> Articles
        </button>
        <span className={`text-sm ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
        {category && (
          <span className="text-sm font-medium" style={{ color: category.color }}>
            {category.label}
          </span>
        )}
      </nav>

      {/* Article header — clean, no card wrapper */}
      <header className="mb-10">
        {/* Category + reading time */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {category && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg"
              style={{ color: category.color, background: `${category.color}15` }}
            >
              <CategoryIcon className="w-3.5 h-3.5" />
              {category.label}
            </span>
          )}
          <span className={`text-sm flex items-center gap-1.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <Clock className="w-3.5 h-3.5" />
            {article.readingTime} min read
          </span>
        </div>

        {/* Title */}
        <h1 className={`text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold leading-[1.15] mb-5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {article.title}
        </h1>

        {/* Description / subtitle */}
        <p className={`text-lg sm:text-xl leading-relaxed mb-8 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {article.description}
        </p>

        {/* Author + date row */}
        <div className={`flex items-center gap-4 py-5 border-y ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <User className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{article.author}</p>
            {date && (
              <p className={`text-xs flex items-center gap-1.5 mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                <Calendar className="w-3 h-3" />
                {date}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Article body */}
      <div
        className="article-content"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Tags */}
      {article.tags.length > 0 && (
        <div className={`flex flex-wrap items-center gap-2.5 mt-12 pt-6 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <span className={`text-xs font-semibold uppercase tracking-wider mr-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Tags
          </span>
          {article.tags.map((tag) => (
            <span
              key={tag}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className={`mt-12 p-8 sm:p-10 rounded-2xl text-center ${
        isDarkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700' : 'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100'
      }`}>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <h2 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Put this into practice
        </h2>
        <p className={`text-sm mb-6 max-w-md mx-auto leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Check the latest player rankings, evaluate trades, and find waiver wire gems — all powered by Vegas lines.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => onNavigate('Board')} className="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/25">
            View Rankings
          </button>
          <button onClick={() => onNavigate('TradeAnalyzer')} className={`px-6 py-3 text-sm font-semibold rounded-lg border transition-colors ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-white'}`}>
            Trade Analyzer
          </button>
        </div>
      </div>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <div className="mt-14">
          <h2 className={`text-lg font-bold mb-5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Related Articles
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {relatedArticles.map((ra) => {
              const raCat = ARTICLE_CATEGORIES[ra.category as keyof typeof ARTICLE_CATEGORIES];
              const RaIcon = CATEGORY_ICONS[ra.category] || BookOpen;
              return (
                <button
                  key={ra.slug}
                  onClick={() => onArticleSelect(ra.slug)}
                  className={`group text-left p-5 rounded-xl border transition-all ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700 hover:border-slate-500'
                      : 'bg-white border-slate-200 hover:shadow-md hover:shadow-slate-200/50'
                  }`}
                >
                  {raCat && (
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center"
                        style={{ background: `${raCat.color}15` }}
                      >
                        <RaIcon className="w-3.5 h-3.5" style={{ color: raCat.color }} />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: raCat.color }}>
                        {raCat.label}
                      </span>
                    </div>
                  )}
                  <h3 className={`text-sm font-bold leading-snug group-hover:text-blue-500 transition-colors line-clamp-2 mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {ra.title}
                  </h3>
                  <span className={`text-xs flex items-center gap-1 font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    Read <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
