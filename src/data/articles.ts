export interface Article {
  slug: string;
  title: string;
  description: string;
  content: string; // HTML content
  author: string;
  publishedAt: string; // ISO date
  updatedAt?: string;
  category: 'strategy' | 'rankings' | 'news' | 'tools' | 'beginners';
  tags: string[];
  readingTime: number; // minutes
  image?: string;
}

export const ARTICLE_CATEGORIES = {
  strategy: { label: 'Strategy', color: '#3b82f6' },
  rankings: { label: 'Rankings', color: '#22c55e' },
  news: { label: 'News', color: '#f59e0b' },
  tools: { label: 'Tools & Features', color: '#8b5cf6' },
  beginners: { label: 'Beginners Guide', color: '#ec4899' },
} as const;

export const articles: Article[] = [
  {
    slug: 'how-vegas-lines-predict-fantasy-football-points',
    title: 'How Vegas Lines Predict Fantasy Football Points Better Than Expert Rankings',
    description: 'Learn why spread, over/under, and implied team totals are the most reliable foundation for fantasy football projections — and how FilmRoom uses them.',
    content: `
      <p>Every week, millions of fantasy football managers rely on expert rankings to set their lineups. But there's a more reliable signal hiding in plain sight: <strong>Vegas lines</strong>.</p>

      <h2>Why Vegas Lines Matter for Fantasy Football</h2>
      <p>Sportsbooks set lines using massive data operations, sophisticated models, and real money on the line. When the market moves, it reflects information — injuries, weather, game script expectations — faster and more accurately than any single analyst can.</p>
      <p>Here's what each line tells us for fantasy purposes:</p>

      <h3>Spread</h3>
      <p>A team favored by 7+ points is likely to build a lead and run the ball in the second half. This means fewer passing attempts for the winning QB but more rushing volume for the RB. For the trailing team, expect garbage-time passing — great for WRs and slot receivers.</p>

      <h3>Over/Under (Total)</h3>
      <p>The total is the single most important number for fantasy. A game with a 51.5 total projects significantly more scoring — and more fantasy points across the board — than a game at 38.5. High totals mean more touchdowns, more yards, and more fantasy-relevant plays.</p>

      <h3>Implied Team Totals</h3>
      <p>By combining the spread and total, we can calculate each team's implied points. A team with an implied total of 28+ is in a prime fantasy environment. This is the number that drives FilmRoom's projections.</p>

      <h2>How FilmRoom Uses This Data</h2>
      <p>At FilmRoom, every player projection starts with the Vegas lines. We take the implied team totals and distribute expected points across each team's offensive players based on usage rates, target shares, and historical scoring patterns.</p>
      <p>The result? Projections that react to market movements in real time — not projections that were locked in on Tuesday morning by an analyst who hasn't checked the injury report since.</p>

      <h2>The Bottom Line</h2>
      <p>Expert rankings are opinions. Vegas lines are the market. When millions of dollars are on the line, the information gets priced in quickly and accurately. That's why FilmRoom builds every projection on this foundation.</p>
    `,
    author: 'FilmRoom',
    publishedAt: '2026-03-20',
    category: 'strategy',
    tags: ['vegas lines', 'projections', 'strategy', 'spreads', 'over under'],
    readingTime: 5,
  },
  {
    slug: 'fantasy-football-waiver-wire-strategy-guide',
    title: 'The Complete Fantasy Football Waiver Wire Strategy Guide',
    description: 'Master the waiver wire with this comprehensive guide covering FAAB bidding, priority strategies, and how to identify breakout players before your leaguemates.',
    content: `
      <p>Championships aren't won in the draft — they're won on the waiver wire. The managers who consistently find breakout players mid-season are the ones lifting the trophy in Week 17.</p>

      <h2>Understanding Waiver Systems</h2>
      <p>Most fantasy platforms use one of two waiver systems: <strong>rolling priority</strong> or <strong>FAAB (Free Agent Acquisition Budget)</strong>. Understanding your league's system is the first step to dominating it.</p>

      <h3>Rolling Priority</h3>
      <p>In rolling waivers, the team that made a claim most recently drops to the bottom of the priority list. The key here is patience — don't burn your top priority on a one-week wonder. Wait for the league-winning add.</p>

      <h3>FAAB Bidding</h3>
      <p>FAAB gives every team a budget (usually $100) for the entire season. This is the more skill-based system. Key principles:</p>
      <ul>
        <li>Don't be afraid to spend big early — the best waiver pickups often come in Weeks 1-4 when roles are being established</li>
        <li>Reserve at least $10-15 for late-season adds</li>
        <li>Bid odd numbers ($17 instead of $15) to win tiebreakers</li>
      </ul>

      <h2>Identifying Breakout Players</h2>
      <p>FilmRoom's <strong>Trends</strong> page tracks roster percentage changes across platforms. Here's what to look for:</p>
      <ul>
        <li><strong>Target share spikes:</strong> A player who suddenly commands 25%+ of their team's targets is a must-add</li>
        <li><strong>Snap count increases:</strong> More snaps = more opportunity, even if the box score is quiet</li>
        <li><strong>Injury-created opportunity:</strong> When a starter goes down, the backup often becomes a top waiver priority</li>
        <li><strong>Coaching changes:</strong> New play-callers can unlock previously underused players</li>
      </ul>

      <h2>Using FilmRoom for Waivers</h2>
      <p>Our waiver wire tool ranks available players by projected value for the rest of the season — not just next week. This helps you prioritize adds that will contribute for multiple weeks, not just one-week streamers.</p>
    `,
    author: 'FilmRoom',
    publishedAt: '2026-03-18',
    category: 'strategy',
    tags: ['waiver wire', 'FAAB', 'strategy', 'breakout players'],
    readingTime: 6,
  },
  {
    slug: 'ppr-vs-half-ppr-vs-standard-scoring-explained',
    title: 'PPR vs Half PPR vs Standard Scoring: Which Format Changes Player Values Most?',
    description: 'A breakdown of how PPR, Half PPR, and Standard scoring formats affect player rankings, draft strategy, and weekly lineup decisions.',
    content: `
      <p>The scoring format of your fantasy league fundamentally changes which players are most valuable. Understanding these differences is essential for making smart roster decisions.</p>

      <h2>The Three Main Scoring Formats</h2>

      <h3>Standard (Non-PPR)</h3>
      <p>In standard scoring, receptions don't earn bonus points. This makes volume rushers and touchdown-dependent players more valuable relative to pass-catchers. Running backs who get 20+ carries per game thrive here.</p>

      <h3>Full PPR (Points Per Reception)</h3>
      <p>Each reception is worth 1 point. This dramatically boosts the value of pass-catching running backs and high-volume slot receivers. A player who catches 8 passes for 60 yards and no touchdowns scores 14 points in PPR but only 6 in standard.</p>

      <h3>Half PPR (0.5 Points Per Reception)</h3>
      <p>The compromise format. Each reception is worth 0.5 points. This is increasingly the most popular format because it rewards pass-catchers without completely devaluing traditional runners.</p>

      <h2>How Rankings Change By Format</h2>
      <p>The biggest movers between formats are:</p>
      <ul>
        <li><strong>Pass-catching RBs:</strong> Players like Austin Ekeler-types gain 3-5 points per game in PPR vs Standard</li>
        <li><strong>Slot receivers:</strong> High-volume targets with shorter routes benefit enormously from PPR</li>
        <li><strong>Tight ends:</strong> Elite TEs who run routes on 90%+ of snaps become more valuable in PPR</li>
        <li><strong>Goal-line backs:</strong> Pure rushers lose relative value in PPR formats</li>
      </ul>

      <h2>FilmRoom's Multi-Format Rankings</h2>
      <p>FilmRoom generates separate projections for PPR, Half PPR, and Standard scoring. Every player's ranking adjusts automatically when you switch formats — so you're always seeing the right values for your league.</p>
    `,
    author: 'FilmRoom',
    publishedAt: '2026-03-15',
    category: 'beginners',
    tags: ['PPR', 'scoring formats', 'beginners', 'draft strategy'],
    readingTime: 4,
  },
  {
    slug: 'fantasy-football-trade-analyzer-how-to-evaluate-trades',
    title: 'How to Evaluate Fantasy Football Trades: A Data-Driven Approach',
    description: 'Stop relying on gut feelings for trades. Learn how FilmRoom\'s AI Trade Analyzer evaluates deals using rest-of-season projections, schedule strength, and positional scarcity.',
    content: `
      <p>Trade evaluation is one of the hardest skills in fantasy football. Most managers either overvalue their own players (the endowment effect) or get paralyzed by uncertainty. Here's how to think about trades like a pro.</p>

      <h2>The Framework: Value Over Replacement</h2>
      <p>Raw projected points don't tell the whole story. A QB projected for 22 points isn't as valuable as an RB projected for 18, because replacement-level QBs are easy to find on waivers while replacement-level RBs are not.</p>
      <p><strong>Value Over Replacement Player (VORP)</strong> measures how much better a player is than the best available free agent at their position. This is the foundation of smart trade analysis.</p>

      <h2>What FilmRoom's Trade Analyzer Considers</h2>
      <p>Our AI-powered trade analyzer evaluates deals across multiple dimensions:</p>
      <ul>
        <li><strong>Rest-of-season projections:</strong> Not just next week, but the full remaining schedule</li>
        <li><strong>Strength of schedule:</strong> A player facing easy matchups is worth more than one with a brutal remaining schedule</li>
        <li><strong>Positional scarcity:</strong> The replacement-level context that makes some positions more valuable than others</li>
        <li><strong>Bye week alignment:</strong> Acquiring players with different bye weeks adds value</li>
      </ul>

      <h2>Common Trade Mistakes</h2>
      <ul>
        <li><strong>Trading based on last week:</strong> One big game doesn't change a player's season-long value</li>
        <li><strong>Ignoring schedule:</strong> A player with 3 top-5 matchups remaining is a buy target</li>
        <li><strong>2-for-1 trades that look equal:</strong> Getting the best player in a trade almost always wins</li>
      </ul>

      <h2>Try It Yourself</h2>
      <p>FilmRoom's Trade Analyzer gives you an instant AI evaluation of any proposed trade. Just select the players on each side and get a data-backed verdict in seconds.</p>
    `,
    author: 'FilmRoom',
    publishedAt: '2026-03-12',
    category: 'tools',
    tags: ['trade analyzer', 'trades', 'strategy', 'VORP'],
    readingTime: 5,
  },
  {
    slug: 'start-sit-decision-making-framework',
    title: 'The Ultimate Start/Sit Decision Framework for Fantasy Football',
    description: 'A systematic approach to making weekly start/sit decisions using matchup data, Vegas lines, and usage trends instead of gut feelings.',
    content: `
      <p>Every week, fantasy managers agonize over start/sit decisions. Should you start the stud in a bad matchup or the streamer in a great one? Here's a framework to make these calls with confidence.</p>

      <h2>Step 1: Check the Vegas Lines</h2>
      <p>Before anything else, look at the game environment:</p>
      <ul>
        <li><strong>High total (48+):</strong> Both offenses are expected to produce — good for all skill players</li>
        <li><strong>Large spread (7+):</strong> The trailing team will likely throw more, boosting WRs. The leading team will run more.</li>
        <li><strong>Low total (40 or below):</strong> This is a bad fantasy environment. Only start your true studs here.</li>
      </ul>

      <h2>Step 2: Evaluate the Matchup</h2>
      <p>Not all defenses are created equal. Key things to check:</p>
      <ul>
        <li>Points allowed to the position over the last 4 weeks (recent form matters more than season-long)</li>
        <li>Defensive injuries — a missing starting cornerback can turn a tough matchup into a smash spot</li>
        <li>Indoor vs outdoor, dome vs weather — wind and rain suppress passing production</li>
      </ul>

      <h2>Step 3: Confirm the Usage</h2>
      <p>Talent and matchup don't matter without opportunity. Check:</p>
      <ul>
        <li>Target share (WR/TE) or carry share (RB) over the last 3 games</li>
        <li>Snap percentage — is the player on the field for 80%+ of snaps?</li>
        <li>Red zone usage — who's getting the scoring opportunities?</li>
      </ul>

      <h2>Step 4: Trust the Process</h2>
      <p>Once you've checked the game environment, matchup, and usage, make your decision and don't second-guess it. The goal isn't to be right every time — it's to make the best decision with the available information.</p>

      <p>FilmRoom's player rankings incorporate all of these factors automatically, giving you a single projected score that accounts for matchup, game environment, and usage patterns.</p>
    `,
    author: 'FilmRoom',
    publishedAt: '2026-03-08',
    category: 'strategy',
    tags: ['start sit', 'lineup decisions', 'matchups', 'strategy'],
    readingTime: 5,
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find(a => a.slug === slug);
}

export function getArticlesByCategory(category: Article['category']): Article[] {
  return articles.filter(a => a.category === category);
}
