import { postRouter } from "~/server/api/routers/post";
import { createTRPCRouter } from "~/server/api/trpc";

import { adminRouter } from "./routers/admin";
import { placementSessionRouter } from "./routers/session";
import { userRouter } from "./routers/users";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  user: userRouter,
  placementSessions: placementSessionRouter,
  admin: adminRouter
});

// export type definition of API
export type AppRouter = typeof appRouter;
