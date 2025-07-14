import { initTRPC } from '@trpc/server'

// Create tRPC context
export const createTRPCContext = async () => {
  // Only import database on server side
  if (typeof window === 'undefined') {
    const { db } = await import('./database')
    return { db }
  }
  
  // This should never be called on client side for API routes
  throw new Error('Database context cannot be created on client side')
}

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