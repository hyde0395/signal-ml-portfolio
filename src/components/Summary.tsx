'use client';

const DIALOG_ID = 'summary-dialog';
let lastOpener: HTMLElement | null = null;

export function SummaryButton({ label }: { label: string }) {
  return (
    <button type="button" className="pill" aria-haspopup="dialog" onClick={(e) => {
      lastOpener = e.currentTarget;
      (document.getElementById(DIALOG_ID) as HTMLDialogElement | null)?.showModal();
    }}>
      {label}
    </button>
  );
}

type DialogProps = {
  title: string; close: string; resultsHeading: string;
  education: string; keywords: string; results: string[];
  resumeHref: string | null; resumeLabel: string; resumePendingLabel: string;
};

export function SummaryDialog(p: DialogProps) {
  return (
    <dialog id={DIALOG_ID} className="summary" aria-labelledby="summary-title" onClose={() => lastOpener?.focus()}>
      <p className="eyebrow">{p.title}</p>
      <h2 id="summary-title" className="display">CHOI HALIM</h2>
      <p className="mono">ML ENGINEER · {p.keywords}</p>
      <p className="muted">{p.education}</p>
      <h3>{p.resultsHeading}</h3>
      <ul>{p.results.map((r) => <li key={r}>{r}</li>)}</ul>
      <form method="dialog" className="summary-actions">
        {p.resumeHref
          ? <a className="pill" href={p.resumeHref} download>{p.resumeLabel}</a>
          : <span className="pill is-pending" aria-disabled="true">{p.resumePendingLabel}</span>}
        <button className="pill">{p.close}</button>
      </form>
    </dialog>
  );
}
