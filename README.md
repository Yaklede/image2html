# image2html

`image2html`은 이미지가 제공되면 해당 이미지를 상세히 분석해서 HTML로 변환해주는 Codex 스킬 및 검증 하네스입니다.

`image2html` is a Codex skill and verification harness for analyzing provided images in detail and converting them into high-fidelity HTML.

## Purpose / 목적

이 프로젝트의 목표는 AI model이 이미지를 더 깊게 분석하도록 규약을 제공하고, 변환된 HTML이 원본 이미지에 최대한 가깝게 보이는지 반복 검증할 수 있게 하는 것입니다. 단순한 이미지 묘사나 대략적인 HTML 생성이 아니라, 약 90%에 가까운 재현 품질을 목표로 합니다.

The goal is to guide an AI model through detailed image analysis, structured HTML/CSS implementation, and repeatable visual verification so the generated HTML can approach a 90% fidelity target.

## What It Includes / 구성

- `SKILL.md`: Codex skill entrypoint and workflow.
- `references/analysis-schema.md`: structured image analysis contract.
- `references/implementation-rules.md`: HTML/CSS implementation rules.
- `references/fidelity-rubric.md`: scoring and pass/fail rubric.
- `references/report-format.md`: final report format.
- `scripts/`: Playwright-based render, screenshot comparison, accessibility, and full harness scripts.
- `assets/templates/single-file.html`: standalone HTML starting template.

## Harness Usage / 하네스 실행

Install dependencies:

```bash
npm install
```

Run the full harness:

```bash
npm run harness -- --reference path/to/reference.png --html path/to/output.html --spec path/to/analysis.json --out .image2html-report
```

Use `--crop x,y,width,height` when the reference includes browser chrome but no spec exists.

The harness crops the source image when `contentBounds` is provided, renders the HTML at the content viewport, captures a screenshot, compares it against the reference image, inspects component bounding boxes, runs region-level diffs, runs edge/shadow diagnostics, checks responsive overflow, runs accessibility checks, and writes:

- `.image2html-report/reference.png`
- `.image2html-report/rendered.png`
- `.image2html-report/diff.png`
- `.image2html-report/edge-diff.png`
- `.image2html-report/shadow-diff.png`
- `.image2html-report/layout.json`
- `.image2html-report/responsive.json`
- `.image2html-report/report.json`
- `.image2html-report/report.md`

## Quality Target / 품질 기준

Default target score is `0.90`.

The automated score combines:

- pixel similarity
- viewport/dimension agreement
- region-level similarity
- DOM bounding-box agreement through `data-i2h-id`
- edge/shadow diagnostics
- responsive sanity
- accessibility violations

Manual review is still required for exact text correctness, typography nuance, icon meaning, and subtle visual details.

## Asset Slots / 이미지 슬롯

Image-like regions such as portraits, generated illustrations, product renders, photos, and embedded screenshots should be represented as fillable asset slots first. The harness validates the slot's bounds and layout, skips region pixel comparison, and masks the slot in global pixel, edge, and shadow diagnostics until a real asset is supplied.

이미지로 추정되는 영역은 어설픈 CSS/SVG 근사 대신 나중에 채워 넣을 수 있는 asset slot으로 남기는 것을 기본 규칙으로 합니다. 하네스는 해당 영역의 위치와 크기는 검증하되, 실제 에셋이 들어오기 전까지 전체 diff/edge/shadow 비교에서는 마스킹합니다.
