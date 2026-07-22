export const CATEGORY_KEYS = ['film', 'music', 'book', 'misc'] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORY_META: Record<CategoryKey, { label: string; order: number }> = {
	film: { label: '영화', order: 1 },
	music: { label: '음악', order: 2 },
	book: { label: '책', order: 3 },
	misc: { label: '잡설', order: 4 },
};
