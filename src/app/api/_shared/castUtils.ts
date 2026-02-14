type FindManyDelegate = {
  findMany?: (args: unknown) => Promise<unknown>;
};

export const getOptionalPrismaDelegate = <T extends FindManyDelegate>(
  client: unknown,
  key: string
): T | undefined => {
  if (typeof client !== 'object' || client === null) {
    return undefined;
  }

  const delegate = (client as Record<string, unknown>)[key];
  if (typeof delegate !== 'object' || delegate === null) {
    return undefined;
  }

  return delegate as T;
};

export const getObjectField = (value: unknown, key: string): unknown => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
};

export const isReservationPayment = (payment: unknown): boolean =>
  getObjectField(payment, 'isReservation') === true;
