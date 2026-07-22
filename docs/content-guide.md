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

## 영화(films) / 감독(directors) 쓰기

scaruffi.com처럼 감독별 필모그래피와 리뷰를 다루는 컬렉션입니다. `blog`와 별개의 컬렉션이라, 카테고리 시스템과는 무관하게 동작합니다.

### 감독 추가

`src/content/directors/`에 파일을 추가합니다. 파일 이름(확장자 제외)이 곧 감독 ID이자 URL(`/directors/<id>/`)입니다.

```yaml
---
title: '감독 이름'
description: '한 줄 소개'   # 선택
photo: ../../assets/xxx.jpg  # 선택
---
본문에는 약력/에세이를 원하는 만큼 길게 씁니다.
```

### 영화 추가

`src/content/films/`에 파일을 추가합니다. `director` 값은 위에서 만든 감독 파일의 **파일명(확장자 제외)**과 정확히 일치해야 합니다.

```yaml
---
title: '영화 제목'
description: '한 줄 로그라인'   # 선택
director: 감독파일명           # 필수 — directors 컬렉션의 파일 ID를 참조
year: 2024
genre: [drama, thriller]       # 선택, 자유 문자열
rating: 3.5                    # 선택, 0~5점, 소수점 가능 (예: 2.1, 3.5)
pubDate: 'Jul 22 2026'
poster: ../../assets/xxx.jpg   # 선택
---
본문은 블로그 글처럼 긴 리뷰/에세이를 써도 됩니다.
```

`director`가 존재하지 않는 파일명을 가리키면(오타 포함) **빌드가 에러로 실패**합니다 — `reference()`가 빌드 타임에 검증해주기 때문입니다. 영화 상세 페이지(`/films/<id>/`)에는 감독 링크·연도·평점이 자동으로 뜨고, 감독 상세 페이지(`/directors/<id>/`)에는 그 감독의 필모그래피가 자동으로 모여서 뜹니다 (별도 연결 작업 불필요).

`src/content/directors/example-director.md`, `src/content/films/example-film.md`는 이 구조가 실제로 동작하는지 확인하기 위한 예시입니다. 자유롭게 수정하거나 지우세요.

## 나중에 또 다른 새 "섹션"(컬렉션)을 추가하려면

`films`/`directors`가 정확히 이 패턴의 실제 예시입니다. 책, 음반 등을 더 추가하고 싶으면 같은 방식을 따르세요.

1. **콘텐츠 폴더 + 스키마 추가** (`src/content.config.ts`) — `films`/`directors` 정의를 그대로 참고하세요.
2. **컬렉션 간 링크는 `reference()`로.** 참조 대상 ID가 실제로 존재하는지 빌드 타임에 검증됩니다.
3. **리스트는 `PostList.astro`/`FilmList.astro`처럼 컬렉션 전용 컴포넌트를 하나 만들어 재사용.** 컬렉션마다 보여줄 메타데이터(카테고리 배지 vs 감독·평점)가 달라서 완전히 공용화하기보다 컬렉션별로 얇은 리스트 컴포넌트를 두는 쪽이 더 명확합니다.
4. **상세 레이아웃도 `BlogPost.astro`/`FilmPost.astro`처럼 컬렉션별로 하나씩.** 킥커-헤드라인-바이라인-본문 구조는 통일하되, 필드가 다르면 억지로 하나의 컴포넌트로 합치지 마세요.
5. **라우팅은 `getStaticPaths`로 자동 생성.** `src/pages/films/[...slug].astro`, `src/pages/directors/[...slug].astro`가 예시입니다.

이 문서도 함께 갱신하는 것 잊지 마세요.
