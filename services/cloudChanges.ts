// Only rows changed since an authenticated read/write may be sent back.
// This reduces stale bulk writes; it is NOT same-row optimistic concurrency.
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export class CloudChanges {
  private baselines = new Map<string, Map<string, string>>();
  capture(scope: string, rows: Array<{ id: string }>) {
    this.baselines.set(scope, new Map(rows.map(row => [row.id, canonical(row)])));
  }
  changed(scope: string, rows: Array<{ id: string }>) {
    const baseline = this.baselines.get(scope);
    if (!baseline) throw new Error('Os dados da nuvem ainda não foram carregados. Recarregue antes de sincronizar.');
    return rows.filter(row => baseline.get(row.id) !== canonical(row));
  }
  acknowledged(scope: string, rows: Array<{ id: string }>) {
    const baseline = this.baselines.get(scope);
    if (!baseline) throw new Error('Sincronização sem leitura autenticada.');
    for (const row of rows) baseline.set(row.id, canonical(row));
  }
  assertNoUnconfirmedRemovals(scope: string, rows: Array<{ id: string }>) {
    const baseline = this.baselines.get(scope);
    if (!baseline) throw new Error('Leitura autenticada ainda não concluída.');
    const ids = new Set(rows.map(row => row.id));
    if ([...baseline.keys()].some(id => !ids.has(id))) {
      throw new Error('Uma exclusão ou coleção incompleta não foi confirmada no servidor. A sincronização foi suspensa para preservar os registros.');
    }
  }
  clear() { this.baselines.clear(); }
}
