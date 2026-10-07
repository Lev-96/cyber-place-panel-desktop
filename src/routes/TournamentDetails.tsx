import { SkeletonCard } from "@/components/ui/Skeleton";
import { BackAction, ErrorState } from "@/components/ui/state";
import RegistrationsList from "@/components/tournaments/RegistrationsList";
import ScreenWithBg from "@/components/ui/ScreenWithBg";
import Spinner from "@/components/ui/Spinner";
import { useAsync } from "@/hooks/useAsync";
import { useLang } from "@/i18n/LanguageContext";
import { tournamentRepository } from "@/repositories/TournamentRepository";
import { useParams } from "react-router-dom";

const TournamentDetails = () => {
  const { tournamentId } = useParams();
  const { t } = useLang();
  const id = Number(tournamentId);
  const { data: loaded, error, reload } = useAsync(() => tournamentRepository.byId(id), [id]);
  // Only an answer for THIS id: useAsync keeps the previous answer while a
  // new route param is read, and another record is not this page.
  const data = loaded && loaded.id === id ? loaded : null;

  if (!Number.isFinite(id) || id <= 0) return <div className="error">{t("error.invalidTournamentId")}</div>;
  // A 404 is "not found" with a way back; any other first-load failure is the
  // error state with Retry. A failed BACKGROUND re-read keeps the page.
  if (error && !data) {
    return (
      <ErrorState
        error={error}
        onRetry={() => void reload()}
        titleKey="tournament.state.errorTitle"
        notFoundTitleKey="tournament.state.notFoundTitle"
        notFoundDescriptionKey="tournament.state.notFoundDescription"
        notFoundAction={<BackAction fallback="/" />}
      />
    );
  }
  if (!data) return <SkeletonCard lines={5} />;

  return (
    <ScreenWithBg bg="./bg/owner-home.jpg" title={data.title}>
      <div className="card col" style={{ gap: 6 }}>
        <Row k={t("label.description")} v={data.description} />
        <Row k={t("label.game")} v={`${data.game?.name ?? "-"} ${data.game?.platform ? `(${data.game.platform})` : ""}`} />
        <Row k={t("tournament.skillLevel")} v={t(`tournament.skillLevel.${data.skill_level ?? "any"}`)} />
        <Row k={t("bookingDetails.start")} v={data.start_date} />
        {data.end_date && <Row k={t("tournamentDetails.end")} v={data.end_date} />}
        <Row k={t("label.price")} v={Number(data.price).toFixed(2)} />
        {data.participants_limit ? <Row k={t("tournamentDetails.players")} v={`${data.registered_participants} / ${data.participants_limit}`} /> : null}
      </div>
      <RegistrationsList tournamentId={id} />
    </ScreenWithBg>
  );
};

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="kv-row"><span className="k">{k}</span><span className="v">{v}</span></div>
);

export default TournamentDetails;
