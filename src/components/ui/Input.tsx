import RequiredMark from "@/components/ui/RequiredMark";
import { InputHTMLAttributes, forwardRef } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Draw the red required "*" after the label. Opt-in: `required` alone changes no label. */
  requiredMark?: boolean;
}

const Input = forwardRef<HTMLInputElement, Props>(({ label, requiredMark, ...rest }, ref) => (
  <div>
    {label && <span className="label">{label}{requiredMark && <RequiredMark />}</span>}
    <input ref={ref} className="input" {...rest} />
  </div>
));

Input.displayName = "Input";

export default Input;
