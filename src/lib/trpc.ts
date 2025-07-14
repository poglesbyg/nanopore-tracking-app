import { initTRPC } from '@trpc/server'
import { z } from 'zod'

const t = initTRPC.create()

export const router = t.router
export const publicProcedure = t.procedure

// Simple mock router for build purposes
export const appRouter = router({
  nanopore: router({
    getAll: publicProcedure.query(() => []),
    create: publicProcedure
      .input(z.object({ sampleName: z.string() }))
      .mutation(() => ({ id: '1', sampleName: 'test' })),
    update: publicProcedure
      .input(z.object({ id: z.string(), data: z.any() }))
      .mutation(() => ({ id: '1', sampleName: 'test' })),
    assign: publicProcedure
      .input(z.object({ id: z.string(), assignedTo: z.string() }))
      .mutation(() => ({ id: '1', assignedTo: 'test' })),
  }),
})

export type AppRouter = typeof appRouter 