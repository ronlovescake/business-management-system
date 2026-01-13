export interface BundleComponent {
  id: number;
  bundleBatchId: number;
  componentProductCode: string;
  includedQuantity: number;
  createdAt: string;
}

export interface BundleBatch {
  id: number;
  createdAt: string;
  updatedAt: string;
  postingDate: string;
  bundleName: string;
  bundleSku: string;
  quantity: number;
  price: number;
  components: BundleComponent[];
}

export interface CreateBundleComponentInput {
  productCode: string;
  includedQuantity: number;
}

export interface CreateBundleInput {
  postingDate: string;
  bundleName: string;
  bundleSku: string;
  quantity: number;
  price: number;
  components: CreateBundleComponentInput[];
}
