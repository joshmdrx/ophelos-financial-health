import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

/**
 * Build a fresh QueryClient per render. Retries are disabled so a 500 from
 * MSW surfaces immediately instead of stalling for the default backoff.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface ProvidersProps {
  children: ReactNode;
  initialEntries?: string[];
  queryClient?: QueryClient;
}

export function Providers({
  children,
  initialEntries = ["/"],
  queryClient,
}: ProvidersProps) {
  const qc = queryClient ?? makeQueryClient();
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter
        initialEntries={initialEntries}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: Omit<ProvidersProps, "children"> & RenderOptions = {},
) {
  const { initialEntries, queryClient, ...rtlOptions } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <Providers
        initialEntries={initialEntries}
        queryClient={queryClient}
      >
        {children}
      </Providers>
    ),
    ...rtlOptions,
  });
}
