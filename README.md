# AI-Comp Decoded

An interactive visual explanation of the techniques used by [fiigii/ai-comp](https://github.com/fiigii/ai-comp), an optimizing compiler built for Anthropic's original performance take-home challenge.

**Live site:** <https://buicongnguyen.github.io/AI_compiler/>

The page begins with a five-step, beginner-first visual tour: repeated workload → scalar cleanup → eight-lane SIMD → VLIW scheduling → verified cycle reduction. A bottleneck decision map connects performance symptoms to the passes that address them.

Deeper sections follow the compiler from HIR through LIR and MIR to final VLIW bundles. They explain what the compiler optimizes—cycle count, instruction count, memory traffic, SIMD utilization, bundle occupancy, and register pressure—then decode terminology in compiler-flow order with expandable definitions. Source-reviewed diagrams connect the concepts, before/after code examples make five important rewrites concrete, and an Anthropic benchmark chart provides carefully labeled performance context.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build

```bash
npm run build
```

This is an independent educational companion, not part of the original AI-Comp project.

## GitHub Pages

Pushes to `main` run `.github/workflows/pages.yml`. The workflow builds the site, creates a static export under `docs/`, and deploys it to GitHub Pages.
