# Taste

음악 카탈로그 탐색, 플레이리스트 관리, 분위기 기반 추천, 통계를 제공하는 로컬 웹 앱입니다.

## 구성

- Frontend: React, Vite, Tailwind CSS
- API: FastAPI
- Storage: PostgreSQL, Redis, Firestore
- Catalog source: 공개 Hugging Face 데이터셋
- Authentication: Spotify OAuth

데이터베이스는 10개 테이블로 구성되며, OAuth 프로필은 1:1 보조 테이블 없이 `users`에 함께 저장합니다.

Spotify Web API는 로그인 사용자 확인과 사용자의 플레이리스트 가져오기에 사용합니다. 가져온
플레이리스트와 곡 메타데이터는 PostgreSQL에 저장되며, 음악 검색은 로컬 카탈로그를 사용합니다.

## 실행

1. `.env.example`을 `.env`로 복사하고 값을 채웁니다. (`firebase-service-account.json`은 git에 포함되지 않으니 별도로 전달받아 프로젝트 루트에 둡니다.)
2. `frontend/.env.example`을 `frontend/.env`로 복사합니다.

### Docker로 한 번에 실행 (추천)

Python/Node를 따로 설치할 필요 없이, Postgres·Redis·백엔드·프런트엔드 4개가 한 번에 뜹니다.

```powershell
docker compose up -d --build
```

카탈로그 데이터를 처음 적재합니다. (이미 채워진 DB를 덤프로 받았다면 생략)

```powershell
docker compose exec backend python -m ingest.run
```

- App: http://127.0.0.1:5500
- API docs: http://127.0.0.1:8010/docs

코드를 수정하면 컨테이너 안에서 바로 반영됩니다 (백엔드는 `--reload`, 프런트엔드는 Vite HMR).

### 직접 실행하고 싶다면

3. PostgreSQL과 Redis만 Docker로 실행합니다.

   ```powershell
   docker compose up -d postgres redis
   ```

4. 카탈로그 데이터를 처음 적재합니다.

   ```powershell
   .\S_env\Scripts\python.exe -m ingest.run
   ```

5. API를 실행합니다.

   ```powershell
   .\S_env\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8010
   ```

6. 프런트엔드를 실행합니다.

   ```powershell
   cd frontend
   npm install
   npm run dev -- --host 127.0.0.1 --port 5500
   ```

## 스키마 변경

`db/schema.sql`은 새 데이터베이스 초기화용입니다. 기존 PostgreSQL 볼륨의 구조를 보강할 때는 `db/add_constraints_and_indexes.sql`을 한 번 적용합니다.

## 인덱스 손상 증상이 보이면

Postgres 이미지를 `pgvector/pgvector:pg16`으로 교체하는 과정에서 일부 환경에서 인덱스가 손상되는 문제가 있었습니다.
"아티스트로 검색했는데 결과에 아티스트 이름이 안 붙어 나온다" 같은 증상이 보이면 `db/reindex_if_corrupted.sql`을 한 번 적용하세요.

```powershell
docker compose exec -T postgres psql -U spotify -d spotify < db/reindex_if_corrupted.sql
```
