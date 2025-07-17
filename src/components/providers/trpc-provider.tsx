'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { trpc } from '@/client/trpc'

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 10, // 10 seconds - reduce from 30 seconds for more responsive updates
        gcTime: 1000 * 60 * 2, // Keep in cache for 2 minutes (reduced from 5 minutes)
        refetchOnWindowFocus: false, // Disable to reduce memory pressure
        refetchOnReconnect: true,
        retry: 2, // Reduce retry attempts
        refetchInterval: false, // Disable automatic refetching
        refetchIntervalInBackground: false, // Disable background refetching
      },
    },
  }))

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          // You can add headers here if needed
          // headers() {
          //   return {
          //     authorization: getAuthCookie(),
          //   }
          // },
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  )
} 