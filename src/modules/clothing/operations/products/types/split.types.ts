export interface SplitComponent {
  id: number;
  splitBatchId: number;
  componentLabel: string;
  componentSku: string;
  componentPrice: number;
  includedQuantity: number;
  createdAt: string;
}

export interface SplitBatch {
  id: number;
  createdAt: string;
  updatedAt: string;
  postingDate: string;
  splitName: string;
  splitSku: string;
  components: SplitComponent[];
}

export interface CreateSplitComponentInput {
  componentLabel: string;
  componentSku: string;
  componentPrice: number;
  includedQuantity: number;
}

export interface CreateSplitInput {
  postingDate: string;
  splitSku: string;
  components: CreateSplitComponentInput[];
}
