import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // No staleTime was configured anywhere in the app (confirmed via a full
  // grep) — every query was refetched on every mount/navigation/focus,
  // even for data like batches/master settings/expense categories that
  // rarely changes within a session. 30s is conservative: every mutation
  // path in this app already calls queryClient.invalidateQueries()
  // explicitly after a real change, so this only prevents redundant
  // refetches on quick revisits (e.g. Dashboard -> Students -> Dashboard),
  // not stale data after an actual edit elsewhere.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
