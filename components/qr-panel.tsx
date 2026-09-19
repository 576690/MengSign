'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { api } from '@/lib/client';
import { CLOCK_TTL, QR_INTERVAL, qrUrl, schoolNow } from '@/lib/course';
import type { ClockSample, Course } from '@/lib/types';
export default function QrPanel({ courses, selected, online, demo }: { courses: Course[]; selected: string; online: boolean; demo: boolean }) {
  const [choice, setChoice] = useState(selected || courses[0]?.id || 'custom');
  const [custom, setCustom] = useState('');
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rtt, setRtt] = useState(0);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const key = choice === 'custom' ? custom : choice;
  const retry = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    let disposed = false, sample: ClockSample | null = null, expires = 0, inFlight = false, failed = false;
    const epoch = ++generation.current;
    setImage(''); setError(''); setRemaining(0);
    async function tick() {
      if (disposed || inFlight || document.hidden) return;
      if (!online) { setImage(''); setError('网络已断开，恢复连接后重新校时'); return; }
      if (failed) return;
      if (!key) return;
      const now = performance.now();
      setRemaining(Math.max(0, expires - now));
      if (now < expires) return;
      setImage(''); inFlight = true;
      try {
        if (!demo && schoolNow(sample, now) === null) {
          setBusy(true);
          const started = performance.now();
          const reading = await api<{ timestamp: number; upstreamRtt: number }>('/api/clock');
          const received = performance.now(), roundTrip = received - started;
          if (roundTrip >= CLOCK_TTL) throw new Error('校时耗时过长，请重试');
          sample = { schoolAtReceive: reading.timestamp + Math.max(0, roundTrip - reading.upstreamRtt) / 2, sampledAt: received, rtt: roundTrip };
          if (!disposed) setRtt(Math.round(roundTrip));
        }
        const aligned = demo ? Date.now() : schoolNow(sample, performance.now());
        if (aligned === null) throw new Error('校时已过期，请重新同步');
        // Demo codes contain plain demo text and cannot be scanned to sign a real course.
        const url = demo ? `MengSign 演示二维码 · 非签到码 · ${Math.floor(aligned / 5000)}` : qrUrl(key, aligned);
        const data = await QRCode.toDataURL(url, { width: 420, margin: 2, color: { dark: '#133e39', light: '#ffffff' }, errorCorrectionLevel: 'M' });
        if (disposed || generation.current !== epoch || document.hidden) return;
        expires = performance.now() + Math.min(QR_INTERVAL, demo ? QR_INTERVAL : CLOCK_TTL - (performance.now() - sample!.sampledAt));
        setImage(data); setError(''); setRemaining(Math.max(0, expires - performance.now()));
      } catch (e) { if (!disposed) { failed = true; setError(e instanceof Error ? e.message : '生成失败，请重试'); setImage(''); } }
      finally { inFlight = false; if (!disposed) setBusy(false); }
    }
    function visibility() { sample = null; expires = 0; setImage(''); if (!document.hidden) { failed = false; void tick(); } }
    void tick(); const timer = setInterval(() => void tick(), 150);
    document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [key, online, demo, revision]);
  return <div className="qr-layout">
    <section className="panel qr-card">
      <div className="eyebrow"><span className="status-dot" />{demo ? '演示二维码 · 无签到效力' : '与学校时间同步'}</div>
      <h2>让签到，更轻一点</h2><p className="muted">打开二维码，使用学校客户端扫码</p>
      <div className="qr-frame" aria-live="polite">
        {image && online ? <img src={image} alt={demo ? '演示二维码，不能用于签到' : '课程签到动态二维码'} width={252} height={252} /> : <div className="qr-placeholder">{online ? <QrCode size={48} strokeWidth={1.2} /> : <WifiOff size={40} />}<span>{busy ? '正在与学校校时…' : error ? '二维码暂不可用' : '请选择一节课程'}</span></div>}
      </div>
      <div className="qr-progress"><span style={{ width: `${Math.min(100, remaining / QR_INTERVAL * 100)}%` }} /></div>
      <p className="qr-caption">{image ? `${Math.ceil(remaining / 1000)} 秒后更新${demo ? ' · 演示' : ''}` : '仅展示有效的二维码'}</p>
      {error && <div className="notice error" role="alert">{error}</div>}
      <button className="button secondary" onClick={retry} disabled={busy || !online}><RefreshCw size={16} className={busy ? 'spin' : ''} />重新校时</button>
    </section>
    <aside className="stack"><section className="panel"><div className="section-heading"><h2>选择课程</h2><QrCode size={18} /></div><label className="field-label" htmlFor="qr-course">生成签到码的课程</label><select id="qr-course" value={choice} onChange={e => setChoice(e.target.value)}>{courses.map(c => <option key={c.id || c.uuid} value={c.id || c.uuid}>{c.name}</option>)}<option value="custom">手动输入课程 ID / UUID</option></select>{choice === 'custom' && <label className="field-label">课程 ID / UUID<input value={custom} onChange={e => setCustom(e.target.value)} placeholder="7 位课程 ID 或 32 位 UUID" maxLength={36} autoComplete="off" /></label>}<p className="help">二维码不包含你的账号或会话信息。</p></section>
    <section className="info-card"><ShieldCheck size={22} /><h3>每一次展示，都有时效</h3><p>二维码根据学校时间自动更新。切回页面时会重新校时；网络断开后暂停展示。</p>{rtt > 0 && !demo && <span className="small muted">本次校时耗时 {rtt} ms</span>}</section></aside>
  </div>;
}
