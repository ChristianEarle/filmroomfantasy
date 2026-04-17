import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://filmroomfantasy.com';

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  type?: string;
  image?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

// Per-route SEO metadata
const ROUTE_SEO: Record<string, { title: string; description: string }> = {
  Landing: {
    title: 'FilmRoom - Fantasy Football Analysis & Management',
    description: 'Manage your fantasy football leagues with advanced analytics, player projections, waiver wire analysis, and real-time stats from Sleeper and ESPN.',
  },
  Board: {
    title: 'Fantasy Football Player Rankings | FilmRoom',
    description: 'Weekly fantasy football player rankings powered by Vegas lines. PPR, Half PPR, and Standard scoring projections updated every 4 hours.',
  },
  Home: {
    title: 'Dashboard | FilmRoom',
    description: 'Your fantasy football command center. View your team, matchups, and league activity all in one place.',
  },
  Team: {
    title: 'My Team | FilmRoom',
    description: 'Manage your fantasy football roster with advanced player projections and start/sit recommendations.',
  },
  Matchup: {
    title: 'Matchup Analysis | FilmRoom',
    description: 'Analyze your weekly fantasy football matchup with player-by-player projections and win probability.',
  },
  Waivers: {
    title: 'Waiver Wire Picks | FilmRoom',
    description: 'Find the best waiver wire pickups and free agent adds for your fantasy football league, ranked by projected value.',
  },
  GameSlate: {
    title: 'NFL Game Slate & Scores | FilmRoom',
    description: 'Live NFL game slate with scores, spreads, over/unders, and fantasy-relevant stats for every matchup.',
  },
  Trends: {
    title: 'Fantasy Football Trends | FilmRoom',
    description: 'Track trending players, roster percentages, and add/drop activity across fantasy football leagues.',
  },
  Research: {
    title: 'Player Research & Analysis | FilmRoom',
    description: 'In-depth fantasy football player analysis with Vegas props, game logs, projection accuracy tracking, and advanced metrics.',
  },
  Playoffs: {
    title: 'Fantasy Football Playoff Predictor | FilmRoom',
    description: 'Simulate your fantasy football playoff scenarios with AI-powered predictions and strength of schedule analysis.',
  },
  DraftRankings: {
    title: 'Fantasy Football Draft Rankings | FilmRoom',
    description: 'AI-powered fantasy football draft rankings with ADP tracking, tier breakdowns, and custom scoring projections.',
  },
  LeagueAnalyzer: {
    title: 'League Analyzer | FilmRoom',
    description: 'Deep dive into your fantasy football league with power rankings, strength of schedule, and roster composition analysis.',
  },
  TradeAnalyzer: {
    title: 'AI Trade Analyzer | FilmRoom',
    description: 'Evaluate fantasy football trades with AI-powered analysis. Get instant trade values and fair deal recommendations.',
  },
  Pricing: {
    title: 'Pricing & Plans | FilmRoom',
    description: 'FilmRoom pricing plans. Free fantasy football rankings, Pro features for serious managers, and Elite tools for the competitive edge.',
  },
  Login: {
    title: 'Sign In | FilmRoom',
    description: 'Sign in to your FilmRoom account to access your fantasy football leagues, rankings, and personalized projections.',
  },
  Register: {
    title: 'Sign Up Free | FilmRoom',
    description: 'Create a free FilmRoom account. Get access to fantasy football rankings, projections, and league management tools.',
  },
  AllPlayers: {
    title: 'All Players | FilmRoom',
    description: 'Browse all fantasy football players with rankings, projections, and stats across every position and scoring format.',
  },
  Settings: {
    title: 'Settings | FilmRoom',
    description: 'Manage your FilmRoom account settings, league connections, and preferences.',
  },
  Profile: {
    title: 'Profile | FilmRoom',
    description: 'View and update your FilmRoom profile and account information.',
  },
  Articles: {
    title: 'Fantasy Football Articles & Guides | FilmRoom',
    description: 'Expert fantasy football strategy guides, rankings analysis, waiver wire tips, and beginner resources.',
  },
  Privacy: {
    title: 'Privacy Policy | FilmRoom',
    description: 'FilmRoom Fantasy privacy policy. Learn how we collect, use, and protect your personal information and league data.',
  },
  Terms: {
    title: 'Terms of Service | FilmRoom',
    description: 'FilmRoom Fantasy terms of service. Read the terms and conditions governing your use of our fantasy football analysis platform.',
  },
  CookiePolicy: {
    title: 'Cookie Policy | FilmRoom',
    description: 'Learn about the cookies FilmRoom Fantasy uses, how we use them, and how to control your preferences.',
  },
  DMCA: {
    title: 'DMCA & Copyright Policy | FilmRoom',
    description: 'How to report copyright infringement on FilmRoom Fantasy and our process for handling DMCA takedown notices.',
  },
  Refunds: {
    title: 'Refund & Cancellation Policy | FilmRoom',
    description: 'How FilmRoom Fantasy subscription billing, cancellations, and refunds work.',
  },
  DoNotSell: {
    title: 'Do Not Sell or Share My Personal Information | FilmRoom',
    description: 'California and state privacy rights. Opt out of the sale or sharing of your personal information on FilmRoom Fantasy.',
  },
  Disclaimer: {
    title: 'Disclaimer | FilmRoom',
    description: 'FilmRoom Fantasy disclaimer. Our rankings, projections, and analysis are for informational purposes only.',
  },
  Accessibility: {
    title: 'Accessibility Statement | FilmRoom',
    description: "FilmRoom Fantasy's commitment to accessibility and our progress toward WCAG 2.1 AA conformance.",
  },
  AcceptableUse: {
    title: 'Acceptable Use Policy | FilmRoom',
    description: 'The rules for using FilmRoom Fantasy. Prohibited activities and enforcement.',
  },
};

// View name to URL path mapping
const VIEW_TO_PATH: Record<string, string> = {
  Landing: '/',
  Home: '/home',
  Board: '/player-rankings',
  Matchup: '/matchup',
  Team: '/team',
  Waivers: '/waivers',
  GameSlate: '/game-slate',
  Trends: '/trends',
  Research: '/research',
  Playoffs: '/playoff-predictor',
  DraftRankings: '/draft-rankings',
  LeagueAnalyzer: '/league-analyzer',
  TradeAnalyzer: '/trade-analyzer',
  Settings: '/settings',
  Profile: '/profile',
  Login: '/login',
  Register: '/register',
  AllPlayers: '/all-players',
  Pricing: '/pricing',
  Articles: '/articles',
  Admin: '/admin',
  Privacy: '/privacy',
  Terms: '/terms',
  CookiePolicy: '/cookies',
  DMCA: '/dmca',
  Refunds: '/refunds',
  DoNotSell: '/do-not-sell',
  Disclaimer: '/disclaimer',
  Accessibility: '/accessibility',
  AcceptableUse: '/acceptable-use',
};

export function SEO({ title, description, path, type = 'website', image, noindex, jsonLd }: SEOProps) {
  const finalTitle = title || 'FilmRoom - Fantasy Football Analysis & Management';
  const finalDescription = description || 'Manage your fantasy football leagues with advanced analytics, player projections, waiver wire analysis, and real-time stats.';
  const finalPath = path || '/';
  const canonicalUrl = `${BASE_URL}${finalPath}`;
  const ogImage = image || `${BASE_URL}/og-image.png`;

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={canonicalUrl} />
      <meta property="twitter:title" content={finalTitle} />
      <meta property="twitter:description" content={finalDescription} />
      <meta property="twitter:image" content={ogImage} />

      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(jsonLd) ? jsonLd : jsonLd)}
        </script>
      )}
    </Helmet>
  );
}

/** Get SEO props for a given view name */
export function getSEOPropsForView(view: string, authView?: string): SEOProps {
  // Handle register sub-view
  const effectiveView = view === 'Login' && authView === 'register' ? 'Register' : view;
  const seo = ROUTE_SEO[effectiveView];
  const path = VIEW_TO_PATH[effectiveView] || '/';

  const props: SEOProps = {
    title: seo?.title,
    description: seo?.description,
    path,
  };

  // Noindex private/authenticated pages
  // Noindex private/authenticated pages and thin-content pages (AdSense compliance)
  const noindexViews = [
    'Home', 'Team', 'Matchup', 'Settings', 'Profile', 'Admin', 'AllPlayers', // private
    'Login', 'Register',                                                       // utility screens
    'Research', 'LeagueAnalyzer',                                               // Coming Soon placeholders
    'NotFound',                                                                 // 404 page
  ];
  if (noindexViews.includes(effectiveView)) {
    props.noindex = true;
  }

  // Add structured data for specific pages
  if (effectiveView === 'Landing') {
    props.jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': 'FilmRoom',
        'url': BASE_URL,
        'description': 'Fantasy football analysis and league management with player projections, waiver wire tools, and playoff predictions.',
        'applicationCategory': 'SportsApplication',
        'operatingSystem': 'Web',
        'offers': {
          '@type': 'AggregateOffer',
          'lowPrice': '0',
          'highPrice': '9.99',
          'priceCurrency': 'USD',
          'offerCount': '3',
        },
        'creator': {
          '@type': 'Organization',
          'name': 'FilmRoom',
          'url': BASE_URL,
        },
        'featureList': [
          'Vegas-powered player rankings',
          'Waiver wire analysis',
          'AI trade analyzer',
          'Playoff predictor',
          'Multi-platform league sync (Sleeper, ESPN, Yahoo)',
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        'name': 'How to Get Started with FilmRoom Fantasy Football',
        'description': 'Set up your fantasy football dashboard in three simple steps.',
        'step': [
          {
            '@type': 'HowToStep',
            'position': 1,
            'name': 'Connect your league',
            'text': 'Enter your Sleeper username or link your Yahoo/ESPN account. Your league data, rosters, and schedule sync in under a second.',
          },
          {
            '@type': 'HowToStep',
            'position': 2,
            'name': 'Check the numbers',
            'text': 'Player rankings built off Vegas lines, scoring trends, and real stat breakdowns. Filter by position, scoring format, and week.',
          },
          {
            '@type': 'HowToStep',
            'position': 3,
            'name': 'Make better decisions',
            'text': 'Start/sit calls backed by data. Waiver pickups before your leaguemates notice. Trade offers you can actually evaluate.',
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        ],
      },
    ];
  }

  if (effectiveView === 'Board') {
    props.jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        'name': 'Fantasy Football Player Rankings',
        'description': seo?.description,
        'url': `${BASE_URL}/player-rankings`,
        'isPartOf': { '@type': 'WebApplication', 'name': 'FilmRoom' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
          { '@type': 'ListItem', 'position': 2, 'name': 'Player Rankings', 'item': `${BASE_URL}/player-rankings` },
        ],
      },
    ];
  }

  if (effectiveView === 'Waivers') {
    props.jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Waiver Wire', 'item': `${BASE_URL}/waivers` },
      ],
    };
  }

  if (effectiveView === 'TradeAnalyzer') {
    props.jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        'name': 'AI Fantasy Football Trade Analyzer',
        'description': seo?.description,
        'url': `${BASE_URL}/trade-analyzer`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
          { '@type': 'ListItem', 'position': 2, 'name': 'Trade Analyzer', 'item': `${BASE_URL}/trade-analyzer` },
        ],
      },
    ];
  }

  if (effectiveView === 'Pricing') {
    props.jsonLd = [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': 'FilmRoom Fantasy Football',
        'description': 'Fantasy football analysis platform with player rankings, trade analyzer, and league management tools.',
        'brand': { '@type': 'Brand', 'name': 'FilmRoom' },
        'offers': [
          {
            '@type': 'Offer',
            'name': 'Free',
            'price': '0',
            'priceCurrency': 'USD',
            'description': 'Player rankings, game slate, news, 1 league sync, 3 trade analyses/day',
          },
          {
            '@type': 'Offer',
            'name': 'Pro',
            'price': '4.99',
            'priceCurrency': 'USD',
            'priceSpecification': { '@type': 'UnitPriceSpecification', 'price': '4.99', 'priceCurrency': 'USD', 'billingDuration': 'P1M' },
            'description': 'Unlimited league syncs, trending players, 5 trade analyses/day',
          },
          {
            '@type': 'Offer',
            'name': 'Elite',
            'price': '9.99',
            'priceCurrency': 'USD',
            'priceSpecification': { '@type': 'UnitPriceSpecification', 'price': '9.99', 'priceCurrency': 'USD', 'billingDuration': 'P1M' },
            'description': 'Deep player research, Vegas props, game logs, unlimited trade analyses',
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
          { '@type': 'ListItem', 'position': 2, 'name': 'Pricing', 'item': `${BASE_URL}/pricing` },
        ],
      },
    ];
  }

  if (effectiveView === 'Trends') {
    props.jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'Trends', 'item': `${BASE_URL}/trends` },
      ],
    };
  }

  if (effectiveView === 'GameSlate') {
    props.jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': 'NFL Games', 'item': `${BASE_URL}/game-slate` },
      ],
    };
  }

  // Breadcrumbs for remaining public pages
  const breadcrumbOnlyPages: Record<string, string> = {
    Playoffs: 'Playoff Predictor',
    DraftRankings: 'Draft Rankings',
    LeagueAnalyzer: 'League Analyzer',
    Research: 'Research',
    Articles: 'Articles',
    Login: 'Sign In',
    Register: 'Sign Up',
  };

  if (breadcrumbOnlyPages[effectiveView] && !props.jsonLd) {
    const pagePath = VIEW_TO_PATH[effectiveView] || '/';
    props.jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL },
        { '@type': 'ListItem', 'position': 2, 'name': breadcrumbOnlyPages[effectiveView], 'item': `${BASE_URL}${pagePath}` },
      ],
    };
  }

  return props;
}
