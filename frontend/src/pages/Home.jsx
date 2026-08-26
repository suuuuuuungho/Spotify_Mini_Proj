import { useMemo, useState } from "react";
import { useNowPlaying } from "../NowPlayingContext";

const COLOR = {
  entityFill: "#2a2a2a",
  junctionFill: "#201f1f",
  border: "#3c4a3c",
  primary: "#4cf479",
  lime: "#bfff00",
  mint: "#2dd4bf",
  info: "#60a5fa",
  onSurface: "#e5e2e1",
  onSurfaceVariant: "#bbcbb8",
  line: "#859583",
};

const PAD = 12;
const ROW_H = 15;
const JPAD = 9;
const JROW_H = 13;
const GROUP_PAD = 6;
const GROUP_ROW_H = 13;
const GROUP_GAP = 5;

const AUDIO_FEATURES = [
  "danceability",
  "energy",
  "loudness",
  "valence",
  "tempo",
  "acousticness",
  "instrumentalness",
  "liveness",
  "speechiness",
];

// Lays out a box's rows top-to-bottom with a fixed, equal top/bottom
// padding regardless of content, so every card breathes the same amount.
// startY is the box's own y, so every coordinate returned is absolute.
function layoutColumns(columns, { startY, headerH, pad, rowH }) {
  let cursor = startY + headerH + pad;
  const rows = [];
  for (const col of columns) {
    if (col.type === "group") {
      cursor += GROUP_GAP;
      const groupTop = cursor;
      const captionY = groupTop + GROUP_PAD + 8;
      const itemsStartY = captionY + 13;
      const nRows = Math.ceil(col.items.length / 2);
      const groupBottom = itemsStartY + (nRows - 1) * GROUP_ROW_H + GROUP_PAD + 6;
      rows.push({ type: "group", label: col.label, items: col.items, groupTop, groupBottom, captionY, itemsStartY });
      cursor = groupBottom + GROUP_GAP;
    } else {
      cursor += rowH;
      rows.push({ type: "field", name: col.name, tag: col.tag, baselineY: cursor - 3 });
    }
  }
  return { rows, height: cursor + pad - startY };
}

const ENTITIES = [
  {
    id: "users",
    x: 30,
    y: 60,
    w: 190,
    kind: "entity",
    highlightColor: COLOR.mint,
    columns: [
      { type: "field", name: "id", tag: "PK" },
      { type: "field", name: "display_name" },
    ],
  },
  {
    id: "playlists",
    x: 30,
    y: 210,
    w: 190,
    kind: "entity",
    highlightColor: COLOR.lime,
    columns: [
      { type: "field", name: "id", tag: "PK" },
      { type: "field", name: "name" },
      { type: "field", name: "description" },
      { type: "field", name: "owner_id", tag: "FK" },
      { type: "field", name: "image_url" },
      { type: "field", name: "followers" },
    ],
  },
  {
    id: "playlist_track",
    x: 260,
    y: 240,
    w: 180,
    kind: "junction",
    columns: [
      { type: "field", name: "playlist_id", tag: "PK/FK" },
      { type: "field", name: "track_id", tag: "PK/FK" },
      { type: "field", name: "track_order" },
      { type: "field", name: "added_at" },
    ],
  },
  {
    id: "tracks",
    x: 500,
    y: 232,
    w: 220,
    kind: "entity",
    highlightColor: COLOR.lime,
    columns: [
      { type: "field", name: "id", tag: "PK" },
      { type: "field", name: "name" },
      { type: "field", name: "album_id", tag: "FK" },
      { type: "field", name: "duration_ms" },
      { type: "field", name: "popularity" },
      { type: "group", label: "Audio features", items: AUDIO_FEATURES },
    ],
  },
  {
    id: "albums",
    x: 500,
    y: 40,
    w: 220,
    kind: "entity",
    highlightColor: COLOR.lime,
    columns: [
      { type: "field", name: "id", tag: "PK" },
      { type: "field", name: "name" },
      { type: "field", name: "album_type" },
      { type: "field", name: "release_date" },
      { type: "field", name: "image_url" },
      { type: "field", name: "popularity" },
    ],
  },
  {
    id: "album_artist",
    x: 780,
    y: 40,
    w: 190,
    kind: "junction",
    columns: [
      { type: "field", name: "album_id", tag: "PK/FK" },
      { type: "field", name: "artist_id", tag: "PK/FK" },
    ],
  },
  {
    id: "track_artist",
    x: 780,
    y: 165,
    w: 190,
    kind: "junction",
    columns: [
      { type: "field", name: "track_id", tag: "PK/FK" },
      { type: "field", name: "artist_id", tag: "PK/FK" },
    ],
  },
  {
    id: "artists",
    x: 1020,
    y: 60,
    w: 190,
    kind: "entity",
    highlightColor: COLOR.lime,
    columns: [
      { type: "field", name: "id", tag: "PK" },
      { type: "field", name: "name" },
      { type: "field", name: "followers" },
      { type: "field", name: "popularity" },
    ],
  },
  {
    id: "track_genre",
    x: 780,
    y: 398,
    w: 190,
    kind: "junction",
    columns: [
      { type: "field", name: "track_id", tag: "PK/FK" },
      { type: "field", name: "genre_id", tag: "PK/FK" },
    ],
  },
  {
    id: "genres",
    x: 1020,
    y: 378,
    w: 190,
    kind: "entity",
    highlightColor: COLOR.info,
    columns: [
      { type: "field", name: "id", tag: "PK" },
      { type: "field", name: "name" },
    ],
  },
].map((e) => {
  const headerH = e.kind === "entity" ? 26 : 16;
  const pad = e.kind === "entity" ? PAD : JPAD;
  const rowH = e.kind === "entity" ? ROW_H : JROW_H;
  const { rows, height } = layoutColumns(e.columns, { startY: e.y, headerH, pad, rowH });
  return { ...e, headerH, rows, h: height };
});

const BY_ID = Object.fromEntries(ENTITIES.map((e) => [e.id, e]));

function anchor(entity, side) {
  const cx = entity.x + entity.w / 2;
  const cy = entity.y + entity.h / 2;
  if (side === "top") return { x: cx, y: entity.y };
  if (side === "bottom") return { x: cx, y: entity.y + entity.h };
  if (side === "left") return { x: entity.x, y: cy };
  return { x: entity.x + entity.w, y: cy };
}

const CONNECTIONS = [
  { from: "users", to: "playlists", fromSide: "bottom", toSide: "top", label: "1:N" },
  { from: "playlists", to: "playlist_track", fromSide: "right", toSide: "left" },
  { from: "playlist_track", to: "tracks", fromSide: "right", toSide: "left" },
  { from: "albums", to: "tracks", fromSide: "bottom", toSide: "top", label: "1:N" },
  { from: "albums", to: "album_artist", fromSide: "right", toSide: "left" },
  { from: "album_artist", to: "artists", fromSide: "right", toSide: "left" },
  { from: "tracks", to: "track_artist", fromSide: "right", toSide: "left" },
  { from: "track_artist", to: "artists", fromSide: "right", toSide: "left" },
  { from: "tracks", to: "track_genre", fromSide: "right", toSide: "left" },
  { from: "track_genre", to: "genres", fromSide: "right", toSide: "left" },
];

// Column-level FK -> PK pairs, used to highlight the other end of a key on hover.
const KEY_LINKS = [
  ["users.id", "playlists.owner_id"],
  ["playlists.id", "playlist_track.playlist_id"],
  ["tracks.id", "playlist_track.track_id"],
  ["tracks.id", "track_artist.track_id"],
  ["tracks.id", "track_genre.track_id"],
  ["tracks.album_id", "albums.id"],
  ["albums.id", "album_artist.album_id"],
  ["artists.id", "album_artist.artist_id"],
  ["artists.id", "track_artist.artist_id"],
  ["genres.id", "track_genre.genre_id"],
];

const LINK_MAP = {};
for (const [a, b] of KEY_LINKS) {
  (LINK_MAP[a] ??= new Set()).add(b);
  (LINK_MAP[b] ??= new Set()).add(a);
}


const FONT = "Plus Jakarta Sans, sans-serif";

const HOVER_COLOR = "#fbbf24";

function EntityBox({ e, activeKeys, onEnterKey, onLeaveKey }) {
  return (
    <g>
      <rect
        x={e.x}
        y={e.y}
        width={e.w}
        height={e.h}
        rx={8}
        fill={COLOR.entityFill}
        stroke={e.highlightColor || COLOR.border}
        strokeWidth={e.highlightColor ? 3 : 1}
      />
      <text x={e.x + 10} y={e.y + 17} fontSize={12.5} fontWeight={700} fill={COLOR.onSurface} fontFamily={FONT}>
        {e.id}
      </text>
      <line x1={e.x} y1={e.y + e.headerH} x2={e.x + e.w} y2={e.y + e.headerH} stroke={COLOR.border} strokeWidth={1} />
      {e.rows.map((row, i) =>
        row.type === "group" ? (
          <g key={i}>
            <rect
              x={e.x + 8}
              y={row.groupTop}
              width={e.w - 16}
              height={row.groupBottom - row.groupTop}
              rx={5}
              fill="none"
              stroke={COLOR.primary}
              strokeOpacity={0.35}
              strokeDasharray="3 2"
            />
            <text x={e.x + 14} y={row.captionY} fontSize={9} fontWeight={700} letterSpacing={0.3} fill={COLOR.primary} opacity={0.85} fontFamily={FONT}>
              {row.label.toUpperCase()}
            </text>
            {row.items.map((item, j) => (
              <text
                key={item}
                x={e.x + 14 + (j % 2) * ((e.w - 28) / 2)}
                y={row.itemsStartY + Math.floor(j / 2) * GROUP_ROW_H}
                fontSize={9}
                fill={COLOR.onSurfaceVariant}
                fontFamily={FONT}
              >
                {item}
              </text>
            ))}
          </g>
        ) : (
          <RowKey
            key={row.name}
            entityId={e.id}
            row={row}
            x={e.x + 10}
            xEnd={e.x + e.w - 10}
            width={e.w}
            activeKeys={activeKeys}
            onEnterKey={onEnterKey}
            onLeaveKey={onLeaveKey}
          />
        )
      )}
    </g>
  );
}

function RowKey({ entityId, row, x, xEnd, width, activeKeys, onEnterKey, onLeaveKey }) {
  const key = `${entityId}.${row.name}`;
  const active = activeKeys?.has(key);
  const hoverable = !!row.tag;
  const nameColor = active ? HOVER_COLOR : row.tag === "PK" ? COLOR.primary : COLOR.onSurfaceVariant;
  return (
    <g
      onMouseEnter={hoverable ? () => onEnterKey(key) : undefined}
      onMouseLeave={hoverable ? onLeaveKey : undefined}
      style={hoverable ? { cursor: "pointer" } : undefined}
    >
      {active && (
        <rect
          x={x - 6}
          y={row.baselineY - 11}
          width={width - 8}
          height={14}
          rx={3}
          fill={HOVER_COLOR}
          fillOpacity={0.14}
        />
      )}
      <text x={x} y={row.baselineY} fontSize={10.5} fill={nameColor} fontWeight={active || row.tag === "PK" ? 600 : 400} fontFamily={FONT}>
        {row.name}
      </text>
      {row.tag && (
        <text
          x={xEnd}
          y={row.baselineY}
          fontSize={9}
          textAnchor="end"
          fill={active ? HOVER_COLOR : row.tag === "PK" ? COLOR.primary : COLOR.onSurfaceVariant}
          opacity={active ? 1 : 0.75}
          fontWeight={active ? 700 : 400}
          fontFamily={FONT}
        >
          {row.tag}
        </text>
      )}
    </g>
  );
}

function JunctionBox({ e, activeKeys, onEnterKey, onLeaveKey }) {
  return (
    <g>
      <rect
        x={e.x}
        y={e.y}
        width={e.w}
        height={e.h}
        rx={6}
        fill={COLOR.junctionFill}
        stroke={COLOR.primary}
        strokeOpacity={0.35}
        strokeDasharray="4 3"
        strokeWidth={1}
      />
      <text x={e.x + 8} y={e.y + 12} fontSize={9.5} fontWeight={700} letterSpacing={0.4} fill={COLOR.primary} fontFamily={FONT}>
        {e.id.toUpperCase()}
      </text>
      {e.rows.map((row) => {
        const key = `${e.id}.${row.name}`;
        const active = activeKeys?.has(key);
        const hoverable = !!row.tag;
        return (
          <g
            key={row.name}
            onMouseEnter={hoverable ? () => onEnterKey(key) : undefined}
            onMouseLeave={hoverable ? onLeaveKey : undefined}
            style={hoverable ? { cursor: "pointer" } : undefined}
          >
            {active && (
              <rect x={e.x + 2} y={row.baselineY - 10} width={e.w - 4} height={12} rx={3} fill={HOVER_COLOR} fillOpacity={0.16} />
            )}
            <text
              x={e.x + 8}
              y={row.baselineY}
              fontSize={9}
              fill={active ? HOVER_COLOR : COLOR.onSurfaceVariant}
              fontWeight={active ? 700 : 400}
              fontFamily={FONT}
            >
              {row.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}

const DB_STORES = [
  {
    name: "PostgreSQL",
    items: "카탈로그(tracks/artists/albums/genres), playlist, users(id, display_name)",
    note: "영구적으로 남아야 하는, 구조화된 데이터",
  },
  {
    name: "Redis",
    items: "로그인 세션",
    note: "로그인 상태처럼 시간이 지나면 사라져도 되는 데이터",
  },
  {
    name: "Firestore",
    items: "채팅 히스토리, 최근 재생 기록",
    note: "최근 히스토리, 로그 기록",
  },
];

const LEARNINGS = [
  {
    heading: "배운 점",
    items: [
      {
        title: "초기 ERD 설계의 중요성 체감",
        body: "테이블을 어떻게 분리하고 연결하느냐에 따라 이후 작성해야 하는 JOIN문의 복잡도와 DB의 데이터 일관성 보장 수준이 결정된다는 점을 배웠다.",
      },
      {
        title: "데이터 라벨링, 메타데이터의 중요성",
        body: "구체적으로 데이터 라벨링하고 다양한 메타 데이터를 기록해두면 다양한 서비스를 제공할 수 있음을 체감.",
      },
    ],
  },
  {
    heading: "아쉬운 점",
    items: [
      {
        title: "AI 대화 기능의 임베딩 활용 부족",
        body: "자연어 질문을 임베딩으로 변환해 pgvector로 검색하는 흐름을 아직 충분히 이해하지 못해, 실제 대화 기능에 적용하지 못한 점이 아쉬웠다.",
      },
      {
        title: "대화 흐름 제어의 어려움",
        body: "자연스럽게 대화하고 user가 원하는 답변을 도출하는 것이 상당히 어려운 작업임을 깨달았다. intent 분류, context 관리, 구조화된 답변 등 답변의 품질을 높이는 방법을 자세하게 배우고 싶다는 생각이 들었다.",
      },
    ],
  },
];

export default function Home() {
  const { track } = useNowPlaying();
  const [hoveredKey, setHoveredKey] = useState(null);
  const activeKeys = useMemo(() => {
    if (!hoveredKey) return null;
    const set = new Set([hoveredKey]);
    (LINK_MAP[hoveredKey] || new Set()).forEach((k) => set.add(k));
    return set;
  }, [hoveredKey]);
  const onEnterKey = (key) => setHoveredKey(key);
  const onLeaveKey = () => setHoveredKey(null);

  return (
    <>
    <div
      className={`w-full flex flex-col gap-lg ${
        track ? "h-[calc(100vh-4rem-6.5rem)]" : "h-[calc(100vh-4rem-2.5rem)]"
      }`}
    >
      <div className="relative">
        <h1 className="mt-5 font-vibe text-[52px] font-black tracking-[-0.02em] text-on-surface">
          Database ERD
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">
          10 tables · Postgres schema
        </p>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <svg viewBox="0 0 1250 680" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={COLOR.line} />
            </marker>
          </defs>

          {CONNECTIONS.map((c, i) => {
            const from = anchor(BY_ID[c.from], c.fromSide);
            const to = anchor(BY_ID[c.to], c.toSide);
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              <g key={i}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={COLOR.line} strokeOpacity={0.55} strokeWidth={1.25} markerEnd="url(#arrow)" />
                {c.label && (
                  <text x={midX} y={midY - 5} fontSize={9} textAnchor="middle" fill={COLOR.onSurfaceVariant} fontFamily={FONT}>
                    {c.label}
                  </text>
                )}
              </g>
            );
          })}

          {ENTITIES.map((e) =>
            e.kind === "entity" ? (
              <EntityBox key={e.id} e={e} activeKeys={activeKeys} onEnterKey={onEnterKey} onLeaveKey={onLeaveKey} />
            ) : (
              <JunctionBox key={e.id} e={e} activeKeys={activeKeys} onEnterKey={onEnterKey} onLeaveKey={onLeaveKey} />
            )
          )}

          <g fontFamily={FONT}>
            <rect x={30} y={468} width={11} height={11} rx={2} fill={COLOR.entityFill} stroke={COLOR.border} />
            <text x={48} y={477} fontSize={10} fill={COLOR.onSurfaceVariant}>
              Table
            </text>
            <rect x={30} y={490} width={11} height={11} rx={2} fill={COLOR.junctionFill} stroke={COLOR.primary} strokeOpacity={0.35} strokeDasharray="3 2" />
            <text x={48} y={499} fontSize={10} fill={COLOR.onSurfaceVariant}>
              Junction (M:N)
            </text>
            <text x={30} y={521} fontSize={10} fontWeight={700} fill={COLOR.primary}>
              PK
            </text>
            <text x={52} y={521} fontSize={10} fill={COLOR.onSurfaceVariant}>
              Primary key
            </text>
            <text x={30} y={541} fontSize={10} fontWeight={600} fill={COLOR.onSurfaceVariant}>
              FK
            </text>
            <text x={52} y={541} fontSize={10} fill={COLOR.onSurfaceVariant}>
              Foreign key
            </text>
          </g>
        </svg>
      </div>
    </div>

    <div className="mt-xl">
      <h1 className="mt-5 font-vibe text-[52px] font-black tracking-[-0.02em] text-on-surface">
        DB Structure
      </h1>
      <div className="mt-lg flex flex-col gap-xl pb-xl">
        {DB_STORES.map((store) => (
          <div key={store.name} className="flex flex-col gap-sm">
            <div className="flex items-center gap-md">
              <span className="w-3 h-3 rounded-full bg-primary shrink-0" />
              <p className="font-body-lg text-[28px] leading-snug text-on-surface whitespace-nowrap">
                <span className="font-black">{store.name}</span>: {store.items}
              </p>
            </div>
            <p className="pl-xl font-body-lg text-xl leading-snug text-on-surface-variant">
              &gt;&gt; {store.note}
            </p>
          </div>
        ))}
      </div>
    </div>

    <div className="mt-xl">
      <h1 className="mt-5 font-vibe text-[52px] font-black tracking-[-0.02em] text-on-surface">
        What we learned?
      </h1>
      <div className="mt-lg flex flex-col gap-xl pb-xl">
        {LEARNINGS.map((section) => (
          <div key={section.heading} className="flex flex-col gap-lg">
            <h2 className="font-headline-lg text-headline-lg text-primary">{section.heading}</h2>
            <div className="flex flex-col gap-lg">
              {section.items.map((item) => (
                <div key={item.title} className="flex flex-col gap-sm">
                  <div className="flex items-center gap-md">
                    <span className="w-3 h-3 rounded-full bg-primary shrink-0" />
                    <p className="font-body-lg text-[28px] leading-snug font-black text-on-surface">
                      {item.title}
                    </p>
                  </div>
                  <p className="pl-xl font-body-lg text-xl leading-snug text-on-surface-variant max-w-4xl">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
