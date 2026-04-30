import { useLang } from "@/i18n/LanguageContext";
import { Service } from "@/domain/Service";

const ServicesRow = ({ services }: { services: Service[] }) => {
  const { lang, t } = useLang();
  if (!services.length) return null;
  return (
    <div className="col" style={{ gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{t("session.services")}</div>
      <div className="chips">
        {services.map((s) => (
          <span key={s.id} className="chip">{s.name(lang)}</span>
        ))}
      </div>
    </div>
  );
};

export default ServicesRow;
