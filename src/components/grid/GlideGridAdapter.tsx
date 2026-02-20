'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Loader } from '@mantine/core';
import type { GridViewProps } from './GridView';
import type { GridAdapter } from './GridAdapterContext';

import '@glideapps/glide-data-grid/dist/index.css';

const GlideDataEditor = dynamic(
  () => import('@glideapps/glide-data-grid').then((mod) => mod.DataEditor),
  {
    ssr: false,
    loading: () => <Loader />, // eslint-disable-line react/jsx-no-useless-fragment
  }
);

export const glideGridAdapter: GridAdapter = {
  name: 'glide-data-grid',
  Component: GlideDataEditor as React.ComponentType<GridViewProps>,
  normaliseColumns: (columns) =>
    columns.map((column: GridViewProps['columns'][number]) => ({
      ...column,
      title: column.title ?? '',
    })),
};
