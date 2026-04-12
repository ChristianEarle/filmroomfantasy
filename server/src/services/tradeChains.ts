/**
 * Trade Chain / Trade Tree builder.
 *
 * A "trade chain" traces the lineage of players through successive
 * trades on the user's team. When a player arrives via Trade A and
 * is later sent away in Trade B (bringing back new players), those
 * trades form a parent→child link. Chains can branch when a single
 * trade brings multiple players that are later traded in separate
 * transactions.
 *
 * The algorithm is purely in-memory — the route handler fetches all
 * trades, items, and weekly stats in bulk, then passes them here.
 */

// ── Types ───────────────────────────────────────────────────────────

export interface TradeTreePlayerReceived {
  playerId: string | null;
  playerName: string;
  position: string;
  nflTeam: string;
  /** PPR points this player scored while on the user's roster
   *  (bounded from the week after the incoming trade to either the
   *  week of the outgoing trade or end of season). */
  pointsWhileHeld: number;
  weeksHeld: number;
  /** If this player was subsequently traded away, which child index? */
  tradedAwayInChildIndex: number | null;
  pickYear: number | null;
  pickRound: number | null;
}

export interface TradeTreePlayerSent {
  playerId: string | null;
  playerName: string;
  position: string;
  nflTeam: string;
  /** PPR points this player scored AFTER being traded away
   *  (opportunity cost). */
  pointsAfterTrade: number;
  pickYear: number | null;
  pickRound: number | null;
}

export interface TradeTreeNode {
  tradeId: string;
  executedAt: string | null;
  weekExecuted: number | null;
  seasonYear: number | null;
  received: TradeTreePlayerReceived[];
  sent: TradeTreePlayerSent[];
  /** Points differential at THIS node only (sum of received pointsWhileHeld − sent pointsAfterTrade). */
  nodeDifferential: number;
  /** Cumulative differential from this node through all descendants. */
  cumulativeDifferential: number;
  /** Depth in the tree (0 = root). */
  depth: number;
  aiGrade: string | null;
  children: TradeTreeNode[];
}

export interface TradeTreeSummary {
  totalChains: number;
  longestChainDepth: number;
  bestChainDifferential: number;
  worstChainDifferential: number;
  totalPointsGained: number;
}

// ── Minimal trade/item shapes expected by the builder ───────────────

export interface TradeLike {
  id: string;
  executedAt: Date | null;
  weekExecuted: number | null;
  seasonYear: number | null;
  aiGrade: string | null;
}

export interface TradeItemLike {
  tradeId: string;
  fromTeamId: string;
  toTeamId: string;
  playerId: string | null;
  draftPickYear: number | null;
  draftPickRound: number | null;
}

export interface PlayerInfo {
  name: string;
  position: string;
  team: string;
}

// ── Algorithm ───────────────────────────────────────────────────────

/**
 * Build trade chains for the calling user.
 *
 * @param callerTeamIds  All team IDs that belong to the caller in this league
 * @param trades         All executed trades in the league, sorted by executedAt desc
 * @param items          All trade items for those trades
 * @param pointsByPlayerWeek  Map of `${playerId}_${seasonYear}_${week}` → PPR points
 * @param playerInfoById Map of playerId → { name, position, team }
 * @param lastWeekBySeason Map of seasonYear → last completed week number
 */
export function buildTradeChains(
  callerTeamIds: Set<string>,
  trades: TradeLike[],
  items: TradeItemLike[],
  pointsByPlayerWeek: Map<string, number>,
  playerInfoById: Map<string, PlayerInfo>,
  lastWeekBySeason: Map<number, number>
): TradeTreeNode[] {
  // Sort trades by execution time ascending for temporal ordering
  const sortedTrades = [...trades].sort((a, b) => {
    const aTime = a.executedAt?.getTime() ?? 0;
    const bTime = b.executedAt?.getTime() ?? 0;
    if (aTime !== bTime) return aTime - bTime;
    return (a.weekExecuted ?? 0) - (b.weekExecuted ?? 0);
  });

  const tradeById = new Map(sortedTrades.map((t) => [t.id, t]));

  // Index items by trade
  const itemsByTradeId = new Map<string, TradeItemLike[]>();
  for (const item of items) {
    const list = itemsByTradeId.get(item.tradeId) || [];
    list.push(item);
    itemsByTradeId.set(item.tradeId, list);
  }

  // Step 1: For each player, track all trades where they were received
  // by the caller (sorted chronologically).
  const incomingByPlayer = new Map<string, Array<{ tradeId: string; executedAt: number; weekExecuted: number }>>();
  for (const trade of sortedTrades) {
    const tradeItems = itemsByTradeId.get(trade.id) || [];
    for (const item of tradeItems) {
      if (!item.playerId) continue;
      if (!callerTeamIds.has(item.toTeamId)) continue;
      const list = incomingByPlayer.get(item.playerId) || [];
      list.push({
        tradeId: trade.id,
        executedAt: trade.executedAt?.getTime() ?? 0,
        weekExecuted: trade.weekExecuted ?? 0,
      });
      incomingByPlayer.set(item.playerId, list);
    }
  }

  // Step 2: For each trade where the caller sent players, link to the
  // incoming trade that brought that player.
  // parentOf[childTradeId] = Set of parentTradeIds
  // childrenOf[parentTradeId] = Array of { childTradeId, linkingPlayerId }
  const childrenOf = new Map<string, Array<{ childTradeId: string; playerId: string }>>();
  const parentOf = new Map<string, Set<string>>();
  // Track which incoming trade each outgoing player links to
  const linkMap = new Map<string, Map<string, string>>(); // childTradeId → playerId → parentTradeId

  for (const trade of sortedTrades) {
    const tradeItems = itemsByTradeId.get(trade.id) || [];
    for (const item of tradeItems) {
      if (!item.playerId) continue;
      if (!callerTeamIds.has(item.fromTeamId)) continue;

      // Find the most recent incoming trade for this player BEFORE this trade
      const incoming = incomingByPlayer.get(item.playerId);
      if (!incoming || incoming.length === 0) continue;

      const tradeTime = trade.executedAt?.getTime() ?? 0;
      // Find latest incoming that was before this outgoing
      let bestMatch: { tradeId: string } | null = null;
      for (let i = incoming.length - 1; i >= 0; i--) {
        if (incoming[i].executedAt < tradeTime || (incoming[i].executedAt === tradeTime && incoming[i].tradeId !== trade.id)) {
          bestMatch = incoming[i];
          break;
        }
      }
      if (!bestMatch) continue;

      // Create parent→child link
      const children = childrenOf.get(bestMatch.tradeId) || [];
      // Avoid duplicate links (same child trade linked via multiple players)
      if (!children.some((c) => c.childTradeId === trade.id && c.playerId === item.playerId)) {
        children.push({ childTradeId: trade.id, playerId: item.playerId });
        childrenOf.set(bestMatch.tradeId, children);
      }

      const parents = parentOf.get(trade.id) || new Set();
      parents.add(bestMatch.tradeId);
      parentOf.set(trade.id, parents);

      // Track the link
      const links = linkMap.get(trade.id) || new Map();
      links.set(item.playerId, bestMatch.tradeId);
      linkMap.set(trade.id, links);
    }
  }

  // Step 3: Identify root trades — trades where the caller received
  // players that have NO parent link (i.e., the player entered via
  // this trade, not from a prior trade in the chain).
  const callerTradeIds = new Set<string>();
  for (const trade of sortedTrades) {
    const tradeItems = itemsByTradeId.get(trade.id) || [];
    const isInvolved = tradeItems.some(
      (i) => callerTeamIds.has(i.fromTeamId) || callerTeamIds.has(i.toTeamId)
    );
    if (isInvolved) callerTradeIds.add(trade.id);
  }

  // A trade is a root if it has children OR received players, and it's
  // not a child of another trade (or only partially a child).
  // More precisely: a root is a caller trade that either has no parents
  // at all, or has at least one received player not linked from a parent.
  const rootTradeIds = new Set<string>();
  for (const tradeId of callerTradeIds) {
    if (!parentOf.has(tradeId)) {
      // No parents at all — this could be a root if the user received players
      const tradeItems = itemsByTradeId.get(tradeId) || [];
      const hasReceived = tradeItems.some(
        (i) => callerTeamIds.has(i.toTeamId) && i.playerId
      );
      const hasChildren = childrenOf.has(tradeId);
      // Only create a root if this trade starts a chain (has children)
      // OR received players (for single-node display)
      if (hasReceived && hasChildren) {
        rootTradeIds.add(tradeId);
      }
    }
  }

  // Step 4: Build tree nodes recursively
  const visited = new Set<string>();

  function buildNode(tradeId: string, depth: number): TradeTreeNode | null {
    if (visited.has(tradeId)) return null; // prevent cycles
    visited.add(tradeId);

    const trade = tradeById.get(tradeId);
    if (!trade) return null;

    const tradeItems = itemsByTradeId.get(tradeId) || [];

    // Build children first (bottom-up for cumulative stats)
    const childLinks = childrenOf.get(tradeId) || [];
    // Group by child trade ID
    const childTradeIds = [...new Set(childLinks.map((c) => c.childTradeId))];
    const children: TradeTreeNode[] = [];
    for (const childTradeId of childTradeIds) {
      const childNode = buildNode(childTradeId, depth + 1);
      if (childNode) children.push(childNode);
    }

    // Build the "received" list — players the caller got in this trade
    const received: TradeTreePlayerReceived[] = [];
    for (const item of tradeItems) {
      if (!callerTeamIds.has(item.toTeamId)) continue;

      const info = item.playerId ? playerInfoById.get(item.playerId) : null;
      const playerName = info?.name
        || (item.draftPickYear ? `${item.draftPickYear} Round ${item.draftPickRound ?? '?'}` : 'Unknown');

      // Find if this player was traded away (links to a child)
      let tradedAwayInChildIndex: number | null = null;
      let endWeek: number | null = null;
      let endSeason: number | null = null;

      if (item.playerId) {
        for (let ci = 0; ci < children.length; ci++) {
          const childTrade = tradeById.get(children[ci].tradeId);
          const childItems = itemsByTradeId.get(children[ci].tradeId) || [];
          const wasThisPlayerSent = childItems.some(
            (ci2) => ci2.playerId === item.playerId && callerTeamIds.has(ci2.fromTeamId)
          );
          if (wasThisPlayerSent && childTrade) {
            tradedAwayInChildIndex = ci;
            endWeek = childTrade.weekExecuted;
            endSeason = childTrade.seasonYear;
            break;
          }
        }
      }

      // Compute points while held
      const startWeek = (trade.weekExecuted ?? 0) + 1;
      const startSeason = trade.seasonYear ?? 0;
      let pointsWhileHeld = 0;
      let weeksHeld = 0;

      if (item.playerId && startSeason > 0) {
        if (endWeek != null && endSeason != null && endSeason === startSeason) {
          // Same season: sum weeks [startWeek, endWeek]
          for (let w = startWeek; w <= endWeek; w++) {
            const pts = pointsByPlayerWeek.get(`${item.playerId}_${startSeason}_${w}`) ?? 0;
            pointsWhileHeld += pts;
            weeksHeld++;
          }
        } else {
          // Player still held (or cross-season) — sum to end of season
          const lastWeek = lastWeekBySeason.get(startSeason) ?? 18;
          for (let w = startWeek; w <= lastWeek; w++) {
            const pts = pointsByPlayerWeek.get(`${item.playerId}_${startSeason}_${w}`) ?? 0;
            pointsWhileHeld += pts;
            weeksHeld++;
          }
          // If cross-season (dynasty), also sum the next season up to the outgoing week
          if (endSeason != null && endSeason > startSeason) {
            const crossLastWeek = endWeek ?? (lastWeekBySeason.get(endSeason) ?? 18);
            for (let w = 1; w <= crossLastWeek; w++) {
              const pts = pointsByPlayerWeek.get(`${item.playerId}_${endSeason}_${w}`) ?? 0;
              pointsWhileHeld += pts;
              weeksHeld++;
            }
          }
        }
      }

      pointsWhileHeld = Math.round(pointsWhileHeld * 10) / 10;

      received.push({
        playerId: item.playerId,
        playerName,
        position: info?.position || (item.draftPickYear ? 'PICK' : 'UNK'),
        nflTeam: info?.team || '',
        pointsWhileHeld,
        weeksHeld,
        tradedAwayInChildIndex,
        pickYear: item.draftPickYear,
        pickRound: item.draftPickRound,
      });
    }

    // Build the "sent" list — players the caller gave up in this trade
    const sent: TradeTreePlayerSent[] = [];
    for (const item of tradeItems) {
      if (!callerTeamIds.has(item.fromTeamId)) continue;

      const info = item.playerId ? playerInfoById.get(item.playerId) : null;
      const playerName = info?.name
        || (item.draftPickYear ? `${item.draftPickYear} Round ${item.draftPickRound ?? '?'}` : 'Unknown');

      // Points scored after the trade (opportunity cost)
      let pointsAfterTrade = 0;
      const startWeek = (trade.weekExecuted ?? 0) + 1;
      const season = trade.seasonYear ?? 0;
      if (item.playerId && season > 0) {
        const lastWeek = lastWeekBySeason.get(season) ?? 18;
        for (let w = startWeek; w <= lastWeek; w++) {
          pointsAfterTrade += pointsByPlayerWeek.get(`${item.playerId}_${season}_${w}`) ?? 0;
        }
      }
      pointsAfterTrade = Math.round(pointsAfterTrade * 10) / 10;

      sent.push({
        playerId: item.playerId,
        playerName,
        position: info?.position || (item.draftPickYear ? 'PICK' : 'UNK'),
        nflTeam: info?.team || '',
        pointsAfterTrade,
        pickYear: item.draftPickYear,
        pickRound: item.draftPickRound,
      });
    }

    const receivedTotal = received.reduce((sum, r) => sum + r.pointsWhileHeld, 0);
    const sentTotal = sent.reduce((sum, s) => sum + s.pointsAfterTrade, 0);
    const nodeDifferential = Math.round((receivedTotal - sentTotal) * 10) / 10;

    const childrenCumulative = children.reduce((sum, c) => sum + c.cumulativeDifferential, 0);
    const cumulativeDifferential = Math.round((nodeDifferential + childrenCumulative) * 10) / 10;

    return {
      tradeId,
      executedAt: trade.executedAt?.toISOString() ?? null,
      weekExecuted: trade.weekExecuted,
      seasonYear: trade.seasonYear,
      received,
      sent,
      nodeDifferential,
      cumulativeDifferential,
      depth,
      aiGrade: trade.aiGrade,
      children,
    };
  }

  // Build all root trees, sorted by execution time (most recent first)
  const trees: TradeTreeNode[] = [];
  for (const rootId of rootTradeIds) {
    visited.clear();
    const tree = buildNode(rootId, 0);
    if (tree) trees.push(tree);
  }

  // Sort: most recent chain first
  trees.sort((a, b) => {
    const aTime = a.executedAt ? new Date(a.executedAt).getTime() : 0;
    const bTime = b.executedAt ? new Date(b.executedAt).getTime() : 0;
    return bTime - aTime;
  });

  return trees;
}

/** Walk a tree to find max depth. */
function maxDepth(node: TradeTreeNode): number {
  if (node.children.length === 0) return node.depth;
  return Math.max(...node.children.map(maxDepth));
}

export function computeChainSummary(trees: TradeTreeNode[]): TradeTreeSummary {
  if (trees.length === 0) {
    return {
      totalChains: 0,
      longestChainDepth: 0,
      bestChainDifferential: 0,
      worstChainDifferential: 0,
      totalPointsGained: 0,
    };
  }

  const diffs = trees.map((t) => t.cumulativeDifferential);
  const depths = trees.map(maxDepth);

  return {
    totalChains: trees.length,
    longestChainDepth: Math.max(...depths),
    bestChainDifferential: Math.max(...diffs),
    worstChainDifferential: Math.min(...diffs),
    totalPointsGained: Math.round(diffs.reduce((a, b) => a + b, 0) * 10) / 10,
  };
}
