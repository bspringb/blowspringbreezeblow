import navGroups from '../data/navGroups.json';
import { getAllObjectTypes } from './objects';

// 어떤 타입이 다른 "실제 타입" 밑에 묶여 보일지, 그리고 실제 타입이 아닌 메뉴 전용
// 묶음 라벨은 무엇인지 — 둘 다 src/data/navGroups.json에 있다. 코드가 아니라 데이터라서
// 관리자 폼(npm run admin, "설정" 탭)에서 직접 편집할 수 있다.
const TYPE_CHILDREN: Record<string, string[]> = navGroups.typeChildren;
export const VIRTUAL_GROUPS: Record<string, string[]> = navGroups.virtualGroups;
// 상시표시 줄에서 어떤 타입/그룹이 먼저(왼쪽) 오고, 폭이 모자랄 때 어떤 게 먼저
// 넘칠지 정하는 고정 우선순위 목록. 여기 없는 타입은 뒤쪽(우선순위 낮음)에 붙는다.
const PRIORITY_ORDER: string[] = navGroups.priorityOrder ?? [];

export interface NavTypeGroup {
	type: string;
	count: number;
	// 헤더(최상위 메뉴 텍스트) 클릭 시 이동 경로. 자식이 있으면 자기 자신+자식을
	// 합친 objects/group/ 페이지로, 없으면 objects/type/ 페이지로 바로 간다.
	href: string;
	// 드롭다운에서 "자기 자신"에 해당하는 링크(항상 objects/type/, 단일 타입만).
	// 가상 그룹은 자기 타입이 없으므로 null.
	selfHref: string | null;
	isVirtual: boolean;
	children: { type: string; count: number }[];
	// PRIORITY_ORDER에 명시적으로 등록된 항목인지. 넘침 처리될 때, 원해서 우선
	// 배치했는데도 폭이 모자라 밀린 것이므로 드롭다운에서 초성 묶음과 구분해서
	// 맨 위 별도 줄로 보여준다(NavLinks.astro 스크립트 참고).
	isPriority: boolean;
}

// objects/group/[group].astro가 라우트를 생성할 때 쓰는, 그룹 라벨 → 실제로 합쳐
// 보여줄 타입 목록. 실제 타입 부모는 자기 자신도 포함하고, 가상 그룹은 자식만 포함한다.
export function getGroupMemberTypes(): Record<string, string[]> {
	const groups: Record<string, string[]> = {};
	for (const [parent, children] of Object.entries(TYPE_CHILDREN)) {
		groups[parent] = [parent, ...children];
	}
	for (const [label, children] of Object.entries(VIRTUAL_GROUPS)) {
		groups[label] = [...children];
	}
	return groups;
}

export async function getNavTypeGroups(): Promise<NavTypeGroup[]> {
	const allTypes = await getAllObjectTypes();
	const realChildNames = new Set(Object.values(TYPE_CHILDREN).flat());
	const virtualChildNames = new Set(Object.values(VIRTUAL_GROUPS).flat());
	const prioritySet = new Set(PRIORITY_ORDER);

	const realGroups: NavTypeGroup[] = allTypes
		.filter((t) => !realChildNames.has(t.type) && !virtualChildNames.has(t.type))
		.map((t) => {
			const children = (TYPE_CHILDREN[t.type] ?? [])
				.map((childType) => allTypes.find((x) => x.type === childType))
				.filter((x): x is { type: string; count: number } => Boolean(x));
			return {
				type: t.type,
				count: t.count,
				href: children.length > 0 ? `objects/group/${t.type}` : `objects/type/${t.type}`,
				selfHref: `objects/type/${t.type}`,
				isVirtual: false,
				children,
				isPriority: prioritySet.has(t.type),
			};
		});

	const virtualGroups: NavTypeGroup[] = Object.entries(VIRTUAL_GROUPS)
		.map(([label, childTypes]) => {
			const children = childTypes
				.map((childType) => allTypes.find((x) => x.type === childType))
				.filter((x): x is { type: string; count: number } => Boolean(x));
			return {
				type: label,
				count: children.reduce((sum, c) => sum + c.count, 0),
				href: `objects/group/${label}`,
				selfHref: null,
				isVirtual: true,
				children,
				isPriority: prioritySet.has(label),
			};
		})
		.filter((group) => group.children.length > 0);

	// PRIORITY_ORDER에 있는 타입/그룹을 그 순서대로 앞에 두고, 없는 것들은 원래
	// 순서(실제 타입 알파벳순 → 가상 그룹)를 유지한 채 뒤에 붙인다(안정 정렬).
	const priorityIndex = new Map(PRIORITY_ORDER.map((type, i) => [type, i]));
	const priorityRank = (type: string) => priorityIndex.get(type) ?? Number.MAX_SAFE_INTEGER;

	return [...realGroups, ...virtualGroups].sort((a, b) => priorityRank(a.type) - priorityRank(b.type));
}
