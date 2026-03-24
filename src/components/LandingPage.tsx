import { useEffect, useRef } from 'react';

interface LandingPageProps {
  onNavigate: (view: string) => void;
}

const LANDING_CSS = `
.lp *, .lp *::before, .lp *::after { margin: 0; padding: 0; box-sizing: border-box; }
.lp { --bg: #0a0a0a; --surface: #111111; --surface-2: #1a1a1a; --border: #222222; --text: #e5e5e5; --text-muted: #737373; --accent: #3b82f6; --green: #22c55e; --red: #ef4444; font-family: 'Inter', -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; overflow-x: hidden; min-height: 100vh; }
.lp .serif { font-family: 'Playfair Display', Georgia, serif; }
.lp nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 16px 0; transition: background 0.3s, backdrop-filter 0.3s; }
.lp nav.scrolled { background: rgba(10,10,10,0.85); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
.lp .nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
.lp .nav-logo { font-weight: 800; font-size: 18px; letter-spacing: -0.5px; color: white; text-decoration: none; cursor: pointer; background: none; border: none; }
.lp .nav-logo span { color: var(--accent); }
.lp .nav-links { display: flex; gap: 32px; align-items: center; }
.lp .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; cursor: pointer; }
.lp .nav-links a:hover { color: white; }
.lp .nav-cta { background: white; color: black; padding: 8px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; text-decoration: none; transition: opacity 0.2s; cursor: pointer; }
.lp .nav-cta:hover { opacity: 0.85; }
.lp .hero { padding: 160px 24px 80px; max-width: 1200px; margin: 0 auto; }
.lp .hero-label { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 24px; }
.lp .hero-label .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); animation: lp-pulse 2s infinite; }
@keyframes lp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.lp .hero h1 { font-size: clamp(40px, 7vw, 80px); font-weight: 900; letter-spacing: -2px; line-height: 0.95; color: white; max-width: 900px; margin-bottom: 28px; }
.lp .hero p { font-size: 18px; color: var(--text-muted); max-width: 540px; line-height: 1.7; margin-bottom: 40px; }
.lp .hero-actions { display: flex; gap: 16px; flex-wrap: wrap; }
.lp .btn-primary { background: white; color: black; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; transition: all 0.2s; border: none; cursor: pointer; display: inline-block; }
.lp .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 24px rgba(255,255,255,0.15); }
.lp .btn-secondary { background: transparent; color: white; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none; border: 1px solid #333; transition: all 0.2s; }
.lp .btn-secondary:hover { border-color: #555; background: rgba(255,255,255,0.03); }
.lp .ticker { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 14px 0; overflow: hidden; white-space: nowrap; }
.lp .ticker-track { display: inline-flex; animation: lp-scroll 40s linear infinite; gap: 48px; }
.lp .ticker-track:hover { animation-play-state: paused; }
@keyframes lp-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.lp .ticker-item { display: inline-flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: var(--text-muted); }
.lp .ticker-item .name { color: white; }
.lp .ticker-item .up { color: var(--green); }
.lp .ticker-item .down { color: var(--red); }
.lp .ticker-item .sep { color: #333; }
.lp .rankings-section { max-width: 1200px; margin: 80px auto; padding: 0 24px; }
.lp .section-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
.lp .section-header h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); }
.lp .section-header a { font-size: 13px; color: var(--accent); text-decoration: none; font-weight: 600; cursor: pointer; }
.lp .rankings-table { width: 100%; border-collapse: collapse; }
.lp .rankings-table th { text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); border-bottom: 1px solid var(--border); }
.lp .rankings-table th.right { text-align: right; }
.lp .rankings-table td { padding: 14px 16px; border-bottom: 1px solid #161616; font-size: 14px; vertical-align: middle; }
.lp .rankings-table tr { transition: background 0.15s; }
.lp .rankings-table tbody tr:hover { background: var(--surface); }
.lp .player-name { font-weight: 700; color: white; }
.lp .player-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.lp .pos-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
.lp .pos-qb { background: #dc265220; color: #dc2652; }
.lp .pos-rb { background: #16a34a20; color: #22c55e; }
.lp .pos-wr { background: #2563eb20; color: #60a5fa; }
.lp .pos-te { background: #d9731520; color: #f59e0b; }
.lp .pts { font-weight: 800; color: white; font-variant-numeric: tabular-nums; text-align: right; }
.lp .trend { text-align: right; font-weight: 600; font-size: 13px; }
.lp .trend.up { color: var(--green); }
.lp .trend.down { color: var(--red); }
.lp .blur-overlay { position: relative; }
.lp .blur-overlay::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 180px; background: linear-gradient(transparent, var(--bg)); pointer-events: none; }
.lp .unlock-row td { text-align: center; padding: 32px 16px; }
.lp .unlock-text { font-size: 15px; color: var(--text-muted); margin-bottom: 16px; }
.lp .diff-section { max-width: 1200px; margin: 100px auto; padding: 0 24px; }
.lp .diff-grid { display: grid; grid-template-columns: 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
@media (min-width: 768px) { .lp .diff-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1024px) { .lp .diff-grid { grid-template-columns: 1fr 1fr 1fr; } }
.lp .diff-card { background: var(--bg); padding: 40px 32px; }
.lp .diff-card .num { font-size: 48px; font-weight: 900; color: white; letter-spacing: -2px; line-height: 1; margin-bottom: 12px; font-variant-numeric: tabular-nums; }
.lp .diff-card h3 { font-size: 16px; font-weight: 700; color: white; margin-bottom: 8px; }
.lp .diff-card p { font-size: 14px; color: var(--text-muted); line-height: 1.6; }
.lp .how-section { max-width: 800px; margin: 120px auto; padding: 0 24px; }
.lp .how-section h2 { font-size: clamp(32px, 5vw, 48px); font-weight: 900; letter-spacing: -1px; color: white; margin-bottom: 64px; text-align: center; }
.lp .how-steps { display: flex; flex-direction: column; gap: 48px; }
.lp .how-step { display: flex; gap: 24px; align-items: flex-start; }
.lp .how-step .step-num { flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; border: 2px solid #333; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: white; }
.lp .how-step h3 { font-weight: 700; font-size: 18px; color: white; margin-bottom: 6px; }
.lp .how-step p { font-size: 15px; color: var(--text-muted); line-height: 1.6; }
.lp .pricing-section { max-width: 1000px; margin: 120px auto; padding: 0 24px; }
.lp .pricing-section h2 { font-size: clamp(32px, 5vw, 48px); font-weight: 900; letter-spacing: -1px; color: white; margin-bottom: 16px; text-align: center; }
.lp .pricing-section .subtitle { text-align: center; font-size: 16px; color: var(--text-muted); margin-bottom: 48px; }
.lp .pricing-grid { display: grid; grid-template-columns: 1fr; gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
@media (min-width: 768px) { .lp .pricing-grid { grid-template-columns: 1fr 1fr 1fr; } }
.lp .price-card { background: var(--bg); padding: 40px 32px; display: flex; flex-direction: column; }
.lp .price-card.featured { background: var(--surface); }
.lp .price-card .tier { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 8px; }
.lp .price-card .tier.pop { color: var(--accent); }
.lp .price-card .amount { font-size: 40px; font-weight: 900; color: white; letter-spacing: -2px; margin-bottom: 4px; }
.lp .price-card .amount span { font-size: 16px; font-weight: 500; color: var(--text-muted); letter-spacing: 0; }
.lp .price-card .period { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }
.lp .price-card ul { list-style: none; flex: 1; margin-bottom: 32px; }
.lp .price-card li { font-size: 14px; color: var(--text-muted); padding: 6px 0; display: flex; align-items: center; gap: 10px; }
.lp .price-card li::before { content: ''; width: 4px; height: 4px; border-radius: 50%; background: #444; flex-shrink: 0; }
.lp .price-card li.highlight { color: white; }
.lp .price-card li.highlight::before { background: var(--accent); }
.lp .price-btn { display: block; text-align: center; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 14px; text-decoration: none; transition: all 0.2s; cursor: pointer; }
.lp .price-btn.outline { border: 1px solid #333; color: white; background: transparent; }
.lp .price-btn.outline:hover { border-color: #555; }
.lp .price-btn.fill { background: white; color: black; border: none; }
.lp .price-btn.fill:hover { opacity: 0.85; }
.lp .final-cta { max-width: 1200px; margin: 120px auto 0; padding: 80px 24px; text-align: center; border-top: 1px solid var(--border); }
.lp .final-cta h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 900; letter-spacing: -1px; color: white; margin-bottom: 16px; }
.lp .final-cta p { color: var(--text-muted); font-size: 16px; margin-bottom: 32px; }
.lp footer { max-width: 1200px; margin: 0 auto; padding: 40px 24px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
.lp footer .left { font-size: 13px; color: var(--text-muted); }
.lp footer .right { display: flex; gap: 24px; }
.lp footer .right a { font-size: 13px; color: var(--text-muted); text-decoration: none; cursor: pointer; }
.lp footer .right a:hover { color: white; }
@media (max-width: 768px) { .lp .nav-links { display: none; } .lp .hero h1 { letter-spacing: -1px; } .lp .rankings-table .hide-mobile { display: none; } .lp .how-step { flex-direction: column; gap: 12px; } }
.lp .fade-in { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s ease; }
.lp .fade-in.visible { opacity: 1; transform: translateY(0); }
`;

const TICKER_ITEMS = [
  { name: 'J. Hurts', info: 'QB PHI', pts: '26.4', change: '+2.1', up: true },
  { name: 'C. McCaffrey', info: 'RB SF', pts: '24.8', change: '+0.6', up: true },
  { name: 'J. Chase', info: 'WR CIN', pts: '22.1', change: '-1.3', up: false },
  { name: 'S. Barkley', info: 'RB PHI', pts: '21.9', change: '+3.4', up: true },
  { name: 'T. Hill', info: 'WR MIA', pts: '20.5', change: '-0.8', up: false },
  { name: 'L. Jackson', info: 'QB BAL', pts: '25.7', change: '+1.5', up: true },
  { name: 'A. St. Brown', info: 'WR DET', pts: '19.2', change: '+0.9', up: true },
  { name: 'B. Robinson', info: 'RB ATL', pts: '18.7', change: '-2.1', up: false },
  { name: 'S. LaPorta', info: 'TE DET', pts: '14.3', change: '+1.1', up: true },
  { name: 'P. Mahomes', info: 'QB KC', pts: '22.8', change: '+0.4', up: true },
];

const RANKINGS = [
  { rank: 1, name: 'Jalen Hurts', meta: 'PHI vs DAL', pos: 'QB', line: 'PHI -6.5 \u2022 51.5', stat: '340 yds, 3 TD, 52 rush', pts: '26.4', trend: '+2.1', up: true },
  { rank: 2, name: 'Lamar Jackson', meta: 'BAL vs CLE', pos: 'QB', line: 'BAL -9.0 \u2022 46.5', stat: '285 yds, 2 TD, 68 rush', pts: '25.7', trend: '+1.5', up: true },
  { rank: 3, name: 'Christian McCaffrey', meta: 'SF vs ARI', pos: 'RB', line: 'SF -7.0 \u2022 49.0', stat: '88 rush, 5 rec, 42 rec yds', pts: '24.8', trend: '+0.6', up: true },
  { rank: 4, name: 'Patrick Mahomes', meta: 'KC vs LAC', pos: 'QB', line: 'KC -3.5 \u2022 47.0', stat: '310 yds, 3 TD, 18 rush', pts: '22.8', trend: '+0.4', up: true },
  { rank: 5, name: "Ja'Marr Chase", meta: 'CIN vs PIT', pos: 'WR', line: 'CIN -2.5 \u2022 44.5', stat: '8 rec, 118 yds, 1 TD', pts: '22.1', trend: '-1.3', up: false },
  { rank: 6, name: 'Saquon Barkley', meta: 'PHI vs DAL', pos: 'RB', line: 'PHI -6.5 \u2022 51.5', stat: '95 rush, 4 rec, 32 rec yds', pts: '21.9', trend: '+3.4', up: true },
  { rank: 7, name: 'Tyreek Hill', meta: 'MIA vs NE', pos: 'WR', line: 'MIA -5.5 \u2022 48.5', stat: '7 rec, 105 yds, 1 TD', pts: '20.5', trend: '-0.8', up: false },
  { rank: 8, name: 'Amon-Ra St. Brown', meta: 'DET vs MIN', pos: 'WR', line: 'DET -3.0 \u2022 52.0', stat: '9 rec, 98 yds, 1 TD', pts: '19.2', trend: '+0.9', up: true },
  { rank: 9, name: 'Bijan Robinson', meta: 'ATL vs NO', pos: 'RB', line: 'ATL -4.0 \u2022 43.5', stat: '82 rush, 3 rec, 24 rec yds', pts: '18.7', trend: '-2.1', up: false },
];

const posClass: Record<string, string> = { QB: 'pos-qb', RB: 'pos-rb', WR: 'pos-wr', TE: 'pos-te' };

export function LandingPage({ onNavigate }: LandingPageProps) {
  const navRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Playfair Display font
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Inject scoped styles
    const style = document.createElement('style');
    style.textContent = LANDING_CSS;
    document.head.appendChild(style);

    // Sticky nav
    const handleScroll = () => {
      navRef.current?.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);

    // Fade-in on scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    containerRef.current?.querySelectorAll('.fade-in').forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
      style.remove();
      link.remove();
    };
  }, []);

  const nav = (view: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(view);
  };

  return (
    <div className="lp" ref={containerRef}>
      <nav ref={navRef}>
        <div className="nav-inner">
          <button className="nav-logo" onClick={nav('Board')}>Film<span>Room</span></button>
          <div className="nav-links">
            <a href="#rankings">Rankings</a>
            <a href="#features">Why FilmRoom</a>
            <a href="#pricing">Pricing</a>
            <a onClick={nav('Login')} className="nav-cta">Sign Up Free</a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-label"><span className="dot" /> 2026 NFL Season — Data Updated Every 4 Hours</div>
        <h1>Your edge starts<br />before the snap.</h1>
        <p>Every projection starts with Vegas lines — spreads, totals, implied points — because the sharpest money in sports already did the homework. No expert rankings. No consensus lists. Just the market.</p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={nav('Login')}>Start free &rarr;</button>
          <a href="#rankings" className="btn-secondary">See the rankings</a>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <span key={i} className="ticker-item">
              <span className="name">{t.name}</span> {t.info}{' '}
              <span className="pts">{t.pts}</span>{' '}
              <span className={t.up ? 'up' : 'down'}>{t.change}</span>{' '}
              <span className="sep">|</span>
            </span>
          ))}
        </div>
      </div>

      <section className="rankings-section fade-in" id="rankings">
        <div className="section-header">
          <h2>Week 1 Rankings &mdash; PPR</h2>
          <a onClick={nav('Board')}>Full rankings &rarr;</a>
        </div>
        <div className="blur-overlay">
          <table className="rankings-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Player</th>
                <th className="hide-mobile" style={{ width: 64 }}>Pos</th>
                <th className="hide-mobile">Line / O{'\u2009'}U</th>
                <th className="hide-mobile">Key Stat</th>
                <th className="right" style={{ width: 72 }}>Proj</th>
                <th className="right hide-mobile" style={{ width: 72 }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {RANKINGS.map((r) => (
                <tr key={r.rank}>
                  <td style={{ color: '#555', fontWeight: 700 }}>{r.rank}</td>
                  <td><div className="player-name">{r.name}</div><div className="player-meta">{r.meta}</div></td>
                  <td className="hide-mobile"><span className={`pos-badge ${posClass[r.pos]}`}>{r.pos}</span></td>
                  <td className="hide-mobile"><span className="line">{r.line}</span></td>
                  <td className="hide-mobile"><span className="line">{r.stat}</span></td>
                  <td className="pts">{r.pts}</td>
                  <td className={`trend ${r.up ? 'up' : 'down'} hide-mobile`}>{r.trend}</td>
                </tr>
              ))}
              <tr className="unlock-row">
                <td colSpan={7}>
                  <div className="unlock-text">350+ players ranked every week — projections powered by Vegas, not experts</div>
                  <button className="btn-primary" onClick={nav('Board')}>See full rankings &rarr;</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="diff-section fade-in" id="features">
        <div className="section-header" style={{ marginBottom: 24 }}><h2>Why FilmRoom</h2></div>
        <div className="diff-grid">
          {[
            { num: '5+', title: 'Vegas lines at the core', desc: 'Spreads, totals, and implied team scores drive every projection. No talking heads, no gut feelings \u2014 the market does the work.' },
            { num: '4hr', title: 'Data refresh cycle', desc: 'Stats, projections, and line movements updated every 4 hours. Never making decisions on stale numbers.' },
            { num: '3', title: 'Platforms, one dashboard', desc: 'Sync Sleeper, Yahoo, and ESPN leagues instantly. See all your teams, matchups, and waivers in one place.' },
            { num: '18', title: 'Weeks of projections', desc: 'Full-season projections across PPR, Half PPR, and Standard. Plan your season, not just your week.' },
            { num: '0', title: 'Paywalled rankings', desc: 'Core rankings are free forever. No email gate, no "sign up to see #6." Just open the page and see the data.' },
            { num: '<1s', title: 'Time to sync your league', desc: 'Paste your Sleeper username or connect Yahoo/ESPN with OAuth. Your roster, matchups, and waivers load instantly.' },
          ].map((d) => (
            <div key={d.title} className="diff-card">
              <div className="num">{d.num}</div>
              <h3>{d.title}</h3>
              <p>{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="how-section fade-in">
        <h2>Three steps. That&apos;s it.</h2>
        <div className="how-steps">
          {[
            { n: '1', title: 'Connect your league', desc: 'Enter your Sleeper username or link your Yahoo/ESPN account. Your league data, rosters, and schedule sync in under a second.' },
            { n: '2', title: 'Check the numbers', desc: "Player rankings built off Vegas lines, scoring trends, and real stat breakdowns \u2014 not some expert's top-10 list. Filter by position, scoring format, and week." },
            { n: '3', title: 'Make better decisions', desc: 'Start/sit calls backed by data. Waiver pickups before your leaguemates notice. Trade offers you can actually evaluate.' },
          ].map((s) => (
            <div key={s.n} className="how-step">
              <div className="step-num">{s.n}</div>
              <div><h3>{s.title}</h3><p>{s.desc}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="pricing-section fade-in" id="pricing">
        <h2>Simple pricing</h2>
        <p className="subtitle">Free to start. Upgrade when you want more.</p>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="tier">Free</div>
            <div className="amount">$0</div>
            <div className="period">Forever</div>
            <ul>
              <li className="highlight">Player rankings — all positions, all scoring formats</li>
              <li className="highlight">NFL Game Slate with live scores</li>
              <li className="highlight">News &amp; injury updates</li>
              <li>1 league sync</li>
              <li>Current week projections</li>
            </ul>
            <a className="price-btn outline" onClick={nav('Login')}>Start free</a>
          </div>
          <div className="price-card featured">
            <div className="tier pop">Pro &mdash; Most Popular</div>
            <div className="amount">$4.99<span>/mo</span></div>
            <div className="period">or $29.99/year (save 50%)</div>
            <ul>
              <li className="highlight">Everything in Free</li>
              <li className="highlight">Unlimited league syncs</li>
              <li className="highlight">Trending players &amp; add/drop data</li>
              <li className="highlight">Deeper player research — stats, Vegas props, game logs, matchup grades</li>
            </ul>
            <a className="price-btn fill" onClick={nav('Pricing')}>Try Pro free for 7 days</a>
          </div>
          <div className="price-card">
            <div className="tier">Elite</div>
            <div className="amount">$9.99<span>/mo</span></div>
            <div className="period">or $59.99/year (save 50%)</div>
            <ul>
              <li className="highlight">Everything in Pro</li>
              <li className="highlight">Trade analyzer</li>
              <li className="highlight">Lineup optimizer</li>
              <li>Custom scoring models</li>
              <li>Season-long projections</li>
              <li>Priority support</li>
              <li>Early access to new features</li>
            </ul>
            <a className="price-btn outline" onClick={nav('Pricing')}>Try Elite free for 7 days</a>
          </div>
        </div>
      </section>

      <section className="final-cta fade-in">
        <h2>Stop guessing. Start winning.</h2>
        <p>Free rankings built on Vegas lines. No credit card required.</p>
        <button className="btn-primary" onClick={nav('Login')}>Get started free &rarr;</button>
      </section>

      <footer>
        <div className="left">&copy; 2026 FilmRoom Fantasy</div>
        <div className="right">
          <a href="#rankings">Rankings</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a onClick={nav('Login')}>Login</a>
        </div>
      </footer>
    </div>
  );
}
