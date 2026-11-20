'use client';

import { Children, isValidElement, useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';

type Tab = { id: string; label: string };

/** Keeps inactive panels mounted so changing views never loses an unsaved draft. */
export function WorkspaceTabs({ tabs, initialTab, children, className = '', syncHash = false, activeTab, onTabChange }: { tabs: Tab[]; initialTab?: string; children: ReactNode; className?: string; syncHash?: boolean; activeTab?: string; onTabChange?: (id: string) => void }) {
  const [internalActive, setActive] = useState(initialTab ?? tabs[0]?.id ?? '');
  const active = activeTab ?? internalActive;
  const prefix = useId();
  const validIds = tabs.map((tab) => tab.id).join('|');
  useEffect(() => {
    if (!syncHash) return;
    const update = () => {
      const id = window.location.hash.slice(1);
      if (validIds.split('|').includes(id)) {
        setActive(id);
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
      }
    };
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, [syncHash, validIds]);
  function select(id: string) {
    setActive(id);
    onTabChange?.(id);
    if (syncHash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
  }
  function keydown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index + tabs.length - 1) % tabs.length : -1;
    if (next < 0) return;
    event.preventDefault();
    select(tabs[next].id);
    document.getElementById(`${prefix}-tab-${tabs[next].id}`)?.focus();
  }
  return <div className={`workspace-tabs ${className}`}>
    <div className="workspace-tablist" role="tablist" aria-label="Nội dung">{tabs.map((tab, index) => <button key={tab.id} id={`${prefix}-tab-${tab.id}`} type="button" role="tab" aria-selected={active === tab.id} aria-controls={`${prefix}-panel-${tab.id}`} tabIndex={active === tab.id ? 0 : -1} onClick={() => select(tab.id)} onKeyDown={(event) => keydown(event, index)}>{tab.label}</button>)}</div>
    <div className="workspace-panels">{Children.map(children, (child) => {
      if (!isValidElement<{ id?: string }>(child) || !child.props.id || !tabs.some((tab) => tab.id === child.props.id)) return child;
      const id = child.props.id;
      return <div id={`${prefix}-panel-${id}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${id}`} hidden={active !== id} tabIndex={0}>{child}</div>;
    })}</div>
  </div>;
}
