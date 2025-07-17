import { initTRPC } from '@trpc/server'

// Create tRPC context
export const createTRPCContext = async () => {
  // Lazy load database to avoid circular dependencies
  const { db } = await import(/* @vite-ignore */ './database')
  
  return {
    db,
    userId: null, // For future authentication
    userRole: null,
    isAuthenticated: false,
  }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

// Create router with proper typing
const createRouter = () => {
  return t.router({
    // Health check endpoint
    health: publicProcedure.query(() => {
      return { status: 'ok', timestamp: new Date().toISOString() }
    }),
  })
}

// Lazy load and merge routers
export const createAppRouter = async () => {
  const { nanoporeRouter } = await import(/* @vite-ignore */ './api/nanopore')
  
  return t.router({
    // Health check endpoint
    health: publicProcedure.query(() => {
      return { status: 'ok', timestamp: new Date().toISOString() }
    }),
    
    // Nanopore module
    nanopore: nanoporeRouter,
  })
}

// Export type for client-side usage
export type AppRouter = Awaited<ReturnType<typeof createAppRouter>> 