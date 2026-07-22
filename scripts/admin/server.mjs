// objects/blog 컬렉션 프론트매터를 손으로 안 치고 폼으로 입력하기 위한 로컬 전용 도구.
// Astro 빌드/배포와는 완전히 분리된 별도 Node 서버 — 정적 사이트(GitHub Pages)엔
// 전혀 포함되지 않고, `npm run admin`으로 로컬에서만 띄운다.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OBJECTS_DIR = path.join(ROOT, 'src/content/objects');
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = 4322;

function splitFrontmatter(raw) {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) return { data: {}, body: raw };
	return { data: yaml.load(match[1]) ?? {}, body: match[2] };
}

function serializeFrontmatter(data, body) {
	const clean = {};
	for (const [key, value] of Object.entries(data)) {
		if (value === undefined || value === null || value === '') continue;
		if (Array.isArray(value) && value.length === 0) continue;
		if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
		clean[key] = value;
	}
	const front = yaml.dump(clean, { lineWidth: -1 });
	return `---\n${front}---\n\n${body.trim()}\n`;
}

function isValidId(id) {
	return typeof id === 'string' && id.length > 0 && !id.includes('/') && !id.includes('..');
}

// attributes 입력값은 전부 문자열로 들어오는데, 스키마가 string|number 유니언이라
// 숫자처럼 생긴 값(예: "1939")은 숫자로 저장해야 기존 파일들과 형식이 맞는다.
function coerceAttributeValue(raw) {
	const trimmed = raw.trim();
	const num = Number(trimmed);
	if (trimmed !== '' && !Number.isNaN(num) && String(num) === trimmed) return num;
	return raw;
}

async function listObjectFiles() {
	const files = await fs.readdir(OBJECTS_DIR);
	return files.filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
}

async function readObject(filename) {
	const raw = await fs.readFile(path.join(OBJECTS_DIR, filename), 'utf-8');
	const id = filename.replace(/\.[^/.]+$/, '');
	const { data, body } = splitFrontmatter(raw);
	return { id, ...data, body };
}

async function getMeta() {
	const files = await listObjectFiles();
	const objects = [];
	const attributeKeysByType = {};
	// type -> key -> 그 키에 실제로 쓰인 값들의 집합. 키 자동완성과 같은 이유로,
	// 값도 같은 타입의 기존 객체들이 이미 쓴 값을 그대로 재사용하기 쉽게 한다.
	const attributeValuesByType = {};
	const types = new Set();

	for (const file of files) {
		const entry = await readObject(file);
		// relatedObjects까지 내려줘야 클라이언트에서 "이 객체를 가리키는 것"(역참조)을
		// 계산할 수 있다 — 전체 그래프를 서버가 미리 계산하지 않고, 필요할 때
		// 클라이언트가 objects 목록을 스캔해서 구한다(사이트의 getRelatedObjects와 동일한 방식).
		objects.push({
			id: entry.id,
			title: entry.title,
			type: entry.type,
			relatedObjects: entry.relatedObjects ?? [],
		});
		if (entry.type) types.add(entry.type);
		if (entry.attributes && typeof entry.attributes === 'object') {
			const keySet = attributeKeysByType[entry.type] ?? new Set();
			const valuesByKey = attributeValuesByType[entry.type] ?? {};
			for (const [key, value] of Object.entries(entry.attributes)) {
				keySet.add(key);
				const valueSet = valuesByKey[key] ?? new Set();
				valueSet.add(String(value));
				valuesByKey[key] = valueSet;
			}
			attributeKeysByType[entry.type] = keySet;
			attributeValuesByType[entry.type] = valuesByKey;
		}
	}

	return {
		objects,
		types: [...types].sort(),
		attributeKeysByType: Object.fromEntries(
			Object.entries(attributeKeysByType).map(([type, set]) => [type, [...set]]),
		),
		attributeValuesByType: Object.fromEntries(
			Object.entries(attributeValuesByType).map(([type, valuesByKey]) => [
				type,
				Object.fromEntries(Object.entries(valuesByKey).map(([key, set]) => [key, [...set]])),
			]),
		),
	};
}

async function listBlogFiles() {
	const files = await fs.readdir(BLOG_DIR);
	return files.filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
}

async function readBlogPost(filename) {
	const raw = await fs.readFile(path.join(BLOG_DIR, filename), 'utf-8');
	const id = filename.replace(/\.[^/.]+$/, '');
	const { data, body } = splitFrontmatter(raw);
	return { id, ...data, body };
}

async function getBlogMeta() {
	const files = await listBlogFiles();
	const posts = [];
	const categories = new Set();

	for (const file of files) {
		const entry = await readBlogPost(file);
		posts.push({ id: entry.id, title: entry.title });
		for (const c of entry.categories ?? []) categories.add(c);
	}

	return { posts, categories: [...categories].sort() };
}

function send(res, status, body, contentType = 'application/json') {
	res.writeHead(status, { 'Content-Type': contentType });
	const raw = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
	res.end(raw);
}

async function serveStatic(res, pathname) {
	const filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
	try {
		const content = await fs.readFile(filePath);
		const ext = path.extname(filePath);
		const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'text/html';
		send(res, 200, content, type);
	} catch {
		send(res, 404, 'Not found', 'text/plain');
	}
}

async function readJsonBody(req) {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`);

	try {
		if (url.pathname === '/api/meta' && req.method === 'GET') {
			return send(res, 200, await getMeta());
		}

		// /api/blog/ 접두사 라우트보다 먼저 체크해야 '메타'가 글 id로 오인되지 않는다.
		if (url.pathname === '/api/blog/meta' && req.method === 'GET') {
			return send(res, 200, await getBlogMeta());
		}

		if (url.pathname.startsWith('/api/objects/') && req.method === 'GET') {
			const id = decodeURIComponent(url.pathname.replace('/api/objects/', ''));
			if (!isValidId(id)) return send(res, 400, { error: '잘못된 id' });
			const files = await listObjectFiles();
			const file = files.find((f) => f.replace(/\.[^/.]+$/, '') === id);
			if (!file) return send(res, 404, { error: '찾을 수 없음' });
			return send(res, 200, await readObject(file));
		}

		if (url.pathname.startsWith('/api/blog/') && req.method === 'GET') {
			const id = decodeURIComponent(url.pathname.replace('/api/blog/', ''));
			if (!isValidId(id)) return send(res, 400, { error: '잘못된 id' });
			const files = await listBlogFiles();
			const file = files.find((f) => f.replace(/\.[^/.]+$/, '') === id);
			if (!file) return send(res, 404, { error: '찾을 수 없음' });
			return send(res, 200, await readBlogPost(file));
		}

		if (url.pathname === '/api/blog' && req.method === 'POST') {
			const payload = await readJsonBody(req);
			const { id, body, isEdit, categories, relatedObjects, ...rest } = payload;

			if (!isValidId(id)) return send(res, 400, { error: '잘못된 파일명' });
			// blog 스키마의 필수 필드(title/description/pubDate)는 여기서도 한 번 더
			// 막는다 — 폼에서 빠뜨려도 스키마를 위반하는 파일이 써지지 않게.
			if (!rest.title?.trim()) return send(res, 400, { error: '제목이 필요합니다' });
			if (!rest.description?.trim()) return send(res, 400, { error: '설명이 필요합니다' });
			if (!rest.pubDate?.trim()) return send(res, 400, { error: '발행일이 필요합니다' });

			const filePath = path.join(BLOG_DIR, `${id}.md`);

			if (!isEdit) {
				const exists = await fs
					.access(filePath)
					.then(() => true)
					.catch(() => false);
				if (exists) return send(res, 409, { error: '같은 이름의 글이 이미 있습니다' });
			}

			const data = {
				...rest,
				categories: (categories ?? []).filter(Boolean),
				relatedObjects: (relatedObjects ?? []).filter(Boolean),
			};

			await fs.writeFile(filePath, serializeFrontmatter(data, body ?? ''), 'utf-8');
			return send(res, 200, { ok: true, id });
		}

		if (url.pathname === '/api/objects' && req.method === 'POST') {
			const payload = await readJsonBody(req);
			const { id, body, isEdit, attributes, relatedObjects, ...rest } = payload;

			if (!isValidId(id)) return send(res, 400, { error: '잘못된 파일명' });
			// objects 스키마의 필수 필드(type/title)도 서버에서 한 번 더 막는다.
			if (!rest.type?.trim()) return send(res, 400, { error: '타입이 필요합니다' });
			if (!rest.title?.trim()) return send(res, 400, { error: '제목이 필요합니다' });

			const filePath = path.join(OBJECTS_DIR, `${id}.md`);

			if (!isEdit) {
				const exists = await fs
					.access(filePath)
					.then(() => true)
					.catch(() => false);
				if (exists) return send(res, 409, { error: '같은 이름의 객체가 이미 있습니다' });
			}

			const cleanedAttributes = {};
			for (const { key, value } of attributes ?? []) {
				if (!key?.trim()) continue;
				cleanedAttributes[key.trim()] = coerceAttributeValue(value ?? '');
			}

			const data = {
				...rest,
				attributes: cleanedAttributes,
				relatedObjects: (relatedObjects ?? []).filter(Boolean),
			};

			await fs.writeFile(filePath, serializeFrontmatter(data, body ?? ''), 'utf-8');
			return send(res, 200, { ok: true, id });
		}

		if (req.method !== 'GET') return send(res, 404, { error: 'not found' });

		return serveStatic(res, url.pathname);
	} catch (err) {
		console.error(err);
		send(res, 500, { error: String(err) });
	}
});

server.listen(PORT, '127.0.0.1', () => {
	console.log(`객체 입력 폼: http://localhost:${PORT}`);
});
