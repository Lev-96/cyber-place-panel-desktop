import { InputHTMLAttributes, forwardRef } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input = forwardRef<HTMLInputElement, Props>(({ label, ...rest }, ref) => (
  <div>
    {label && <span className="label">{label}</span>}
    <input ref={ref} className="input" {...rest} />
  </div>
));

Input.displayName = "Input";

export default Input;
