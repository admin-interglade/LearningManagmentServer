export interface PageQuery {
  page: number;
  size: number;
}

export const toSkipTake = ({ page, size }: PageQuery) => ({ skip: (page - 1) * size, take: size });

export const paginated = <T>(items: T[], total: number, { page, size }: PageQuery) => ({
  items,
  meta: { page, size, total, totalPages: Math.ceil(total / size) },
});
