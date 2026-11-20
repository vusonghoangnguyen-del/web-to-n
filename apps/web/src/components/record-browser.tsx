'use client';

import { Children, useState, type ReactNode } from 'react';

export function RecordBrowser({ items, children }: { items: { id: string; title: string; subtitle: string }[]; children: ReactNode }) {
  const [selected, setSelected] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const active = items.some((item) => item.id === selected) ? selected : items[0]?.id;
  const records = Children.toArray(children);
  return <div className={`record-browser ${showDetail ? 'show-record' : ''}`}>
    <nav className="record-browser-list" aria-label="Nội dung chờ kiểm duyệt">{items.map((item) => <button type="button" key={item.id} aria-pressed={active === item.id} onClick={() => { setSelected(item.id); setShowDetail(true); }}><strong>{item.title}</strong><span>{item.subtitle}</span></button>)}</nav>
    <div className="record-browser-detail"><button type="button" className="record-back outline-button" onClick={() => setShowDetail(false)}>← Về danh sách</button>{records.map((record, index) => <div key={items[index]?.id ?? index} hidden={items[index]?.id !== active}>{record}</div>)}</div>
  </div>;
}
