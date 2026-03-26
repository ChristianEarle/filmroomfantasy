import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getArticleBySlug, articles, ARTICLE_CATEGORIES } from '../data/articles';
import { SEO } from './SEO';

interface ArticleDetailViewProps {
  slug: string;
  isDarkMode: boolean;
  onBack: () => void;
  onArticleSelect: (slug: string) => void;
  onNavigate: (view: string) => void;
}

export function ArticleDetailView({ slug, isDarkMode, onBack, onArticleSelect, onNavigate }: ArticleDetailViewProps) {
  const article = getArticleBySlug(slug);

  const relatedArticles = useMemo(() => {
    if (!article) return [];
    return articles
      .filter(a => a.slug !== slug && (a.category === article.category || a.tags.some(t => article.tags.includes(t))))
      .slice(0, 3);
  }, [slug, article]);

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <h1 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Article Not Found</h1>
        <p className={`mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>The article you're looking for doesn't exist.</p>
        <button onClick={onBack} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Back to Articles
        </button>
      </div>
    );
  }

  const category = ARTICLE_CATEGORIES[article.category];
  const date = new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="max-w-3xl mx-auto">
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
            'dateModified': article.updatedAt || article.publishedAt,
            'mainEntityOfPage': `https://filmroomfantasy.com/articles/${article.slug}`,
            'wordCount': article.content.split(/\s+/).length,
            'articleSection': category.label,
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

      {/* Back button */}
      <button
        onClick={onBack}
        className={`flex items-center gap-1.5 text-sm font-medium mb-6 transition-colors ${
          isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <ArrowLeft className="w-4 h-4" /> Back to Articles
      </button>

      {/* Article header */}
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <span
            className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded"
            style={{ color: category.color, background: `${category.color}18` }}
          >
            {category.label}
          </span>
          <span className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {date} &middot; {article.readingTime} min read
          </span>
        </div>
        <h1 className={`text-2xl sm:text-3xl font-bold leading-tight mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {article.title}
        </h1>
        <p className={`text-base leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          {article.description}
        </p>
      </header>

      {/* Article body */}
      <div
        className={`prose max-w-none ${isDarkMode ? 'prose-invert' : ''}`}
        style={{
          ['--tw-prose-body' as string]: isDarkMode ? '#cbd5e1' : '#475569',
          ['--tw-prose-headings' as string]: isDarkMode ? '#f1f5f9' : '#0f172a',
          ['--tw-prose-links' as string]: '#3b82f6',
          ['--tw-prose-bold' as string]: isDarkMode ? '#f1f5f9' : '#0f172a',
          ['--tw-prose-bullets' as string]: isDarkMode ? '#64748b' : '#94a3b8',
        }}
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Tags */}
      <div className={`flex flex-wrap gap-2 mt-8 pt-6 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        {article.tags.map((tag) => (
          <span
            key={tag}
            className={`text-xs px-3 py-1 rounded-full ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* CTA */}
      <div className={`mt-8 p-6 rounded-xl border text-center ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <h2 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Put this into practice
        </h2>
        <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Check the latest player rankings, evaluate trades, and find waiver wire gems — all powered by Vegas lines.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => onNavigate('Board')} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            View Rankings
          </button>
          <button onClick={() => onNavigate('TradeAnalyzer')} className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
            Trade Analyzer
          </button>
        </div>
      </div>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <div className="mt-10">
          <h2 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Related Articles
          </h2>
          <div className="space-y-3">
            {relatedArticles.map((ra) => {
              const raCat = ARTICLE_CATEGORIES[ra.category];
              return (
                <button
                  key={ra.slug}
                  onClick={() => onArticleSelect(ra.slug)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700 hover:border-slate-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: raCat.color }}>
                    {raCat.label}
                  </span>
                  <h3 className={`text-sm font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {ra.title}
                  </h3>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
