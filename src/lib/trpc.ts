import { initTRPC } from '@trpc/server'
import { db } from './database'

// Create tRPC context
export const createTRPCContext = () => ({
  db,
})

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

// Import the real nanopore router
import { nanoporeRouter } from './api/nanopore'

export const appRouter = router({
  nanopore: nanoporeRouter,
})

export type AppRouter = typeof appRouter 