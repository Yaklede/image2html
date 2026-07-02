# image2html

`image2html`은 이미지가 제공되면 해당 이미지를 상세히 분석해서 HTML로 변환해주는 Codex 스킬 및 검증 하네스입니다.

`image2html` is a Codex skill and verification harness for analyzing provided images in detail and converting them into high-fidelity HTML.

## Purpose / 목적

이 프로젝트의 목표는 AI model이 이미지를 더 깊게 분석하도록 규약을 제공하고, 변환된 HTML이 원본 이미지에 최대한 가깝게 보이는지 반복 검증할 수 있게 하는 것입니다. 단순한 이미지 묘사나 대략적인 HTML 생성이 아니라, 약 90%에 가까운 재현 품질을 목표로 합니다.

The goal is to guide an AI model through detailed image analysis, structured HTML/CSS implementation, and repeatable visual verification so the generated HTML can approach a 90% fidelity target.

## What It Includes / 구성

- `SKILL.md`: Codex skill entrypoint and workflow.
- `dock.yml`: OpenDock release manifest for installing this as a Codex skill dock.
- `DOCK.md`: OpenDock Hub detail-page README.
- `references/analysis-schema.md`: structured image analysis contract.
- `references/implementation-rules.md`: HTML/CSS implementation rules.
- `references/fidelity-rubric.md`: scoring and pass/fail rubric.
- `references/report-format.md`: final report format.
- `scripts/`: Playwright-based render, screenshot comparison, accessibility, and full harness scripts.
- `assets/templates/single-file.html`: standalone HTML starting template.

## NPM Package / npm 패키지

The harness is prepared to publish as `@yaklede/image2html`. Publish it as a public npm package, then reference the CLI commands from OpenDock `tools` instead of vendoring `node_modules` into the dock archive.

하네스는 `@yaklede/image2html` npm 패키지로 publish하는 구조입니다. OpenDock archive 안에 `node_modules`를 포함하지 않고, publish 이후 OpenDock `tools`에서 npm CLI 패키지로 선언합니다.

### Publisher Requirements / publish 전에 필요한 것

- npm 계정: `@yaklede` scope에 publish 권한이 있어야 합니다. 권한이 없으면 publish 전에 package scope/name을 바꿔야 합니다.
- 인증 정보: 로컬에서는 `npm login`, CI에서는 publish 권한이 있는 `NPM_TOKEN`이 필요합니다. 토큰은 절대 저장소에 커밋하지 않습니다.
- 2FA OTP: npm 계정이 publish 2FA를 요구하면 1회용 OTP가 필요합니다.
- 고유 버전: `package.json`의 `version`은 npm에 이미 올라간 적 없는 semver여야 합니다.
- 공개 scoped package 승인: scoped package를 public으로 올리기 위해 `npm publish --access public`을 사용합니다.

### Publish / 배포

```bash
npm whoami
npm pack --dry-run
npm publish --access public
```

If npm asks for 2FA:

```bash
npm publish --access public --otp 123456
```

For CI:

```bash
npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN"
npm publish --access public
```

### NPM Usage / npm 사용법

Install the harness in a project:

```bash
npm install -D @yaklede/image2html
```

Run the single-image harness:

```bash
npx image2html-harness --reference path/to/reference.png --html path/to/output.html --spec path/to/analysis.json --out .image2html-report
```

Run the multi-image site harness:

```bash
npx image2html-site-harness --manifest path/to/site-manifest.json --out .image2html-site-report
```

Or call the installed binaries directly:

```bash
./node_modules/.bin/image2html-harness --reference path/to/reference.png --html path/to/output.html --out .image2html-report
./node_modules/.bin/image2html-site-harness --manifest path/to/site-manifest.json --out .image2html-site-report
```

## OpenDock Deploy / OpenDock 배포

OpenDock installs the Codex skill files and references. Runtime dependencies must come from npm through `tools`; OpenDock tasks must not run package-install commands or archive vendored native binaries.

OpenDock는 Codex skill 파일과 reference 문서를 설치합니다. 런타임 dependency는 npm package를 `tools`로 선언해서 공급해야 하며, OpenDock task에서 `npm install`을 실행하거나 native binary가 포함된 `node_modules`를 archive에 넣지 않습니다.

After the npm package is published, declare it as a project-local tool in `dock.yml`:

```yaml
tools:
  image2html:
    manager: npm
    package: "@yaklede/image2html"
    version: "1.0.0"
    commands:
      - image2html-harness
      - image2html-site-harness
```

Deploy for review:

```bash
opendock auth login
opendock deploy yaklede/image2html@1.0.0 --platform macos --file dock.yml
```

Installed files and tool shims are checked with:

```bash
opendock doctor yaklede/image2html
```

## Harness Usage / 하네스 실행

For repository development, install dependencies locally:

```bash
npm install
```

Run the full harness:

```bash
npm run harness -- --reference path/to/reference.png --html path/to/output.html --spec path/to/analysis.json --out .image2html-report
```

Use `--crop x,y,width,height` when the reference includes browser chrome but no spec exists.

Run the multi-image site harness:

```bash
npm run site-harness -- --manifest path/to/site-manifest.json --out .image2html-site-report
```

여러 장의 이미지가 같은 제품/웹사이트의 서로 다른 화면을 나타내는 경우, 결과물은 각각 따로 떨어진 HTML이 아니라 하나의 동작 가능한 사이트여야 합니다. 공통 헤더/푸터/네비게이션/컴포넌트를 공유하고, 각 이미지는 route 또는 state로 매핑합니다.

When multiple images describe different screens of the same site, the output should be one functional site, not disconnected static HTML pages. Shared header, footer, navigation, components, responsive behavior, and stateful interactions should be implemented once and reused across routes.

The harness crops the source image when `contentBounds` is provided, optionally normalizes it to `renderViewport`, renders the HTML at the intended browser viewport, captures a screenshot, compares it against the reference image, inspects component and nested-component bounding boxes, runs region-level diffs, runs edge/shadow diagnostics, checks responsive overflow/clipping, runs accessibility checks, and writes:

- `.image2html-report/reference.png`
- `.image2html-report/rendered.png`
- `.image2html-report/diff.png`
- `.image2html-report/edge-diff.png`
- `.image2html-report/shadow-diff.png`
- `.image2html-report/layout.json`
- `.image2html-report/responsive.json`
- `.image2html-report/responsive/*.png`
- `.image2html-report/report.json`
- `.image2html-report/report.md`

The site harness additionally validates:

- route-to-reference screenshot similarity
- shared navigation active states
- responsive screenshots across selected routes
- no horizontal overflow on desktop/mobile
- interaction flows such as forms, filters, accordions, modals, pricing CTAs, mobile menus, and 404 recovery

## Example Output / 변환 예시

아래 예시는 10장의 웹사이트 화면 이미지를 입력으로 받아 하나의 동작 가능한 HTML 사이트로 변환한 결과입니다. 각 이미지는 개별 HTML 파일이 아니라 하나의 사이트 안에서 route와 state로 연결되며, 공통 header/footer/navigation, modal, accordion, filter, form success state, mobile drawer, 404 recovery까지 구현합니다.

The sample below converts 10 website screenshots into one functional HTML site. The screens are connected as routes and states inside a single site, with shared layout, responsive behavior, modals, accordions, filters, form feedback, a mobile drawer, and 404 recovery.

- Source images / 입력 이미지: [`tests/brand-site/reference/`](https://github.com/Yaklede/image2html/tree/main/tests/brand-site/reference)
- Generated site / 변환 결과: [`tests/brand-site/index.html`](https://github.com/Yaklede/image2html/blob/main/tests/brand-site/index.html)
- Harness manifest / 검증 매니페스트: [`tests/brand-site/site-manifest.json`](https://github.com/Yaklede/image2html/blob/main/tests/brand-site/site-manifest.json)
- Verification report / 검증 리포트: [`tests/brand-site/report/report.md`](https://github.com/Yaklede/image2html/blob/main/tests/brand-site/report/report.md)
- Result / 결과: average similarity `0.9315`, pages `10/10`, responsive checks `12/12`, interactions `6/6`

Run the committed sample from a repository checkout:

```bash
python3 -m http.server 5501 --bind 127.0.0.1
open http://127.0.0.1:5501/tests/brand-site/index.html#/
```

| Reference Image / 입력 이미지 | Generated HTML Render / HTML 변환 결과 |
| --- | --- |
| <img src="https://raw.githubusercontent.com/Yaklede/image2html/main/tests/brand-site/reference/home.png" width="420" alt="Home page reference screenshot"> | <img src="https://raw.githubusercontent.com/Yaklede/image2html/main/tests/brand-site/report/pages/home/rendered.png" width="420" alt="Generated home page HTML render"> |
| <img src="https://raw.githubusercontent.com/Yaklede/image2html/main/tests/brand-site/reference/pricing.png" width="420" alt="Pricing page reference screenshot"> | <img src="https://raw.githubusercontent.com/Yaklede/image2html/main/tests/brand-site/report/pages/pricing/rendered.png" width="420" alt="Generated pricing page HTML render"> |
| <img src="https://raw.githubusercontent.com/Yaklede/image2html/main/tests/brand-site/reference/contact.png" width="420" alt="Contact page reference screenshot"> | <img src="https://raw.githubusercontent.com/Yaklede/image2html/main/tests/brand-site/report/pages/contact/rendered.png" width="420" alt="Generated contact page HTML render"> |
| <img src="https://raw.githubusercontent.com/Yaklede/image2html/main/tests/brand-site/reference/portfolio.png" width="420" alt="Portfolio page reference screenshot"> | <img src="https://raw.githubusercontent.com/Yaklede/image2html/main/tests/brand-site/report/pages/portfolio/rendered.png" width="420" alt="Generated portfolio page HTML render"> |

## Quality Target / 품질 기준

Default target score is `0.90`.

The automated score combines:

- pixel similarity
- viewport/dimension agreement
- region-level similarity
- DOM bounding-box agreement through `data-i2h-id`
- nested component containment through `parentId`
- edge/shadow diagnostics
- responsive sanity
- accessibility violations

Manual review is still required for exact text correctness, typography nuance, icon meaning, and subtle visual details.

## Asset Slots / 이미지 슬롯

Image-like regions such as portraits, generated illustrations, product renders, photos, and embedded screenshots should be represented as fillable asset slots first. The harness validates the slot's bounds and layout, skips region pixel comparison, and masks the slot in global pixel, edge, and shadow diagnostics until a real asset is supplied.

이미지로 추정되는 영역은 어설픈 CSS/SVG 근사 대신 나중에 채워 넣을 수 있는 asset slot으로 남기는 것을 기본 규칙으로 합니다. 하네스는 해당 영역의 위치와 크기는 검증하되, 실제 에셋이 들어오기 전까지 전체 diff/edge/shadow 비교에서는 마스킹합니다.
