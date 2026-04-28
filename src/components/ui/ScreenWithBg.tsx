import { ReactNode } from "react";

interface Props {
  bg: string; // path under /public, e.g. "/bg/admin-home.jpg"
  title?: string;
  children: ReactNode;
}

const ScreenWithBg = ({ bg, title, children }: Props) => (
  <div className="screen-bg">
    <div className="screen-bg-img" style={{ backgroundImage: `url('${bg}')` }} />
    <div className="screen-bg-fade" />
    <div className="screen-bg-content">
      {title && <h2 className="page-title">{title}</h2>}
      {children}
    </div>
  </div>
);

export default ScreenWithBg;
