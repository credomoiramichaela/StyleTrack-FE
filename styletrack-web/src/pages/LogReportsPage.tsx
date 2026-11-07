import { useState } from 'react';
import { get, type ActivityLogEntry, type LogAction, type Page } from '../api';
import { fmtWhen, titleCase } from '../format';
import { Empty, ErrorNote, Loading, PageHead, Pager, useLoad } from '../ui';

const ACTIONS: LogAction[] = [
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'USER_CREATED', 'USER_UPDATED', 'USER_DEACTIVATED', 'ROLE_CHANGED',
  'APPOINTMENT_ACCEPTED', 'APPOINTMENT_REJECTED', 'APPOINTMENT_CANCELLED',
];

export default function LogReportsPage() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pageNo, setPageNo] = useState(0);

  const list = useLoad(() => get<Page<ActivityLogEntry>>('/log-reports', {
    action, from, to, page: pageNo, size: 25,
  }), [action, from, to, pageNo]);

  const reset = (fn: () => void) => { fn(); setPageNo(0); };

  return (
    <>
      <PageHead title="Log reports" sub="Logins, user/role changes, and appointment accept/reject/cancel actions. Super Admin only." />

      <div className="filter-row">
        <select aria-label="Action" value={action} onChange={(e) => reset(() => setAction(e.target.value))}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
        </select>
        <label className="inline">From <input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} /></label>
        <label className="inline">To <input type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} /></label>
        {(action || from || to) && (
          <button className="btn btn-quiet" onClick={() => reset(() => { setAction(''); setFrom(''); setTo(''); })}>Clear filters</button>
        )}
      </div>

      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.data && list.data.content.length === 0 && <Empty title="No log entries match" hint="Try a different action or date range." />}
      {list.data && list.data.content.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th></tr>
              </thead>
              <tbody>
                {list.data.content.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtWhen(e.createdAt)}</td>
                    <td>{e.actorName ?? 'Unknown'}</td>
                    <td>{titleCase(e.action)}</td>
                    <td>{e.details ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={list.data} onPage={setPageNo} />
        </>
      )}
    </>
  );
}
