import { useEffect, useRef } from "react";
import { getEcho } from "./echo";

/**
 * Frozen mirror of `App\Events\TournamentJoined` from the backend.
 * Fires when a guest registers for a tournament via the mobile app —
 * desktop notifier surfaces it as an OS push + Notifications-feed
 * row.
 */
export interface TournamentJoinedEvent {
  tournament_id: number;
  tournament_title: string | null;
  branch_id: number;
  branch_address: string | null;
  company_id: number;
  company_name: string | null;
  guest_id: number;
  guest_first_name: string | null;
  guest_last_name: string | null;
  as: "player" | "guest";
  at: string;
}

/**
 * Subscribe to `.tournament.joined` on any Reverb channel while the
 * component is mounted. Same channel fan-out booking events use
 * (branch.{id} / company.{id} / bookings.global) so staff already
 * subscribed to bookings.global pick this up without a new
 * subscription.
 */
export const useTournamentJoined = (
  channelName: string | null | undefined,
  onChange: (event: TournamentJoinedEvent) => void,
): void => {
  const handlerRef = useRef(onChange);
  useEffect(() => {
    handlerRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!channelName) return;
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.channel(channelName);
    const listener = (payload: unknown) => {
      handlerRef.current(payload as TournamentJoinedEvent);
    };
    channel.listen(".tournament.joined", listener);

    return () => {
      channel.stopListening(".tournament.joined", listener);
    };
  }, [channelName]);
};
