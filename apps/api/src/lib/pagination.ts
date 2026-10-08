export interface PageRequest {
  page: number;
  limit: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function pageArgs({ page, limit }: PageRequest) {
  return { skip: (page - 1) * limit, take: limit };
}

export function toPage<T>(items: T[], total: number, { page, limit }: PageRequest): Page<T> {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
