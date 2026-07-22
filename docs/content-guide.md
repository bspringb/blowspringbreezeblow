# 콘텐츠 작성 가이드

> 이 문서는 기능이 추가/변경될 때마다 같이 갱신합니다. 실제 코드와 어긋난 부분을 발견하면 문서를 먼저 고치세요.

## 새 글 쓰기

`src/content/blog/` 아래에 `.md` 또는 `.mdx` 파일을 추가합니다. 파일 이름이 곧 URL 슬러그가 됩니다 (`my-post.md` → `/blog/my-post/`).

frontmatter 필드:

```yaml
---
title: '글 제목'
description: '목록/검색엔진에 노출될 한 줄 설명'
pubDate: 'Jul 22 2026'
updatedDate: 'Jul 23 2026'   # 선택. 수정한 경우에만
heroImage: ../../assets/blog-placeholder-1.jpg   # 선택
categories: [film, misc]     # 선택. 아래 "카테고리" 참고
---
```

- `title`, `description`, `pubDate`는 필수입니다.
- `categories`를 생략하면 글 상세 페이지 상단 킥커에 "Essay"가 대신 표시되고, 카테고리 리스트 페이지(`/blog/film` 등)에는 나타나지 않습니다.
- 스키마는 `src/content.config.ts`에서 관리합니다.

## 카테고리

현재 유효한 카테고리 값은 `src/content/categories.ts`에 정의되어 있습니다:

| 값 (frontmatter에 쓰는 값) | 라벨 |
| --- | --- |
| `film` | 영화 |
| `music` | 음악 |
| `book` | 책 |
| `misc` | 잡설 |

한 글에 여러 카테고리를 붙일 수 있습니다:

```yaml
categories: [film, music]
```

이렇게 하면 그 글은 `/blog/film`과 `/blog/music` 리스트 양쪽에 모두 나타납니다. "전체글"(`/blog`)은 카테고리가 아니라 필터 없는 기본 목록이라 frontmatter에 따로 쓰지 않습니다.

값은 **고정 목록(enum)**이라, 목록에 없는 값을 쓰면(오타 포함) 빌드가 에러로 실패합니다 — 실수로 카테고리가 조용히 갈라지는 걸 막기 위한 설계입니다.

### 새 카테고리 추가하는 법

`src/content/categories.ts` 하나만 고치면 됩니다:

```ts
export const CATEGORY_KEYS = ['film', 'music', 'book', 'misc', 'travel'] as const;

export const CATEGORY_META: Record<CategoryKey, { label: string; order: number }> = {
  // ...기존 항목
  travel: { label: '여행', order: 5 },
};
```

이 파일이 스키마 검증(`content.config.ts`), 카테고리별 페이지 생성(`src/pages/blog/[category].astro`), 상단 탭(`CategoryTabs.astro`) 전부의 단일 출처입니다. 다른 파일은 건드릴 필요 없습니다.

## 링크 걸기

마크다운/MDX 문법을 그대로 씁니다. Astro가 별도로 해줄 건 없습니다.

```md
[다른 글 보기](/blowspringbreezeblow/blog/다른글슬러그/)
[외부 사이트](https://example.com)
```

## 나중에 새 "섹션"(컬렉션)을 추가하려면

지금은 `blog` 컬렉션 하나뿐이지만, 감독/영화/책 같은 것을 개별 항목 페이지로 다루는 미니 데이터베이스로 확장하려면 아래 패턴을 따르세요.

1. **콘텐츠 폴더 + 스키마 추가** (`src/content.config.ts`)
   ```ts
   const films = defineCollection({
     loader: glob({ base: './src/content/films', pattern: '**/*.md' }),
     schema: ({ image }) => z.object({
       title: z.string(),
       director: reference('directors'), // 다른 컬렉션 항목을 참조
       year: z.number(),
       genre: z.array(z.string()),
       rating: z.number().optional(),
     }),
   });
   export const collections = { blog, films, directors };
   ```
2. **컬렉션 간 링크는 `reference()`로.** `astro:content`가 제공하는 헬퍼로, 참조 대상 ID가 실제로 존재하는지 빌드 타임에 검증해줍니다. 오타로 링크가 끊기는 걸 막아줍니다.
3. **리스트/상세 페이지는 새로 짜지 말고 재사용.** `PostList.astro`는 `posts` prop만 받으면 어떤 컬렉션이든 렌더링할 수 있게 만들어져 있습니다 (단, 카테고리 배지 부분은 `blog` 전용이라 컬렉션 성격이 다르면 필드를 맞추거나 얇게 분기하세요). 상세 페이지는 `BlogPost.astro`처럼 킥커-헤드라인-바이라인-본문 구조의 공용 레이아웃을 하나 더 만들어 재사용하세요.
4. **라우팅은 `getStaticPaths`로 자동 생성.** `src/pages/blog/[category].astro`가 정확히 이 패턴입니다 — 고정 목록을 순회하며 페이지를 만듭니다. 새 컬렉션도 `getCollection('films')` 결과를 기반으로 `src/pages/films/[...slug].astro` 식으로 만들면 됩니다.

이 문서도 함께 갱신하는 것 잊지 마세요.
