import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORY_KEYS } from './content/categories';

// Astro의 기본 id 생성은 파일명을 slugify(소문자화)한다. directors/films는
// frontmatter에서 파일명으로 서로를 참조하므로, 대소문자가 그대로 유지되는
// 파일명 자체를 id로 써서 참조가 어긋나지 않게 한다.
const filenameAsId = ({ entry }: { entry: string }) => entry.replace(/\.[^/.]+$/, '');

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			categories: z.array(z.enum(CATEGORY_KEYS)).optional(),
		}),
});

const directors = defineCollection({
	loader: glob({
		base: './src/content/directors',
		pattern: '**/*.{md,mdx}',
		generateId: filenameAsId,
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string().optional(),
			photo: z.optional(image()),
		}),
});

const films = defineCollection({
	loader: glob({
		base: './src/content/films',
		pattern: '**/*.{md,mdx}',
		generateId: filenameAsId,
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string().optional(),
			director: reference('directors'),
			year: z.number(),
			genre: z.array(z.string()).optional(),
			// 5점 만점, 소수점 허용 (예: 2.1, 3.5)
			rating: z.number().min(0).max(5).optional(),
			pubDate: z.coerce.date(),
			poster: z.optional(image()),
		}),
});

export const collections = { blog, directors, films };
