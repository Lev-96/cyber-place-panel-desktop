import { storageUri } from "@/infrastructure/AppConfig";
import SmartImage from "./SmartImage";

interface Props {
  /** Backend-relative path (e.g. `images/company/logos/x.png`) or absolute URL or null. */
  src?: string | null;
  /** Display name — used to derive a placeholder letter and alt text. */
  name?: string;
  size?: number;
  shape?: "circle" | "square";
}

const Avatar = ({ src, name, size = 44, shape = "square" }: Props) => (
  <SmartImage
    src={storageUri(src ?? null)}
    name={name}
    size={size}
    shape={shape}
  />
);

export default Avatar;
