import PlatformIcon from "@/components/ui/PlatformIcon";
import SmartImage from "@/components/ui/SmartImage";
import { storageUri } from "@/infrastructure/AppConfig";

interface Props {
  /** `games.game_logo_path`; empty = the game has no cover. */
  path?: string | null;
  platform: string;
  name: string;
  /** Width in px; the cover is box art, 3:4. */
  width?: number;
}

/**
 * A game's cover as players see it in the mobile app: the picture when there
 * is one (it fades in, a failed load falls back too), otherwise the same
 * "no cover" art the app draws — a dark gradient with the brand ring around
 * the platform's icon — so staff can tell at a glance which games still have
 * none, and for which console.
 */
const GameCover = ({ path, platform, name, width = 42 }: Props) => {
  const height = Math.round((width * 4) / 3);
  return (
    <SmartImage
      src={storageUri(path)}
      name={name}
      alt=""
      size={width}
      style={{ height, borderRadius: 10 }}
      fallback={
        <span className="game-cover-empty" aria-hidden="true">
          <span className="game-cover-empty__ring">
            <PlatformIcon platform={platform} size={Math.round(width * 0.36)} />
          </span>
        </span>
      }
    />
  );
};

export default GameCover;
