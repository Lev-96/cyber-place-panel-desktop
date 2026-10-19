/**
 * The red "*" after a required field's label (2026-10-12). Decorative: the
 * control itself carries `required` / `aria-required`, so a screen reader
 * hears "required" once, not "star".
 */
const RequiredMark = () => <span className="req-mark" aria-hidden="true">*</span>;

export default RequiredMark;
