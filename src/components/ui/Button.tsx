import { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

const Button = ({ variant = "primary", className, ...rest }: Props) => (
  <button className={`btn ${variant === "secondary" ? "secondary" : ""} ${className ?? ""}`} {...rest} />
);

export default Button;
