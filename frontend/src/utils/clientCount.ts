// Client count of a multi-client run (fio-test.sh with CLIENTS: every step on all clients at once)

/** "4 clients" for a multi-client run, '' for a single host (or when the backend sends no count) */
export const formatClientCount = (clients: number | null | undefined): string =>
    clients && clients > 1 ? `${clients} clients` : '';
