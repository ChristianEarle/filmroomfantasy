import { useState, useMemo } from 'react';
import { articles, ARTICLE_CATEGORIES, type Article } from '../data/articles';
import { SEO } from './SEO';

interface ArticlesViewProps {
  isDarkMode: boolean;
  onNavigate: (view: string) => void;
  onArticleSelect: (slug: string) => void;
}

export function ArticlesView({ isDarkMode, onNavigate, onArticleSelect }: ArticlesViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredArticles = useMemo(() => {
    if (selectedCategory === 'all') return articles;
    return articles.filter(a => a.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="max-w-4xl mx-auto">
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

      <div className="mb-8">
        <h1 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Fantasy Football Articles & Guides
        </h1>
        <p className={`text-base ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Strategy guides, rankings breakdowns, and tips to help you win your fantasy league.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white'
              : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        {Object.entries(ARTICLE_CATEGORIES).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === key
                ? 'bg-blue-600 text-white'
                : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Article list */}
      <div className="space-y-4">
        {filteredArticles.map((article) => (
          <ArticleCard
            key={article.slug}
            article={article}
            isDarkMode={isDarkMode}
            onClick={() => onArticleSelect(article.slug)}
          />
        ))}
      </div>

      {/* Internal links section */}
      <div className={`mt-12 pt-8 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <h2 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Explore FilmRoom Tools
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Player Rankings', view: 'Board' },
            { label: 'Trade Analyzer', view: 'TradeAnalyzer' },
            { label: 'Waiver Wire', view: 'Waivers' },
            { label: 'NFL Games', view: 'GameSlate' },
          ].map((link) => (
            <button
              key={link.view}
              onClick={() => onNavigate(link.view)}
              className={`p-3 rounded-lg text-sm font-medium text-left transition-colors ${
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

function ArticleCard({ article, isDarkMode, onClick }: { article: Article; isDarkMode: boolean; onClick: () => void }) {
  const category = ARTICLE_CATEGORIES[article.category];
  const date = new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <article
      onClick={onClick}
      className={`p-5 rounded-xl border cursor-pointer transition-all ${
        isDarkMode
          ? 'bg-slate-900 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span
          className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded"
          style={{ color: category.color, background: `${category.color}18` }}
        >
          {category.label}
        </span>
        <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {date} &middot; {article.readingTime} min read
        </span>
      </div>
      <h2 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
        {article.title}
      </h2>
      <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
        {article.description}
      </p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {article.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className={`text-xs px-2 py-0.5 rounded ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
