import { useState } from 'react';
import { del, get, post, put, type Reward } from '../api';
import { Drawer, Empty, ErrorNote, Field, Loading, PageHead, useLoad, useToast } from '../ui';

function RewardFormDrawer({ reward, onClose, onSaved }: { reward?: Reward; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: reward?.name ?? '', description: reward?.description ?? '', pointsCost: reward ? String(reward.pointsCost) : '' });
  const [active, setActive] = useState(reward?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true); setError(null);
    const body = { name: form.name.trim(), description: form.description.trim() || undefined, pointsCost: Number(form.pointsCost), active };
    try {
      if (reward) await put(`/rewards/${reward.id}`, body); else await post('/rewards', body);
      toast(reward ? 'Reward updated.' : 'Reward added.');
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Drawer title={reward ? 'Edit reward' : 'Add reward'} onClose={onClose} footer={
      <>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !form.name.trim() || !(Number(form.pointsCost) >= 1)} onClick={save}>{busy ? 'Saving…' : 'Save reward'}</button>
      </>
    }>
      <Field label="Reward"><input value={form.name} onChange={set('name')} placeholder="Free blow-dry" autoFocus /></Field>
      <Field label="Points needed"><input type="number" min={1} step={1} value={form.pointsCost} onChange={set('pointsCost')} /></Field>
      <Field label="Details"><textarea rows={3} value={form.description} onChange={set('description')} /></Field>
      {reward && <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Available to redeem</label>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </Drawer>
  );
}

export default function RewardsPage() {
  const toast = useToast();
  const list = useLoad(() => get<Reward[]>('/rewards'), []);
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);

  async function retire(r: Reward) {
    if (!window.confirm(`Stop offering "${r.name}"? Points already redeemed are not affected.`)) return;
    try { await del(`/rewards/${r.id}`); toast(`${r.name} is no longer offered.`); list.reload(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <>
      <PageHead title="Rewards" sub="What loyal customers can redeem their points for.">
        <button className="btn btn-primary" onClick={() => setEditing('new')}>Add reward</button>
      </PageHead>
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.data && list.data.length === 0 && <Empty title="No rewards yet" hint="Add rewards like a free blow-dry or a discount so customers have something to work toward." />}
      {list.data && list.data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Reward</th><th className="num">Points</th><th /></tr></thead>
            <tbody>
              {list.data.map((r) => (
                <tr key={r.id} className={r.active ? '' : 'dim'}>
                  <td><strong>{r.name}</strong>{!r.active && <span className="muted"> · not offered</span>}{r.description && <><br /><span className="muted">{r.description}</span></>}</td>
                  <td className="num">{r.pointsCost}</td>
                  <td className="row-actions">
                    <button className="btn btn-quiet" onClick={() => setEditing(r)}>Edit</button>
                    {r.active && <button className="btn btn-danger-quiet" onClick={() => retire(r)}>Stop offering</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <RewardFormDrawer reward={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </>
  );
}
