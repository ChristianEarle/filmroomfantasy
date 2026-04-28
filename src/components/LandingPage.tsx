import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { openCookiePreferences } from './CookieConsentBanner';

interface LandingPageProps {
  onNavigate: (view: string) => void;
}

const LANDING_CSS = `
:root{
  --bg:#0a0a0a;
  --bg2:#111111;
  --card:#1a1a1a;
  --card2:#222222;
  --border:#222222;
  --border2:#2a2a2a;
  --text:#e5e5e5;
  --text-bright:#ffffff;
  --muted:#737373;
  --muted2:#a3a3a3;
  --blue:#3b82f6;
  --blue-hover:#2563eb;
  --blue-glow:rgba(59,130,246,.12);
  --blue-border:rgba(59,130,246,.35);
  --green:#22c55e;
  --green-bg:rgba(34,197,94,.12);
  --gold:#eab308;
  --gold-bg:rgba(234,179,8,.12);
  --red:#ef4444;
  --orange:#f97316;
}
.lp *{box-sizing:border-box;margin:0;padding:0}
.lp{font-family:'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;-webkit-font-smoothing:antialiased;min-height:100vh}
.lp a{color:inherit;text-decoration:none}
.lp .container{max-width:1140px;margin:0 auto;padding:0 24px}
.lp .topbar{background:var(--bg);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50}
.lp .topbar-inner{display:flex;align-items:center;justify-content:space-between;height:56px}
.lp .logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px;color:var(--text-bright);cursor:pointer;background:none;border:none}
.lp .logo-icon{width:28px;height:28px}
.lp .logo-icon svg{width:28px;height:28px}
.lp .beta{background:var(--blue);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;margin-left:4px;letter-spacing:.04em}
.lp .nav-links{display:flex;gap:24px;font-size:14px;font-weight:500;color:var(--muted)}
.lp .nav-links a{cursor:pointer}
.lp .nav-links a:hover{color:var(--text)}
.lp .btn{display:inline-flex;align-items:center;gap:8px;padding:9px 18px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;border:none;transition:all .12s;font-family:inherit}
.lp .btn-blue{background:var(--blue);color:#fff}
.lp .btn-blue:hover{background:var(--blue-hover)}
.lp .btn-outline{background:transparent;color:var(--text);border:1px solid var(--border)}
.lp .btn-outline:hover{border-color:var(--muted)}
.lp .hero{padding:72px 0 56px}
.lp .hero-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:48px;align-items:center}
.lp .hero-tag{display:inline-flex;align-items:center;gap:8px;padding:5px 12px;background:var(--blue-glow);border:1px solid var(--blue-border);color:var(--blue);border-radius:999px;font-size:11px;font-weight:600;letter-spacing:.03em;margin-bottom:20px}
.lp .hero-tag-dot{width:6px;height:6px;background:var(--blue);border-radius:50%;flex-shrink:0}
.lp h1{font-size:44px;line-height:1.1;margin:0 0 16px;letter-spacing:-.03em;font-weight:800;color:var(--text-bright)}
.lp h1 em{font-style:normal;color:var(--blue)}
.lp .hero-sub{font-size:16px;color:var(--muted2);margin-bottom:28px;max-width:480px;line-height:1.7}
.lp .cta-row{display:flex;gap:10px;flex-wrap:wrap}
.lp .stats-row{margin-top:32px;display:flex;gap:24px}
.lp .stat{font-size:13px;color:var(--muted)}
.lp .stat b{color:var(--text);font-weight:700}
.lp .widget{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.lp .widget-bar{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--border);background:var(--bg2)}
.lp .widget-bar-left{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:var(--text-bright)}
.lp .widget-bar-left svg{width:16px;height:16px;fill:var(--muted)}
.lp .tab-pills{display:flex;gap:3px}
.lp .tab-pill{padding:5px 13px;border-radius:6px;font-size:12px;font-weight:600;color:var(--muted);cursor:pointer;transition:all .12s;background:none;border:none;font-family:inherit}
.lp .tab-pill.on{background:var(--blue);color:#fff}
.lp .tab-pill:hover:not(.on){background:var(--card2)}
.lp .widget-body{padding:18px}
.lp .controls{display:flex;gap:20px;margin-bottom:14px;flex-wrap:wrap}
.lp .ctrl-group label{display:block;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-bottom:5px}
.lp .pills{display:flex;gap:3px}
.lp .pill{padding:5px 11px;border-radius:6px;font-size:12px;font-weight:600;color:var(--muted2);background:var(--bg);border:1px solid var(--border);cursor:pointer;transition:all .12s;font-family:inherit}
.lp .pill.on{background:var(--blue);color:#fff;border-color:var(--blue)}
.lp .trade-grid{display:grid;grid-template-columns:1fr 28px 1fr;gap:6px;align-items:start;margin-top:10px}
.lp .trade-grid.teams-3,.lp .trade-grid.teams-4{grid-template-columns:1fr 1fr;gap:8px}
.lp .team-box{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px}
.lp .team-head{font-size:10px;text-transform:uppercase;color:var(--muted);letter-spacing:.07em;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px}
.lp .team-head svg{width:13px;height:13px;fill:var(--muted)}
.lp .chip{display:flex;align-items:center;justify-content:space-between;padding:7px 9px;border-radius:7px;background:var(--card);border:1px solid var(--border);margin-bottom:4px;font-size:12px;font-weight:500;cursor:pointer;transition:all .1s}
.lp .chip:hover{border-color:var(--blue)}
.lp .chip.dimmed{opacity:0.35}
.lp .chip-left{display:flex;align-items:center;gap:7px}
.lp .pos{padding:2px 5px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:.03em}
.lp .pos.QB{background:rgba(239,68,68,.15);color:#f87171}
.lp .pos.RB{background:rgba(34,197,94,.15);color:#4ade80}
.lp .pos.WR{background:rgba(59,130,246,.15);color:#60a5fa}
.lp .pos.TE{background:rgba(245,158,11,.15);color:#fbbf24}
.lp .chip-val{font-size:10px;color:var(--muted);font-weight:600}
.lp .swap-col{display:flex;align-items:center;justify-content:center;padding-top:42px;color:var(--border2);font-size:18px;font-weight:700}
.lp .trade-grid.teams-3 .swap-col,.lp .trade-grid.teams-4 .swap-col{display:none}
.lp .search-box{width:100%;padding:7px 9px;border-radius:7px;background:var(--card);border:1px solid var(--border);color:var(--muted);font-size:11px;font-family:inherit;outline:none;margin-top:3px}
.lp .search-box::placeholder{color:var(--muted)}
.lp .search-box:focus{border-color:var(--blue)}
.lp .add-pick{font-size:11px;color:var(--muted);margin-top:6px;cursor:pointer}
.lp .add-pick:hover{color:var(--blue)}
.lp .verdict{margin-top:14px;padding:14px 16px;border-radius:10px;background:var(--bg);border:1px solid var(--border)}
.lp .verdict-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.lp .verdict-lbl{font-size:10px;text-transform:uppercase;color:var(--muted);letter-spacing:.06em;font-weight:700}
.lp .verdict-grade{font-size:28px;font-weight:800}
.lp .verdict-bar{height:5px;background:var(--card2);border-radius:99px;overflow:hidden;margin:8px 0}
.lp .verdict-fill{height:100%;background:linear-gradient(90deg,var(--blue),#60a5fa);border-radius:99px;transition:width .35s}
.lp .verdict-desc{font-size:11px;color:var(--muted);line-height:1.6}
.lp .verdict-desc b{color:var(--text)}
.lp section{padding:72px 0}
.lp .sec-head{text-align:center;margin-bottom:40px}
.lp .sec-head h2{font-size:30px;margin:0 0 8px;letter-spacing:-.02em;font-weight:800;color:var(--text-bright)}
.lp .sec-head p{color:var(--muted);max-width:520px;margin:0 auto;font-size:14px}
.lp .feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.lp .feat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:22px;transition:border-color .12s}
.lp .feat:hover{border-color:var(--border2)}
.lp .feat.primary{grid-column:span 3;display:grid;grid-template-columns:1.1fr 1fr;gap:28px;align-items:center;border-color:var(--blue-border);background:var(--card)}
.lp .feat-ic{width:38px;height:38px;border-radius:8px;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:18px}
.lp .primary .feat-ic{background:var(--blue);border:none}
.lp .feat h3{margin:0 0 6px;font-size:15px;font-weight:700;color:var(--text-bright)}
.lp .feat p{margin:0;color:var(--muted);font-size:13px;line-height:1.6}
.lp .primary h3{font-size:20px}
.lp .mini-card{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px}
.lp .mini-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin-bottom:6px}
.lp .mini-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}
.lp .mini-row .easy{color:var(--green);font-weight:600}
.lp .mini-row .hard{color:var(--gold);font-weight:600}
.lp .counter-text{font-size:12px;color:var(--text)}
.lp .counter-text span{color:var(--blue);cursor:pointer;font-weight:600}
.lp .steps-section{background:var(--bg2);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.lp .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.lp .step{text-align:center;padding:20px}
.lp .step-n{display:inline-flex;width:40px;height:40px;border-radius:50%;background:var(--blue-glow);border:1px solid var(--blue-border);color:var(--blue);align-items:center;justify-content:center;font-weight:800;font-size:16px;margin-bottom:12px}
.lp .step h4{margin:0 0 6px;font-size:15px;font-weight:700;color:var(--text-bright)}
.lp .step p{color:var(--muted);font-size:13px;margin:0}
.lp .pricing-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:32px}
.lp .price-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px;position:relative}
.lp .price-card.pop{border-color:var(--blue-border)}
.lp .pop-badge{position:absolute;top:-10px;left:20px;background:var(--blue);color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px}
.lp .price-card h4{font-size:16px;font-weight:700;color:var(--text-bright);margin:0 0 4px}
.lp .price-card .amount{font-size:32px;font-weight:800;color:var(--text-bright);margin:0 0 2px}
.lp .price-card .period{font-size:12px;color:var(--muted);margin-bottom:12px}
.lp .price-card .desc{font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.5}
.lp .check-list{list-style:none;padding:0}
.lp .check-list li{font-size:12px;color:var(--muted2);margin-bottom:6px;display:flex;align-items:center;gap:8px}
.lp .check-list li::before{content:"\\2713";color:var(--green);font-weight:700;font-size:13px}
.lp .price-btn{display:block;width:100%;padding:10px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;border:none;font-family:inherit;margin-top:16px;text-align:center;transition:all .12s}
.lp .price-btn.primary{background:var(--blue);color:#fff}
.lp .price-btn.primary:hover{background:var(--blue-hover)}
.lp .price-btn.secondary{background:var(--bg);color:var(--text);border:1px solid var(--border)}
.lp .bottom-cta{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:48px;text-align:center;margin:0 0 40px}
.lp .bottom-cta h2{font-size:28px;margin:0 0 8px;font-weight:800;color:var(--text-bright);letter-spacing:-.02em}
.lp .bottom-cta p{color:var(--muted);margin:0 0 20px;font-size:14px}
.lp footer{border-top:1px solid var(--border);padding:48px 0 32px;color:var(--muted);font-size:12px;text-align:center}
.lp .footer-socials{display:flex;flex-wrap:wrap;justify-content:center;gap:12px 24px;margin-bottom:20px}
.lp .footer-socials a,.lp .footer-socials button{color:var(--muted);cursor:pointer;font-size:12px;transition:color .12s;background:none;border:none;padding:0;font-family:inherit;text-decoration:none}
.lp .footer-socials a:hover,.lp .footer-socials button:hover{color:var(--text)}
.lp .footer-links{display:flex;flex-wrap:wrap;justify-content:center;gap:16px 28px;margin-bottom:24px}
.lp .footer-links a,.lp .footer-links button{color:var(--muted);cursor:pointer;font-size:12px;transition:color .12s;background:none;border:none;padding:0;font-family:inherit}
.lp .footer-links a:hover,.lp .footer-links button:hover{color:var(--text)}
.lp .footer-copy{color:var(--muted);font-size:12px;line-height:1.6}
.lp .footer-disclaimer{color:var(--muted);font-size:11px;margin-top:8px}
.lp .finder-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;background:var(--bg);border:1px solid var(--border);margin-bottom:6px;font-size:12px}
.lp .finder-row:hover{border-color:var(--blue-border)}
.lp .finder-players{display:flex;align-items:center;gap:6px;flex:1;flex-wrap:wrap}
.lp .finder-plus{color:var(--muted);font-size:12px;margin:0 2px;flex-shrink:0}
.lp .finder-arrow{color:var(--muted);font-size:14px;margin:0 8px;flex-shrink:0}
.lp .finder-grade{font-weight:800;font-size:14px;flex-shrink:0;width:28px;text-align:center}
.lp .finder-tag{font-size:10px;padding:2px 7px;border-radius:4px;font-weight:600}
.lp .finder-tag.buy{background:rgba(34,197,94,.12);color:var(--green)}
.lp .finder-tag.sell{background:rgba(239,68,68,.12);color:var(--red)}
.lp .finder-tag.offer{background:var(--blue-glow);color:var(--blue)}
.lp .finder-pick{background:var(--gold-bg);color:var(--gold);font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;letter-spacing:.02em}
.lp .finder-search{width:100%;padding:9px 12px;border-radius:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-size:13px;font-family:inherit;outline:none;margin-bottom:12px}
.lp .finder-search::placeholder{color:var(--muted)}
.lp .finder-target{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:8px;background:var(--blue-glow);border:1px solid var(--blue-border);margin-bottom:10px;font-size:12px}
.lp .finder-target-label{font-size:10px;text-transform:uppercase;color:var(--blue);font-weight:700;letter-spacing:.06em;flex-shrink:0}
.lp .finder-target-name{font-weight:700;color:var(--text-bright);flex:1}
.lp .finder-target-team{font-size:11px;color:var(--muted)}
.lp .finder-hint{font-size:11px;color:var(--muted);text-align:center;margin-top:8px}
.lp .history-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;background:var(--bg);border:1px solid var(--border);margin-bottom:6px;font-size:12px}
.lp .history-row:hover{border-color:var(--blue-border)}
.lp .history-details{flex:1}
.lp .history-teams{font-weight:600;color:var(--text-bright);margin-bottom:2px}
.lp .history-meta{font-size:10px;color:var(--muted)}
.lp .history-result{text-align:right;flex-shrink:0}
.lp .history-grade{font-weight:800;font-size:14px}
.lp .history-status{font-size:10px;font-weight:600;margin-top:1px}
@media(max-width:860px){
  .lp .hero-grid,.lp .feat-grid,.lp .steps,.lp .pricing-row{grid-template-columns:1fr}
  .lp .feat.primary{grid-column:span 1;grid-template-columns:1fr}
  .lp h1{font-size:30px}
  .lp .nav-links{display:none}
  .lp .trade-grid,.lp .trade-grid.teams-3,.lp .trade-grid.teams-4{grid-template-columns:1fr}
  .lp .swap-col{display:none!important}
}
`;

interface ChipData {
  pos: string;
  name: string;
  val: number;
}

// Fill href values to enable. Empty entries are skipped.
const LANDING_SOCIALS: { label: string; href: string }[] = [
  { label: 'X', href: '' },
  { label: 'Discord', href: '' },
  { label: 'Instagram', href: '' },
  { label: 'TikTok', href: '' },
];

const ALL_TEAMS: ChipData[][] = [
  [ { pos: 'WR', name: 'CeeDee Lamb', val: 24.1 }, { pos: 'RB', name: 'Javonte Williams', val: 11.3 } ],
  [ { pos: 'RB', name: 'Bijan Robinson', val: 22.8 }, { pos: 'WR', name: 'DK Metcalf', val: 18.2 } ],
  [ { pos: 'QB', name: 'Jalen Hurts', val: 26.4 }, { pos: 'TE', name: 'Sam LaPorta', val: 14.3 } ],
  [ { pos: 'WR', name: 'Amon-Ra St. Brown', val: 19.2 }, { pos: 'RB', name: 'Saquon Barkley', val: 21.9 } ],
];

function computeMultiVerdict(totals: number[]) {
  const max = Math.max(...totals);
  const min = Math.min(...totals);
  const winnerIdx = totals.indexOf(max);
  const d = max - min;
  const pct = Math.max(5, Math.min(95, 50 + d * 2));
  let grade = 'C', color = 'var(--muted2)';
  if (d > 12) { grade = 'A+'; color = 'var(--green)'; }
  else if (d > 8) { grade = 'A\u2212'; color = 'var(--green)'; }
  else if (d > 4) { grade = 'B'; color = 'var(--blue)'; }
  else if (d > 1) { grade = 'C+'; color = 'var(--muted2)'; }
  else { grade = 'C'; color = 'var(--muted2)'; }
  const summary = d <= 1 ? 'Fair Trade' : `Team ${winnerIdx + 1} Wins`;
  return { grade, summary, color, pct, delta: d, winnerIdx };
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  const [activeTab, setActiveTab] = useState('Analyzer');
  const [tradeType, setTradeType] = useState('2-Team Trade');
  const [leagueFormat, setLeagueFormat] = useState('Redraft');
  const [chipActive, setChipActive] = useState<boolean[][]>(ALL_TEAMS.map(t => t.map(() => true)));

  const teamCount = tradeType === '4-Team' ? 4 : tradeType === '3-Team' ? 3 : 2;

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = LANDING_CSS;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const toggleChip = useCallback((teamIdx: number, playerIdx: number) => {
    setChipActive(prev => prev.map((team, ti) =>
      ti === teamIdx ? team.map((v, pi) => pi === playerIdx ? !v : v) : team
    ));
  }, []);

  const verdict = useMemo(() => {
    const totals = ALL_TEAMS.slice(0, teamCount).map((team, ti) =>
      team.reduce((s, p, pi) => s + (chipActive[ti]?.[pi] ? p.val : 0), 0)
    );
    return computeMultiVerdict(totals);
  }, [chipActive, teamCount]);

  const nav = (view: string) => (e: React.MouseEvent) => { e.preventDefault(); onNavigate(view); };

  return (
    <div className="lp">
      {/* TOP BAR */}
      <div className="topbar">
        <div className="container topbar-inner">
          <button className="logo" onClick={nav('Landing')}>
            <div className="logo-icon">
              <img src="/logo.png" alt="FilmRoom logo" style={{ width: 28, height: 28 }} />
            </div>
            FilmRoom <span className="beta">BETA</span>
          </button>
          <div className="nav-links">
            <a onClick={nav('TradeAnalyzer')}>Trade Analyzer</a>
            <a onClick={nav('Board')}>Player Rankings</a>
            <a onClick={nav('GameSlate')}>Game Slate</a>
            <a onClick={nav('Trends')}>Trends</a>
            <a onClick={nav('Articles')}>Articles</a>
            <a onClick={nav('Pricing')}>Pricing</a>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={nav('Login')}>Log in</button>
            <button className="btn btn-blue" onClick={nav('Register')}>Sign Up Free</button>
          </div>
        </div>
      </div>

      {/* HERO */}
      <header className="hero">
        <div className="container hero-grid">
          <div>
            <div className="hero-tag"><span className="hero-tag-dot" /> AI-Powered Trade Analysis</div>
            <h1>Know who wins the trade <em>before you accept.</em></h1>
            <p className="hero-sub">FilmRoom&#39;s AI Trade Analyzer grades every deal using player valuations, strength of schedule, and your league&#39;s exact settings. Redraft, dynasty, and keeper.</p>
            <div className="cta-row">
              <button className="btn btn-blue" style={{ padding: '11px 22px', fontSize: 14 }} onClick={nav('TradeAnalyzer')}>Analyze a Trade Free</button>

            </div>
            <div className="stats-row">
              <div className="stat"><b>150k+</b> trades analyzed</div>
              <div className="stat"><b>4.9&#9733;</b> user rating</div>
              <div className="stat"><b>12</b> league formats</div>
            </div>
          </div>

          {/* LIVE WIDGET */}
          <div className="widget">
            <div className="widget-bar">
              <div className="widget-bar-left">
                <svg viewBox="0 0 24 24"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
                AI Trade Analyzer
              </div>
              <div className="tab-pills">
                {['Analyzer', 'History'].map(t => (
                  <button key={t} className={`tab-pill${activeTab === t ? ' on' : ''}`} onClick={() => setActiveTab(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div className="widget-body">
              {activeTab === 'Analyzer' && (
                <>
                  <div className="controls">
                    <div className="ctrl-group">
                      <label>Trade Type</label>
                      <div className="pills">
                        {['2-Team Trade', '3-Team', '4-Team'].map(t => (
                          <button key={t} className={`pill${tradeType === t ? ' on' : ''}`} onClick={() => setTradeType(t)}>{t}</button>
                        ))}
                      </div>
                    </div>
                    <div className="ctrl-group">
                      <label>League Format</label>
                      <div className="pills">
                        {['Redraft', 'Dynasty', 'Keeper'].map(f => (
                          <button key={f} className={`pill${leagueFormat === f ? ' on' : ''}`} onClick={() => setLeagueFormat(f)}>{f}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`trade-grid${teamCount === 3 ? ' teams-3' : teamCount === 4 ? ' teams-4' : ''}`}>
                    {ALL_TEAMS.slice(0, teamCount).map((team, ti) => (
                      <React.Fragment key={ti}>
                        {ti > 0 && <div className="swap-col">⇄</div>}
                        <div className="team-box">
                          <div className="team-head">
                            <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                            Team {ti + 1} &middot; Sends away
                          </div>
                          {team.map((p, pi) => (
                            <div key={p.name} className={`chip${!chipActive[ti]?.[pi] ? ' dimmed' : ''}`} onClick={() => toggleChip(ti, pi)}>
                              <span className="chip-left"><span className={`pos ${p.pos}`}>{p.pos}</span>{p.name}</span>
                              <span className="chip-val">{p.val}</span>
                            </div>
                          ))}
                          <input className="search-box" placeholder="Search player to add..." readOnly />
                          <div className="add-pick">+ Add Draft Pick</div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="verdict">
                    <div className="verdict-top">
                      <div className="verdict-lbl">AI Verdict &mdash; {verdict.summary}</div>
                      <div className="verdict-grade" style={{ color: verdict.color }}>{verdict.grade}</div>
                    </div>
                    <div className="verdict-bar"><div className="verdict-fill" style={{ width: `${verdict.pct}%` }} /></div>
                    <div className="verdict-desc">
                      {verdict.delta <= 1
                        ? 'Even trade across all teams.'
                        : <>+{verdict.delta.toFixed(1)} value edge for <b>Team {verdict.winnerIdx + 1}</b>.</>
                      }{' '}Click players to simulate different trade packages.
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'History' && (
                <>
                  <div className="history-row">
                    <div className="history-details">
                      <div className="history-teams">CeeDee Lamb, Javonte Williams ⇄ Bijan Robinson</div>
                      <div className="history-meta">Redraft &middot; 2-Team &middot; Apr 8, 2026</div>
                    </div>
                    <div className="history-result">
                      <div className="history-grade" style={{ color: 'var(--green)' }}>A&minus;</div>
                      <div className="history-status" style={{ color: 'var(--green)' }}>Accepted</div>
                    </div>
                  </div>
                  <div className="history-row">
                    <div className="history-details">
                      <div className="history-teams">Jalen Hurts ⇄ Lamar Jackson, 2026 2nd</div>
                      <div className="history-meta">Dynasty &middot; 2-Team &middot; Apr 5, 2026</div>
                    </div>
                    <div className="history-result">
                      <div className="history-grade" style={{ color: 'var(--blue)' }}>B+</div>
                      <div className="history-status" style={{ color: 'var(--green)' }}>Accepted</div>
                    </div>
                  </div>
                  <div className="history-row">
                    <div className="history-details">
                      <div className="history-teams">DK Metcalf, Sam LaPorta ⇄ Amon-Ra St. Brown</div>
                      <div className="history-meta">Redraft &middot; 2-Team &middot; Apr 2, 2026</div>
                    </div>
                    <div className="history-result">
                      <div className="history-grade" style={{ color: 'var(--muted2)' }}>C+</div>
                      <div className="history-status" style={{ color: 'var(--red)' }}>Declined</div>
                    </div>
                  </div>
                  <div className="history-row">
                    <div className="history-details">
                      <div className="history-teams">Saquon Barkley ⇄ CeeDee Lamb, 2026 3rd</div>
                      <div className="history-meta">Keeper &middot; 3-Team &middot; Mar 28, 2026</div>
                    </div>
                    <div className="history-result">
                      <div className="history-grade" style={{ color: 'var(--green)' }}>A</div>
                      <div className="history-status" style={{ color: 'var(--muted)' }}>Pending</div>
                    </div>
                  </div>
                  <div className="finder-hint">All trades you&apos;ve analyzed this season</div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* FEATURES */}
      <section>
        <div className="container">
          <div className="sec-head">
            <h2>Everything built around the Trade Analyzer</h2>
            <p>Every tool in FilmRoom feeds into smarter trade decisions.</p>
          </div>
          <div className="feat-grid">
            <div className="feat primary">
              <div>
                <div className="feat-ic">⇄</div>
                <h3>AI Trade Analyzer</h3>
                <p>Drop in any trade and get an instant A-F grade tuned to your league&#39;s scoring, roster composition, and playoff schedule. Includes ROS projections, playoff-week matchup breakdowns, and AI-generated counter-offer suggestions. Supports 2, 3, and 4-team trades.</p>
              </div>
              <div>
                <div className="mini-card">
                  <div className="mini-label">Playoff Schedule Comparison</div>
                  <div className="mini-row"><span>Bijan Robinson</span><span className="easy">Easy &middot; Easy &middot; Mid</span></div>
                  <div className="mini-row"><span>CeeDee Lamb</span><span className="hard">Mid &middot; Hard &middot; Hard</span></div>
                </div>
                <div className="mini-card">
                  <div className="mini-label">AI Counter-Offer</div>
                  <div className="counter-text">Send <b>CeeDee Lamb + 2026 2nd</b> to balance this trade. <span>Copy offer &rarr;</span></div>
                </div>
              </div>
            </div>
            <div className="feat" style={{ cursor: 'pointer' }} onClick={nav('Board')}>
              <div className="feat-ic">&#x1F4CA;</div>
              <h3>Player Rankings</h3>
              <p>Weekly and ROS rankings with PPR, Half PPR, and Standard scoring &mdash; wired directly into every trade grade.</p>
            </div>
            <div className="feat" style={{ cursor: 'pointer' }} onClick={nav('GameSlate')}>
              <div className="feat-ic">&#x1F3AC;</div>
              <h3>Game Slate</h3>
              <p>Snap-count projections and matchup breakdowns for every game, every week.</p>
            </div>
            <div className="feat" style={{ cursor: 'pointer' }} onClick={nav('Trends')}>
              <div className="feat-ic">&#x1F4C8;</div>
              <h3>Trends</h3>
              <p>Waiver wire risers, usage trends, and add/drop data across all platforms.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="steps-section">
        <div className="container">
          <div className="sec-head">
            <h2>From &quot;should I?&quot; to &quot;send it.&quot; in seconds</h2>
            <p>No spreadsheets, no forum polls, no waiting.</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-n">1</div>
              <h4>Drop in the trade</h4>
              <p>Search players or sync your Sleeper, ESPN, or Yahoo league.</p>
            </div>
            <div className="step">
              <div className="step-n">2</div>
              <h4>Get the AI grade</h4>
              <p>Instant A-F verdict with value delta, playoff impact, and schedule analysis.</p>
            </div>
            <div className="step">
              <div className="step-n">3</div>
              <h4>Counter or accept</h4>
              <p>Use the AI counter-offer or hit accept with full confidence.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section>
        <div className="container">
          <div className="sec-head">
            <h2>Simple, transparent pricing</h2>
            <p>Free to start. Upgrade when you need more.</p>
          </div>
          <div className="pricing-row">
            <div className="price-card">
              <h4>Free</h4>
              <div className="amount">$0</div>
              <div className="period">Forever</div>
              <div className="desc">Try the Trade Analyzer with basic access.</div>
              <ul className="check-list">
                <li>3 trade analyses per day</li>
                <li>2-team trades only</li>
                <li>All league formats</li>
                <li>AI verdict &amp; letter grade</li>
                <li>Player rankings &amp; Game Slate</li>
              </ul>
              <button className="price-btn secondary" onClick={nav('Register')}>Get Started</button>
            </div>
            <div className="price-card pop">
              <div className="pop-badge">Most Popular</div>
              <h4>Pro</h4>
              <div className="amount">$4.99</div>
              <div className="period">per month</div>
              <div className="desc">Unlock the full Trade Analyzer for your league.</div>
              <ul className="check-list">
                <li>8 trade analyses per day</li>
                <li>2, 3, and 4-team trades</li>
                <li>AI counter-offer suggestions</li>
                <li>Playoff schedule comparisons</li>
                <li>Trade History with AI grades</li>
                <li>3-day free trial</li>
              </ul>
              <button className="price-btn primary" onClick={nav('Pricing')}>Start Free Trial</button>
            </div>
            <div className="price-card">
              <h4>Elite</h4>
              <div className="amount">$9.99</div>
              <div className="period">per month</div>
              <div className="desc">No limits. Every trade tool, unlimited.</div>
              <ul className="check-list">
                <li>Unlimited trade analyses</li>
                <li>Everything in Pro</li>
                <li>Custom scoring models <span style={{ color: 'var(--gold)', fontWeight: 600 }}>Coming Soon</span></li>
                <li>Early access to new features</li>
              </ul>
              <button className="price-btn secondary" onClick={nav('Pricing')}>Start Free Trial</button>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section>
        <div className="container">
          <div className="bottom-cta">
            <h2>Your next trade shouldn&#39;t be a coin flip.</h2>
            <p>Analyze your first trade free. No credit card required.</p>
            <button className="btn btn-blue" style={{ padding: '12px 24px', fontSize: 14 }} onClick={nav('TradeAnalyzer')}>Open the Trade Analyzer</button>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-socials">
            {LANDING_SOCIALS.filter((s) => s.href).map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            ))}
            <a href="mailto:support@filmroomfantasy.com">Contact</a>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <a onClick={nav('Privacy')}>Privacy Policy</a>
            <a onClick={nav('Terms')}>Terms of Service</a>
            <a onClick={nav('CookiePolicy')}>Cookie Policy</a>
            <a onClick={nav('AcceptableUse')}>Acceptable Use</a>
            <a onClick={nav('Disclaimer')}>Disclaimer</a>
            <a onClick={nav('Refunds')}>Refunds</a>
            <a onClick={nav('DMCA')}>DMCA</a>
            <a onClick={nav('Accessibility')}>Accessibility</a>
            <a onClick={nav('DoNotSell')}>Do Not Sell / Share</a>
            <button type="button" onClick={() => openCookiePreferences()}>Cookie preferences</button>
          </nav>
          <div className="footer-copy">&copy; {new Date().getFullYear()} FilmRoom &mdash; Fantasy football analysis &amp; management. Not affiliated with the NFL or any fantasy platform.</div>
          <div className="footer-disclaimer">For entertainment purposes only. Users must be 18+ where applicable.</div>
        </div>
      </footer>
    </div>
  );
}
