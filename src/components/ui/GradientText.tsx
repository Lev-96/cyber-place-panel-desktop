import { CSSProperties, ReactNode } from "react";

interface Props {
  children: ReactNode;
  style?: CSSProperties;
}

const GradientText = ({ children, style }: Props) => (
  <span className="gradient-text" style={style}>{children}</span>
);

export default GradientText;
