import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Astro의 기본 id 생성은 파일명을 slugify(소문자화)한다. objects는
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
			categories: z.array(z.string()).optional(),
			relatedObjects: z.array(reference('objects')).optional(),
		}),
});

// 감독/영화/단어/장소 등 무엇이든 담는 스키마 없는 객체 컬렉션.
// 새 종류의 객체는 `type`에 자유 문자열을 쓰는 것만으로 추가된다 — 코드 변경 불필요.
const objects = defineCollection({
	loader: glob({
		base: './src/content/objects',
		pattern: '**/*.{md,mdx}',
		generateId: filenameAsId,
	}),
	schema: ({ image }) =>
		z.object({
			type: z.string(),
			title: z.string(),
			description: z.string().optional(),
			// 값 하나짜리는 스칼라(연도: 1939)로, 여러 개는 배열(장르: [드라마, 스릴러])로 —
			// 기존 단일값 파일과 호환되면서 모든 속성이 멀티값도 가능하게 유니언으로 둔다.
			attributes: z
				.record(
					z.string(),
					z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]),
				)
				.optional(),
			relatedObjects: z.array(reference('objects')).optional(),
			image: z.optional(image()),
		}),
});

export const collections = { blog, objects };
