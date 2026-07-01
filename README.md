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
npm run harness -- --reference path/to/reference.png --html path/to/output.html --out .image2html-report
```

The harness renders the HTML at the source image viewport, captures a screenshot, compares it against the reference image, runs accessibility checks, and writes:

- `.image2html-report/reference.png`
- `.image2html-report/rendered.png`
- `.image2html-report/diff.png`
- `.image2html-report/report.json`
- `.image2html-report/report.md`

## Quality Target / 품질 기준

Default target score is `0.90`.

The automated score combines:

- pixel similarity
- viewport/dimension agreement
- accessibility violations

Manual review is still required for exact text correctness, typography nuance, icon meaning, and subtle visual details.
