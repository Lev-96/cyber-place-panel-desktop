interface Props {
  /** Whether the rule currently passes — drives the fill + colour. */
  ok: boolean;
  label: string;
}

/**
 * One live validation rule: the dot fills and the text lifts to the success
 * colour the moment the rule passes (styling in `.cp-check`). Shared by every
 * form that validates while typing — password rules today, anything with a
 * checklist tomorrow.
 */
const CheckRow = ({ ok, label }: Props) => (
  <div className="cp-check" data-ok={ok ? "true" : "false"}>
    <span className="cp-check-dot">
      <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 8.5l4 4L14 4" />
      </svg>
    </span>
    <span>{label}</span>
  </div>
);

export default CheckRow;
