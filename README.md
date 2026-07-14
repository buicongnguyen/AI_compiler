# AI-Comp Decoded

An interactive visual explanation of the techniques used by [fiigii/ai-comp](https://github.com/fiigii/ai-comp), an optimizing compiler built for Anthropic's original performance take-home challenge.

The page follows the compiler from HIR through LIR and MIR to final VLIW bundles, then explains the main optimization ideas: loop unrolling, repeated simplification, SROA, memory elimination, SLP vectorization, MAD synthesis, dependency-aware scheduling, register allocation, and VLIW bundling.

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
