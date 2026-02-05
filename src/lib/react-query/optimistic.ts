import type { QueryClient, QueryKey } from '@tanstack/react-query';

type OptimisticUpdateContext<TData> = {
  previousData?: TData[];
  previousDataByKey?: Array<{ queryKey: QueryKey; data?: TData[] }>;
};

type OptimisticUpdateOptions<TData, TVariables> = {
  queryClient: QueryClient;
  queryKey: QueryKey | QueryKey[];
  updater: (
    previous: TData[] | undefined,
    variables: TVariables,
    queryKey: QueryKey
  ) => TData[] | undefined;
};

export function createOptimisticUpdateHandlers<TData, TVariables>(
  options: OptimisticUpdateOptions<TData, TVariables>
) {
  const resolveQueryKeys = (): QueryKey[] => {
    if (Array.isArray(options.queryKey)) {
      const [firstKey] = options.queryKey;
      if (Array.isArray(firstKey)) {
        return options.queryKey as QueryKey[];
      }
      return [options.queryKey as QueryKey];
    }

    return [options.queryKey];
  };

  const onMutate = async (
    variables: TVariables
  ): Promise<OptimisticUpdateContext<TData>> => {
    const queryKeys = resolveQueryKeys();

    await Promise.all(
      queryKeys.map((queryKey) =>
        options.queryClient.cancelQueries({ queryKey })
      )
    );

    const previousDataByKey = queryKeys.map((queryKey) => ({
      queryKey,
      data: options.queryClient.getQueryData<TData[]>(queryKey),
    }));

    previousDataByKey.forEach(({ queryKey, data }) => {
      const nextData = options.updater(data, variables, queryKey);
      if (nextData !== undefined) {
        options.queryClient.setQueryData<TData[]>(queryKey, nextData);
      }
    });

    return {
      previousData: previousDataByKey[0]?.data,
      previousDataByKey,
    };
  };

  const onError = (
    _error: unknown,
    _variables: TVariables,
    context?: OptimisticUpdateContext<TData>
  ) => {
    if (context?.previousDataByKey?.length) {
      context.previousDataByKey.forEach(({ queryKey, data }) => {
        if (data) {
          options.queryClient.setQueryData<TData[]>(queryKey, data);
        }
      });
      return;
    }

    if (context?.previousData) {
      const [queryKey] = resolveQueryKeys();
      options.queryClient.setQueryData<TData[]>(queryKey, context.previousData);
    }
  };

  const onSettled = () => {
    const queryKeys = resolveQueryKeys();

    queryKeys.forEach((queryKey) => {
      options.queryClient.invalidateQueries({ queryKey });
    });
  };

  return { onMutate, onError, onSettled };
}
