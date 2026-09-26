import { ComponentPropsWithRef } from "react";

// With its ref (React 19 passes it as a prop): a dialog can move focus to its button.
interface Props extends ComponentPropsWithRef<"button"> {
  variant?: "primary" | "secondary";
}

const Button = ({ variant = "primary", className, ...rest }: Props) => (
  <button className={`btn ${variant === "secondary" ? "secondary" : ""} ${className ?? ""}`} {...rest} />
);

export default Button;
