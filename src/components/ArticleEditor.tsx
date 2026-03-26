import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2, Eye, Loader2, Save, ArrowLeft, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

interface ArticleEditorProps {
  isDarkMode: boolean;
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
  status: string;
  readingTime: number;
  imageUrl: string | null;
  publishedAt: string | null;
  createdAt: number;
  updatedAt: number;
}

const CATEGORIES = [
  { value: 'strategy', label: 'Strategy' },
  { value: 'rankings', label: 'Rankings' },
  { value: 'news', label: 'News' },
  { value: 'tools', label: 'Tools & Features' },
  { value: 'beginners', label: 'Beginners Guide' },
];

export function ArticleEditor({ isDarkMode }: ArticleEditorProps) {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editing, setEditing] = useState<ArticleData | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('strategy');
  const [tagsInput, setTagsInput] = useState('');
  const [author, setAuthor] = useState('FilmRoom');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  const cardBg = isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDarkMode ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400';

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ articles: ArticleData[] }>('/articles/admin/all');
      setArticles(data.articles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const openNewEditor = () => {
    setEditing(null);
    setIsNew(true);
    setTitle('');
    setDescription('');
    setContent('');
    setCategory('strategy');
    setTagsInput('');
    setAuthor('FilmRoom');
    setStatus('draft');
    setSaveResult(null);
  };

  const openEditEditor = (article: ArticleData) => {
    setEditing(article);
    setIsNew(false);
    setTitle(article.title);
    setDescription(article.description);
    setContent(article.content);
    setCategory(article.category);
    setTagsInput(article.tags.join(', '));
    setAuthor(article.author);
    setStatus(article.status as 'draft' | 'published');
    setSaveResult(null);
  };

  const closeEditor = () => {
    setEditing(null);
    setIsNew(false);
    setPreviewing(false);
    setSaveResult(null);
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim() || !content.trim()) {
      setSaveResult({ type: 'error', message: 'Title, description, and content are required' });
      return;
    }

    setSaving(true);
    setSaveResult(null);

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const payload = { title, description, content, category, tags, author, status };

    try {
      if (isNew) {
        await api.post('/articles/admin', payload);
        setSaveResult({ type: 'success', message: 'Article created!' });
      } else if (editing) {
        await api.put(`/articles/admin/${editing.id}`, payload);
        setSaveResult({ type: 'success', message: 'Article updated!' });
      }
      await fetchArticles();
      // Stay in editor to show success, user can close manually
    } catch (err) {
      setSaveResult({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    setDeleting(id);
    try {
      await api.delete(`/articles/admin/${id}`);
      await fetchArticles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const handlePublishToggle = async (article: ArticleData) => {
    const newStatus = article.status === 'published' ? 'draft' : 'published';
    try {
      await api.put(`/articles/admin/${article.id}`, { status: newStatus });
      await fetchArticles();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Editor view
  if (isNew || editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={closeEditor} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className={`text-lg font-bold ${textPrimary}`}>
            {isNew ? 'New Article' : `Editing: ${editing?.title}`}
          </h2>
        </div>

        {saveResult && (
          <div className={`p-3 rounded-lg text-sm font-medium ${saveResult.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {saveResult.message}
          </div>
        )}

        {/* Toggle between editor and preview */}
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewing(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${!previewing ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <Edit3 className="w-3.5 h-3.5 inline mr-1.5" />Write
          </button>
          <button
            onClick={() => setPreviewing(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${previewing ? 'bg-blue-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
          >
            <Eye className="w-3.5 h-3.5 inline mr-1.5" />Preview
          </button>
        </div>

        {previewing ? (
          <div className={`p-6 rounded-xl border ${cardBg}`}>
            <div className="text-xs font-bold uppercase tracking-wide text-blue-500 mb-2">
              {CATEGORIES.find(c => c.value === category)?.label}
            </div>
            <h1 className={`text-2xl font-bold mb-2 ${textPrimary}`}>{title || 'Untitled'}</h1>
            <p className={`text-sm mb-4 ${textSecondary}`}>{description}</p>
            <div
              className={`prose max-w-none ${isDarkMode ? 'prose-invert' : ''}`}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title..."
                className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg}`}
              />
            </div>

            {/* Description */}
            <div>
              <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>Description (SEO excerpt)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description for search results and social sharing..."
                rows={2}
                className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${inputBg}`}
              />
              <span className={`text-xs ${textSecondary}`}>{description.length}/160 characters</span>
            </div>

            {/* Category + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg}`}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg}`}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>

            {/* Tags + Author */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="strategy, waiver wire, PPR..."
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg}`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>Author</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="FilmRoom"
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg}`}
                />
              </div>
            </div>

            {/* Content */}
            <div>
              <label className={`block text-sm font-medium mb-1 ${textSecondary}`}>Content (HTML)</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="<p>Write your article here...</p>&#10;&#10;<h2>Section Heading</h2>&#10;<p>More content...</p>"
                rows={20}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono ${inputBg}`}
                style={{ tabSize: 2 }}
              />
              <p className={`text-xs mt-1 ${textSecondary}`}>
                Use HTML tags: &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;/&lt;li&gt;, &lt;strong&gt;, &lt;a href=""&gt;
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? 'Create Article' : 'Save Changes'}
          </button>
          <button
            onClick={closeEditor}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-bold ${textPrimary}`}>Articles ({articles.length})</h2>
        <button
          onClick={openNewEditor}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Article
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 text-red-500 text-sm">{error}</div>
      )}

      {!loading && articles.length === 0 && (
        <div className={`text-center py-12 ${textSecondary}`}>
          <p className="text-lg font-medium mb-2">No articles yet</p>
          <p className="text-sm">Create your first article to start building SEO content.</p>
        </div>
      )}

      <div className="space-y-3">
        {articles.map(article => (
          <div key={article.id} className={`p-4 rounded-xl border ${cardBg}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                    article.status === 'published'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-yellow-500/10 text-yellow-500'
                  }`}>
                    {article.status}
                  </span>
                  <span className={`text-xs ${textSecondary}`}>
                    {CATEGORIES.find(c => c.value === article.category)?.label}
                  </span>
                  {article.publishedAt && (
                    <span className={`text-xs ${textSecondary}`}>
                      &middot; {article.publishedAt}
                    </span>
                  )}
                </div>
                <h3 className={`font-bold text-sm truncate ${textPrimary}`}>{article.title}</h3>
                <p className={`text-xs mt-0.5 truncate ${textSecondary}`}>{article.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {article.tags.slice(0, 4).map(tag => (
                    <span key={tag} className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {article.status === 'published' && (
                  <a
                    href={`/articles/${article.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                    title="View live"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => handlePublishToggle(article)}
                  className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                  title={article.status === 'published' ? 'Unpublish' : 'Publish'}
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openEditEditor(article)}
                  className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(article.id)}
                  disabled={deleting === article.id}
                  className={`p-2 rounded-lg transition-colors text-red-400 ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                  title="Delete"
                >
                  {deleting === article.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
