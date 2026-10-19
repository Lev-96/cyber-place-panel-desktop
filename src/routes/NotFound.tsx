import { BackAction, StateView } from "@/components/ui/state";

/** An address inside the app that matches no screen. */
const NotFound = () => (
  <StateView variant="notFound" actions={<BackAction />} />
);

export default NotFound;
