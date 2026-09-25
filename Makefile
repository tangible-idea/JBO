SHELL := /bin/zsh
.DEFAULT_GOAL := run

.PHONY: help setup install guard-key verify test check run dev stop restart status chrome doctor clean package cws-status release site site-build deploy-api

help: ## 사용 가능한 명령을 표시합니다.
	@awk 'BEGIN {FS = ":.*## "; print "Tidymark\n"} /^[a-zA-Z_-]+:.*## / {printf "  make %-10s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: install .env ## 의존성과 로컬 환경파일을 준비합니다.
	@echo "준비 완료. .env에 TYPESAFE_API_KEY가 있는지 확인하세요."

install: node_modules/.package-lock.json ## npm 의존성을 재현 가능하게 설치합니다.

node_modules/.package-lock.json: package.json package-lock.json
	@echo "npm 의존성을 설치합니다…"
	@npm ci

.env: ## 없을 때만 .env.example로 만듭니다. 기존 .env는 덮어쓰지 않습니다.
	@install -m 600 .env.example .env
	@echo ".env를 만들었습니다. TYPESAFE_API_KEY를 입력한 뒤 다시 실행하세요."

guard-key: .env ## 실제 TypeSafe API 키가 설정되었는지 검사합니다.
	@key=$$(sed -n 's/^TYPESAFE_API_KEY=//p' .env | tail -n 1); \
	if [[ -z "$$key" || "$$key" == "your_typesafe_api_key" ]]; then \
		echo "오류: .env의 TYPESAFE_API_KEY를 실제 키로 바꿔주세요."; \
		exit 1; \
	fi

verify: test check ## 테스트와 정적 검사를 모두 실행합니다.

test: install ## 단위 테스트를 실행합니다.
	@npm test

check: install ## JavaScript와 manifest 문법을 검사합니다.
	@npm run check
	@node -e 'JSON.parse(require("fs").readFileSync("extension/manifest.json")); console.log("manifest: valid JSON")'

run: install guard-key verify ## 모두 준비한 뒤 백엔드를 실행합니다. 기본 make 명령입니다.
	@echo "백엔드를 http://127.0.0.1:8787 에서 시작합니다…"
	@set -a; source .env; set +a; exec npm start

dev: install guard-key ## 파일 변경 감시 모드로 백엔드를 실행합니다.
	@set -a; source .env; set +a; exec npm run dev

stop: ## 이 프로젝트가 8787 포트에서 실행 중이면 안전하게 종료합니다.
	@pid=$$(lsof -tiTCP:8787 -sTCP:LISTEN 2>/dev/null | head -n 1); \
	if [[ -z "$$pid" ]]; then \
		echo "실행 중인 백엔드가 없습니다."; \
	else \
		server_cwd=$$(lsof -a -p "$$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'); \
		server_cmd=$$(ps -p "$$pid" -o command=); \
		if [[ "$$server_cwd" != "$(CURDIR)" || "$$server_cmd" != *"server/index.mjs"* ]]; then \
			echo "오류: 8787 포트를 다른 프로세스가 사용 중이라 종료하지 않았습니다. (PID $$pid)"; \
			exit 1; \
		fi; \
		kill "$$pid"; \
		echo "기존 Tidymark 백엔드를 종료했습니다. (PID $$pid)"; \
	fi

restart: stop run ## 기존 백엔드를 종료하고 새 .env로 다시 실행합니다.

status: ## 실행 중인 백엔드와 API 키 반영 상태를 확인합니다.
	@response=$$(curl -fsS --max-time 2 http://127.0.0.1:8787/health 2>/dev/null || true); \
	if [[ -z "$$response" ]]; then \
		echo "백엔드가 실행 중이 아닙니다."; \
	elif node -e 'const x=JSON.parse(process.argv[1]); process.exit(x.ok && x.configured ? 0 : 1)' "$$response"; then \
		echo "백엔드 정상: API 키가 반영되어 있습니다."; \
	else \
		echo "오류: 실행 중인 백엔드에 API 키가 반영되지 않았습니다. make restart를 실행하세요."; \
		exit 1; \
	fi

chrome: ## Chrome 확장 관리 화면과 로드할 폴더를 엽니다.
	@if [[ "$$(uname -s)" == "Darwin" ]]; then \
		open -a "Google Chrome" "chrome://extensions"; \
		open extension; \
	else \
		echo "Chrome에서 chrome://extensions 를 열고 $$(pwd)/extension 폴더를 로드하세요."; \
	fi

doctor: install ## Node, API 키, 프로젝트 상태를 빠르게 점검합니다.
	@node -e 'const major=Number(process.versions.node.split(".")[0]); console.log(`Node $${process.versions.node}`); if (major < 20) { console.error("Node 20 이상이 필요합니다."); process.exit(1) }'
	@$(MAKE) --no-print-directory guard-key
	@$(MAKE) --no-print-directory verify
	@response=$$(curl -fsS --max-time 2 http://127.0.0.1:8787/health 2>/dev/null || true); \
	if [[ -n "$$response" ]]; then $(MAKE) --no-print-directory status; fi
	@echo "모든 점검을 통과했습니다."

clean: ## 설치된 npm 의존성만 제거합니다. .env는 보존합니다.
	@node -e 'require("fs").rmSync("node_modules", {recursive:true, force:true})'

package: verify ## 스토어 업로드용 zip을 dist/에 만듭니다.
	@node scripts/cws.mjs package

cws-status: .env ## Chrome Web Store 항목 상태를 조회합니다.
	@set -a; source .env; set +a; node scripts/cws.mjs status

release: verify .env ## 테스트 후 zip을 업로드하고 스토어 검토에 제출합니다.
	@set -a; source .env; set +a; node scripts/cws.mjs release

site/node_modules/.package-lock.json: site/package.json site/package-lock.json
	@cd site && npm ci

site: site/node_modules/.package-lock.json ## 소개 웹사이트(React)를 개발 서버로 띄웁니다.
	@cd site && npm run dev

site-build: site/node_modules/.package-lock.json ## 소개 웹사이트를 site/dist에 정적 파일로 빌드합니다.
	@cd site && npm run build

deploy-api: verify .env ## 백엔드를 Cloud Run에 배포하고 서비스 URL을 출력합니다.
	@set -a; source .env; set +a; ./scripts/deploy-api.sh
