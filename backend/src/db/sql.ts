import sql from "mssql";
import { getPool } from "./pool";

export async function execProc<T = any>(
  procName: string,
  input: (req: sql.Request) => void
): Promise<sql.IProcedureResult<T>> {
  const pool = await getPool();
  const req = pool.request();
  input(req);
  return req.execute<T>(procName);
}

export async function execProcTx<T = any>(
	tx: sql.Transaction,
	procName: string,
	input: (req: sql.Request) => void
): Promise<sql.IProcedureResult<T>> {
	const req = new sql.Request(tx);
	input(req);
	return req.execute<T>(procName);
}

export async function query<T = any>(
  sqlText: string,
  input?: (req: sql.Request) => void
): Promise<T[]> {
  const pool = await getPool();
  const req = pool.request();
  if (input) input(req);
  const result = await req.query<T>(sqlText);
  return (result.recordset ?? []) as T[];
}

export async function queryRaw<T = any>(
	sqlText: string,
	input?: (req: sql.Request) => void
): Promise<sql.IResult<T>> {
	const pool = await getPool();
	const req = pool.request();
	if (input) input(req);
	return req.query<T>(sqlText);
}

export async function queryTx<T = any>(
  tx: sql.Transaction,
  sqlText: string,
  input?: (req: sql.Request) => void
): Promise<T[]> {
  const req = new sql.Request(tx);
  if (input) input(req);
  const result = await req.query<T>(sqlText);
  return (result.recordset ?? []) as T[];
}

export async function withTransaction<T>(fn: (tx: sql.Transaction) => Promise<T>): Promise<T> {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // ignore rollback failures
    }
    throw err;
  }
}

// Backward-compat alias used by some utilities.
export const transaction = withTransaction;
