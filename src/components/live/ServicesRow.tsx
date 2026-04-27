import { Service } from "@/domain/Service";

const ServicesRow = ({ services }: { services: Service[] }) => {
  if (!services.length) return null;
  return (
    <div className="col" style={{ gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Services</div>
      <div className="chips">
        {services.map((s) => (
          <span key={s.id} className="chip">{s.name("en")}</span>
        ))}
      </div>
    </div>
  );
};

export default ServicesRow;
