SHELL := /bin/zsh
.DEFAULT_GOAL := run

.PHONY: help setup install guard-key verify test check run dev chrome doctor clean

help: ## 사용 가능한 명령을 표시합니다.
	@awk 'BEGIN {FS = ":.*## "; print "JEV 북마크 분류기\n"} /^[a-zA-Z_-]+:.*## / {printf "  make %-10s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: install .env ## 의존성과 로컬 환경파일을 준비합니다.
	@echo "준비 완료. .env에 TYPESAFE_API_KEY가 있는지 확인하세요."

install: node_modules/.package-lock.json ## npm 의존성을 재현 가능하게 설치합니다.

node_modules/.package-lock.json: package.json package-lock.json
	@echo "npm 의존성을 설치합니다…"
	@npm ci

.env: .env.example
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
	@echo "모든 점검을 통과했습니다."

clean: ## 설치된 npm 의존성만 제거합니다. .env는 보존합니다.
	@node -e 'require("fs").rmSync("node_modules", {recursive:true, force:true})'
