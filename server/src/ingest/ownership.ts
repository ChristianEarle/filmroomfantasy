import { getOwner } from './ledger';

/**
 * True unless `group` has been cut over to the ingest Worker. Fails open: when
 * the owner can't be read (a missing table, D1 down), the legacy cron keeps
 * writing, so a broken switch never leaves a dataset with no writer.
 */
export async function legacyOwns(db: D1Database, group: string): Promise<boolean> {
  try {
    return (await getOwner(db, group)) !== 'ingest';
  } catch (error) {
    console.error(`[ingest] could not read the owner of '${group}'; leaving it to the legacy cron:`, error);
    return true;
  }
}
