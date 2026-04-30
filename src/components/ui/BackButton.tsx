import { useLocation, useNavigate } from "react-router-dom";

const BackButton = () => {
  const location = useLocation();
  const navigate = useNavigate();
  if (location.pathname === "/") return null;

  return (
    <button
      type="button"
      className="cp-back-btn"
      onClick={() => navigate(-1)}
      aria-label="Back"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>Back</span>
    </button>
  );
};

export default BackButton;
