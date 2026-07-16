"use client";

import { useState } from "react";

const stages = [
  {
    id: "HIR",
    kicker: "01 / SHAPE",
    title: "High-level intent",
    text: "Structured control flow, SSA values, pointers, vectors, and assumptions keep the kernel easy to express and analyze.",
    code: ["for round in range(16):", "  node = forest[index]", "  value = hash(value ^ node)", "  index = 2 * index + parity(value)"],
    tags: ["SSA", "CFG", "alias facts"],
  },
  {
    id: "LIR",
    kicker: "02 / EXPOSE",
    title: "Parallel work appears",
    text: "Unrolling, scalar replacement, simplification, and SLP turn repeated scalar work into explicit machine-sized vectors.",
    code: ["%v0 = vload %values", "%v1 = gather %forest, %indices", "%v2 = vxor %v0, %v1", "%v3 = hash8 %v2"],
    tags: ["SLP ×8", "SROA", "load elimination"],
  },
  {
    id: "MIR",
    kicker: "03 / PLAN",
    title: "Machine resources matter",
    text: "Phi nodes are gone. Operations carry dependencies, engine choices, and live ranges for scheduling and register allocation.",
    code: ["load.0   r24, [r8]", "valu.0   r40, r24, r32", "alu.0    r7, r7, 1", "flow.0   jump_if r3, loop"],
    tags: ["DDG", "live ranges", "engine slots"],
  },
  {
    id: "VLIW",
    kicker: "04 / PACK",
    title: "One cycle, many engines",
    text: "The scheduler packs independent scalar, vector, memory, and flow operations into legal bundles for the simulated VLIW machine.",
    code: ["cycle 184 {", "  load:  [vload r40, r8]", "  valu:  [xor r64, r48, r56]", "  alu:   [add r7, r7, 1]", "}"],
    tags: ["12 ALU", "6 VALU", "2 load + 2 store"],
  },
];

const techniques = [
  { n: "01", name: "Expose the work", optimizes: "Parallelism", detail: "Loop unrolling duplicates the hot traversal body, revealing operations from several iterations that can execute together.", change: "fewer loop branches · larger scheduling window" },
  { n: "02", name: "Delete the noise", optimizes: "Instruction count", detail: "DCE removes unused results. CSE reuses repeated expressions. Copy propagation, folding, and CFG cleanup repeatedly shrink the program as new opportunities appear.", change: "less work · shorter dependency chains" },
  { n: "03", name: "Promote memory", optimizes: "Memory traffic", detail: "SROA turns small aggregate and table accesses into SSA values; load elimination and DSE remove redundant traffic when alias analysis proves it safe.", change: "loads become value reuse · dead stores vanish" },
  { n: "04", name: "Make arithmetic cheaper", optimizes: "ALU operations", detail: "Strength reduction replaces repeated induction arithmetic, while MAD synthesis recognizes multiply-plus-add shapes supported directly by the vector engine.", change: "multiple ops collapse into one machine op" },
  { n: "05", name: "Pack eight lanes", optimizes: "Data parallelism", detail: "Superword-level parallelism groups independent, isomorphic scalar operations into the VM’s 8-lane vectors. Contiguous accesses become vload/vstore; gather-like access is built from lane-wise loads.", change: "up to 8 scalar values per vector ALU instruction" },
  { n: "06", name: "Schedule the graph", optimizes: "Bundle occupancy", detail: "A dependency graph decides what is ready. Delay-aware list scheduling prioritizes work that unblocks loads, fills engine slots, and can stagger independent streams.", change: "fewer empty slots · fewer dependency stalls" },
  { n: "07", name: "Spend registers wisely", optimizes: "Scratch pressure", detail: "Linear-scan allocation maps live ranges into 1,536 scratch words. Spill machinery exists, but the default pass configuration disables it, so scalars and contiguous 8-word vectors must fit.", change: "reuse scratch safely · avoid allocation failure" },
  { n: "08", name: "Bundle for width", optimizes: "Cycle count", detail: "Independent operations share a cycle: up to 12 scalar ALU, 6 vector ALU, 2 loads, 2 stores, and 1 flow slot.", change: "more useful operations retired each cycle" },
];

const optimizationTargets = [
  { key: "CYCLES", title: "Executed cycles", body: "The benchmark score is driven by how many non-debug VLIW bundles the VM executes. One legal bundle advances the machine by one cycle.", signal: "Primary objective", tone: "acid" },
  { key: "WORK", title: "Instruction count", body: "Dead instructions, repeated expressions, avoidable branches, and redundant address arithmetic consume scarce slots even when they are individually cheap.", signal: "Remove or combine", tone: "orange" },
  { key: "MEM", title: "Memory traffic", body: "The machine has only two load and two store slots per bundle. Keeping values in scratch and reusing proven loads reduces a frequent bottleneck.", signal: "Load/store slots", tone: "blue" },
  { key: "SIMD", title: "Lane utilization", body: "VALU instructions operate on eight contiguous scratch words. Vectorization pays when eight independent scalar operations can share one vector opcode.", signal: "8 lanes per vector", tone: "acid" },
  { key: "ILP", title: "Engine utilization", body: "VLIW is only fast when independent ALU, VALU, load, store, and flow operations can occupy the same bundle without hazards.", signal: "Fill parallel slots", tone: "orange" },
  { key: "REG", title: "Register pressure", body: "Unrolling and vectorization create more live values. They must fit in the 1,536-word per-core scratch file; each vector needs one contiguous range of eight words.", signal: "Hard capacity", tone: "blue" },
];

const terms = [
  { category: "IR", term: "IR", expansion: "Intermediate Representation", definition: "The compiler’s internal program format. It is easier to analyze and rewrite than source code or final machine bundles." },
  { category: "IR", term: "HIR", expansion: "High-level IR", definition: "The structured, SSA-oriented level where loops, conditions, pointers, assumptions, and vector intent are still visible." },
  { category: "IR", term: "LIR", expansion: "Low-level IR", definition: "A flatter representation closer to the target instruction set. Control flow and machine-like operations are explicit enough for scheduling." },
  { category: "IR", term: "MIR", expansion: "Machine IR", definition: "Scheduled machine operations grouped around engine constraints, before virtual scratch locations become final physical addresses." },
  { category: "Machine", term: "VLIW", expansion: "Very Long Instruction Word", definition: "One instruction bundle explicitly names several independent operations that different execution engines perform in the same cycle." },
  { category: "Machine", term: "SIMD / VALU", expansion: "Single Instruction, Multiple Data", definition: "One vector opcode performs the same operation across eight lanes. VALU is the VM’s vector arithmetic engine." },
  { category: "Analysis", term: "SSA", expansion: "Static Single Assignment", definition: "Each value is defined once. This makes data flow, replacement, dead-code removal, and expression reuse easier to prove." },
  { category: "Analysis", term: "CFG", expansion: "Control-Flow Graph", definition: "Basic blocks connected by possible jumps. Simplifying it removes unreachable blocks, trampolines, and redundant branches." },
  { category: "Analysis", term: "DDG", expansion: "Data-Dependency Graph", definition: "A graph whose edges say which operations must precede others. The scheduler may pack nodes together only when hazards permit." },
  { category: "Analysis", term: "Alias analysis", expansion: "Can two addresses overlap?", definition: "A proof system for memory addresses. If two pointers cannot refer to the same location, loads and stores can move or disappear safely." },
  { category: "Pass", term: "DCE / DSE", expansion: "Dead Code / Dead Store Elimination", definition: "DCE removes computations whose results are unused. DSE removes writes that cannot affect a later observable read." },
  { category: "Pass", term: "CSE", expansion: "Common Subexpression Elimination", definition: "If the same pure expression is computed twice with the same inputs, reuse the first result instead of doing the work again." },
  { category: "Pass", term: "SROA", expansion: "Scalar Replacement of Aggregates", definition: "Break a small array, table, or aggregate into independent SSA values so later passes can optimize each element directly." },
  { category: "Pass", term: "SLSR", expansion: "Straight-Line Strength Reduction", definition: "Recognize related repeated arithmetic and derive later values from earlier ones with cheaper incremental operations." },
  { category: "Pass", term: "SLP", expansion: "Superword-Level Parallelism", definition: "Find similar independent scalar statements and pack them into fixed-width vector operations without changing the source algorithm." },
  { category: "Pass", term: "MAD", expansion: "Multiply-Add", definition: "Fuse a multiply followed by an add into the target’s multiply_add operation when use counts and dependencies make it legal and profitable." },
  { category: "Machine", term: "Register pressure", expansion: "Live storage demand", definition: "How many scratch words must hold simultaneously live values. Vectors count as eight words and need a contiguous range, which can make fragmentation matter." },
  { category: "Machine", term: "RAW hazard", expansion: "Read After Write", definition: "A consumer cannot read a producer’s new value in the same bundle because all slots read the pre-bundle state. It must wait at least one bundle." },
  { category: "Machine", term: "Gather", expansion: "Load from unrelated addresses", definition: "Each vector lane reads a different address. This VM has no native gather opcode, so AI-Comp forms gather-like work from lane-wise load_offset operations." },
  { category: "Analysis", term: "Critical path", expansion: "Longest dependency chain", definition: "The chain of dependent operations that sets a lower bound on schedule length. Work outside that chain may fill otherwise idle engine slots." },
  { category: "Pass", term: "List scheduling", expansion: "Choose among ready operations", definition: "Repeatedly select dependency-ready instructions by priority and pack those that fit the current bundle’s remaining engine slots." },
  { category: "Machine", term: "Spilling", expansion: "Move live values to memory", definition: "When scratch is exhausted, save selected live values to memory and reload them later. AI-Comp implements this, but its default configuration disables it." },
];

const passes = ["DCE", "UNROLL", "SIMPLIFY", "CSE", "SROA", "LOAD ELIM", "DSE", "SLSR", "SLP ×8", "MAD", "LOWER", "COPY PROP", "CFG", "PHI ELIM", "SCHEDULE", "REGALLOC", "VLIW"];

const benchmarkLadder = [
  { label: "2-hour starter", cycles: 18532, speedup: 1.0, kind: "baseline" },
  { label: "Opus 4 · extended harness", cycles: 2164, speedup: 8.56 },
  { label: "Opus 4.5 · casual session", cycles: 1790, speedup: 10.35 },
  { label: "Opus 4.5 · 2-hour harness", cycles: 1579, speedup: 11.74 },
  { label: "Sonnet 4.5 · extended harness", cycles: 1548, speedup: 11.97 },
  { label: "Opus 4.5 · 11.5-hour harness", cycles: 1487, speedup: 12.46 },
  { label: "Opus 4.5 · improved harness", cycles: 1363, speedup: 13.6, kind: "best" },
];

const sources = [
  { group: "Challenge", title: "Anthropic original performance take-home", url: "https://github.com/anthropics/original_performance_takehome", note: "Authoritative challenge description, validation rules, and published cycle reference points." },
  { group: "Project", title: "AI-Comp source and README", url: "https://github.com/fiigii/ai-comp", note: "The compiler pipeline, diagnostics, pass configuration, tests, and kernel entry point explained by this site." },
  { group: "Project", title: "AI-Comp VLIW ISA specification", url: "https://github.com/fiigii/ai-comp/blob/main/docs/VLIW_ISA.md", note: "Word size, scratch layout, vector length, bundle semantics, engines, and slot limits." },
  { group: "Project", title: "Instruction scheduling design", url: "https://github.com/fiigii/ai-comp/blob/main/docs/instruction_scheduling_design.md", note: "Dependency delays, RAW hazards, conservative memory ordering, priorities, list scheduling, and stream staggering." },
  { group: "Project", title: "SLP vectorization design", url: "https://github.com/fiigii/ai-comp/blob/main/docs/slp_vectorization_design.md", note: "Pack discovery, isomorphic operations, legality checks, cost modeling, and vector code generation." },
  { group: "Project", title: "HIR load elimination design", url: "https://github.com/fiigii/ai-comp/blob/main/docs/hir_load_elimination_design.md", note: "MustAlias / NoAlias / MayAlias reasoning and safe store-to-load forwarding." },
  { group: "LLVM", title: "LLVM auto-vectorization documentation", url: "https://llvm.org/docs/Vectorizers.html", note: "Independent confirmation of SLP’s purpose and the tradeoff between unrolling, parallelism, register pressure, and code size." },
  { group: "LLVM", title: "LLVM alias-analysis infrastructure", url: "https://llvm.org/docs/AliasAnalysis.html", note: "Reference terminology for MustAlias, MayAlias, NoAlias, and memory modification/reference queries." },
  { group: "LLVM", title: "LLVM IR language reference", url: "https://llvm.org/docs/LangRef.html#phi-instruction", note: "Primary reference for SSA-oriented IR and phi nodes at control-flow merges." },
  { group: "Tool", title: "Perfetto UI documentation", url: "https://perfetto.dev/docs/visualization/perfetto-ui", note: "How the trace viewer used by the project presents execution events on a navigable timeline." },
];

const codeExamples = [
  {
    id: "SLP",
    title: "SLP vectorization",
    question: "How do scalar statements become one SIMD operation?",
    beforeLabel: "Independent scalar work",
    before: ["r0 = a0 + b0", "r1 = a1 + b1", "r2 = a2 + b2", "…", "r7 = a7 + b7"],
    afterLabel: "One 8-lane vector operation",
    after: ["vr = vadd(", "  <a0, a1, …, a7>,", "  <b0, b1, …, b7>", ")"],
    explanation: "The statements have the same opcode and type, and none depends on another. SLP can pack them after legality and profitability checks.",
    effect: "8 scalar additions → 1 VALU instruction",
  },
  {
    id: "CSE + DCE",
    title: "Reuse, then delete",
    question: "Why do cleanup passes run repeatedly?",
    beforeLabel: "Repeated and unused work",
    before: ["t0 = x ^ key", "t1 = x ^ key", "dead = t1 + 0", "out = t0"],
    afterLabel: "After CSE, simplify, and DCE",
    after: ["t0 = x ^ key", "out = t0"],
    explanation: "CSE recognizes that t1 repeats t0. Simplification removes the + 0 identity, then DCE removes the value because nothing observable uses it.",
    effect: "fewer instructions · shorter dependency graph",
  },
  {
    id: "LOAD",
    title: "Safe load forwarding",
    question: "When can a memory read disappear?",
    beforeLabel: "Store followed by a proven reload",
    before: ["store(addr, new_idx)", "…  // no may-alias store", "idx = load(addr)", "use(idx)"],
    afterLabel: "Forward the known value",
    after: ["store(addr, new_idx)", "…", "use(new_idx)", "// load removed"],
    explanation: "The store and load must refer to the same normalized address, and no intervening store may overlap it. If analysis is uncertain, the load stays.",
    effect: "one load removed without changing memory behavior",
  },
  {
    id: "MAD",
    title: "Multiply-add synthesis",
    question: "How does an expression become a target instruction?",
    beforeLabel: "Two vector operations",
    before: ["tmp = vmul(va, vb)", "out = vadd(tmp, vc)"],
    afterLabel: "One fused target operation",
    after: ["out = multiply_add(", "  va, vb, vc", ")"],
    explanation: "The compiler first canonicalizes the expression, then MAD synthesis fuses it when def-use and profitability conditions make the rewrite safe.",
    effect: "2 VALU operations → 1 VALU operation",
  },
  {
    id: "SCHEDULE",
    title: "Dependency-aware bundling",
    question: "What can execute in the same cycle?",
    beforeLabel: "Ready operations and dependencies",
    before: ["A = load(addrA)", "B = load(addrB)", "C = vxor(A, B)", "i2 = add(i, 1)", "D = multiply_add(C, K, V)"],
    afterLabel: "Legal VLIW schedule",
    after: ["cycle 0  load: [A, B]", "cycle 1  valu: [vxor C]", "         alu:  [add i2]", "cycle 2  valu: [MAD D]"],
    explanation: "The two loads can share cycle 0. The independent scalar add can share cycle 1 with xor. MAD waits until a later bundle because it reads xor’s result.",
    effect: "parallel engines fill slots while RAW edges preserve order",
  },
];

export default function Home() {
  const [active, setActive] = useState(0);
  const [termFilter, setTermFilter] = useState("All");
  const [exampleActive, setExampleActive] = useState(0);
  const stage = stages[active];
  const codeExample = codeExamples[exampleActive];
  const visibleTerms = termFilter === "All" ? terms : terms.filter(item => item.category === termFilter);

  return (
    <main>
      <nav className="nav shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="AI-Comp decoded home"><span className="brand-mark">A/C</span><span>AI-COMP<br />DECODED</span></a>
        <div className="nav-links">
          <a href="#pipeline">Pipeline</a>
          <a href="#diagrams">Diagrams</a>
          <a href="#examples">Examples</a>
          <a href="#targets">Targets</a>
          <a href="#sources">Sources</a>
          <a className="source-link" href="https://github.com/fiigii/ai-comp" target="_blank" rel="noreferrer">Source ↗</a>
        </div>
      </nav>

      <section className="hero shell" id="top">
        <div className="eyebrow"><span className="pulse" /> ANTHROPIC PERFORMANCE TAKE-HOME · EXPLAINED</div>
        <h1>How a compiler<br />finds <em>parallelism.</em></h1>
        <p className="hero-copy">AI-Comp replaces hand-tuned kernel code with an optimizing compiler that turns a readable tree-traversal and hash program into tightly packed VLIW SIMD bundles.</p>
        <div className="hero-actions">
          <a className="button primary" href="#pipeline">Walk the pipeline <span>↓</span></a>
          <a className="button ghost" href="https://github.com/fiigii/ai-comp/blob/main/Readme.md" target="_blank" rel="noreferrer">Read the README ↗</a>
        </div>
        <div className="hero-grid" aria-label="Project facts">
          <div><strong>4</strong><span>compiler levels</span></div>
          <div><strong>27</strong><span>configured pass steps</span></div>
          <div><strong>8</strong><span>SIMD lanes</span></div>
          <div><strong>1</strong><span>bundle per cycle</span></div>
        </div>
      </section>

      <section className="marquee" aria-label="Optimization pass sequence"><div>{[...passes, ...passes].map((pass, i) => <span key={`${pass}-${i}`}>{pass}<b>◆</b></span>)}</div></section>

      <section className="pipeline-section shell" id="pipeline">
        <div className="section-heading">
          <div><span className="section-number">01</span><p className="label">THE COMPILER JOURNEY</p></div>
          <h2>Intent in.<br /><i>Bundles out.</i></h2>
          <p>Choose a stage to see how the same kernel changes as hardware constraints become more concrete.</p>
        </div>

        <div className="stage-tabs" role="tablist" aria-label="Compiler stages">
          {stages.map((item, index) => (
            <button key={item.id} role="tab" aria-selected={active === index} className={active === index ? "active" : ""} onClick={() => setActive(index)}>
              <span>0{index + 1}</span>{item.id}<b>{active === index ? "●" : "○"}</b>
            </button>
          ))}
        </div>

        <div className="stage-panel" role="tabpanel">
          <div className="stage-explain">
            <span className="stage-kicker">{stage.kicker}</span>
            <h3>{stage.title}</h3>
            <p>{stage.text}</p>
            <div className="chips">{stage.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
          </div>
          <div className="code-card">
            <div className="code-top"><span>{stage.id.toLowerCase()}.ir</span><span className="dots">● ● ●</span></div>
            <pre>{stage.code.map((line, i) => <div key={line}><span>{String(i + 1).padStart(2, "0")}</span>{line}</div>)}</pre>
          </div>
        </div>
      </section>

      <section className="diagram-section" id="diagrams">
        <div className="shell">
          <div className="section-heading inverse">
            <div><span className="section-number">02</span><p className="label">SYSTEM MAPS</p></div>
            <h2>See the compiler<br /><i>as a system.</i></h2>
            <p>Three diagrams connect the optimization passes to the program, the memory system, and the machine scheduler.</p>
          </div>

          <article className="flow-diagram" aria-label="Compiler pipeline and optimization groups">
            <div className="diagram-title"><span>A</span><div><b>Compilation flow</b><p>Every stage makes target constraints more explicit.</p></div></div>
            <div className="flow-track">
              <div className="flow-node input"><small>INPUT</small><b>Tree-hash kernel</b><span>loops · pointers · values</span></div>
              <i>→</i>
              <div className="flow-node hir"><small>HIR</small><b>Expose + simplify</b><span>unroll · CSE · SROA · SLP</span></div>
              <i>→</i>
              <div className="flow-node lir"><small>LIR</small><b>Lower structure</b><span>CFG · copies · phi removal</span></div>
              <i>→</i>
              <div className="flow-node mir"><small>MIR</small><b>Plan resources</b><span>DDG · schedule · regalloc</span></div>
              <i>→</i>
              <div className="flow-node output"><small>OUTPUT</small><b>VLIW bundles</b><span>legal parallel work / cycle</span></div>
            </div>
            <div className="invariant-line"><span>Invariant carried through every rewrite</span><b>same final indices + values + observable memory</b></div>
          </article>

          <div className="diagram-pair">
            <article className="memory-diagram" aria-label="Data movement from memory through scratch vectors">
              <div className="diagram-title"><span>B</span><div><b>Data movement</b><p>Why memory slots and scratch capacity matter.</p></div></div>
              <div className="memory-path">
                <div className="memory-box"><small>GLOBAL MEMORY</small><b>forest[]</b><b>indices[]</b><b>values[]</b></div>
                <div className="path-arrow"><span>2 load slots</span>→</div>
                <div className="scratch-box"><small>SCRATCH · 1,536 WORDS</small><div className="lane-row">{Array.from({length: 8}, (_, i) => <span key={i}>L{i}</span>)}</div><b>one vector = 8 contiguous words</b></div>
                <div className="path-arrow"><span>VALU</span>→</div>
                <div className="compute-box"><small>8-LANE COMPUTE</small><b>xor · add · MAD</b><span>same opcode, eight values</span></div>
              </div>
              <div className="memory-foot"><span><b>Reuse</b> keeps known values in scratch.</span><span><b>Pressure</b> rises when more values stay live.</span><span><b>Writeback</b> is limited to two store slots.</span></div>
            </article>

            <article className="dependency-diagram" aria-label="Dependency graph becoming scheduled VLIW bundles">
              <div className="diagram-title"><span>C</span><div><b>Dependency → schedule</b><p>Ready work can co-issue; consumers must wait.</p></div></div>
              <div className="dep-columns">
                <div className="dep-graph">
                  <div className="dep-row"><span className="dep-node load">load A</span><span className="dep-node load">load B</span></div>
                  <div className="dep-down">↓ RAW &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ↓ RAW</div>
                  <div className="dep-row"><span className="dep-node valu">xor₈</span><span className="dep-node alu">index + 1</span></div>
                  <div className="dep-down">↓ RAW</div>
                  <div className="dep-row"><span className="dep-node valu">MAD₈</span><span className="dep-node flow">loop test</span></div>
                </div>
                <div className="schedule-arrow">PACK<br />→</div>
                <div className="mini-schedule">
                  <div><b>C0</b><span className="load">load A · load B</span></div>
                  <div><b>C1</b><span className="valu">xor₈</span><span className="alu">index + 1</span></div>
                  <div><b>C2</b><span className="valu">MAD₈</span><span className="flow">loop test</span></div>
                </div>
              </div>
              <p className="diagram-caption">Illustrative dependency graph: colors identify engines, while cycle rows show legal co-issue—not measured AI-Comp output.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="targets-section shell" id="targets">
        <div className="section-heading">
          <div><span className="section-number">03</span><p className="label">WHAT IS ACTUALLY OPTIMIZED?</p></div>
          <h2>The answer is<br /><i>not just code size.</i></h2>
          <p>The output must produce exactly the same tree-hash result. Within that constraint, the compiler reshapes the program to execute fewer, fuller bundles.</p>
        </div>
        <div className="objective-strip">
          <div><span>FIXED</span><b>Program meaning</b><p>same indices · same values · same memory result</p></div>
          <div className="objective-arrow">→</div>
          <div><span>MINIMIZED</span><b>Executed bundles</b><p>one non-debug bundle = one VM cycle</p></div>
        </div>
        <div className="target-grid">
          {optimizationTargets.map(item => <article key={item.key} className={`target-card ${item.tone}`}><div><span>{item.key}</span><b>{item.signal}</b></div><h3>{item.title}</h3><p>{item.body}</p></article>)}
        </div>
        <div className="tradeoff-note"><b>Why the targets conflict</b><p>Unrolling exposes more parallel work but increases code size and live values. Vectorization cuts instruction count but consumes contiguous 8-word scratch ranges. Scheduling for maximum engine occupancy can lengthen live ranges. The compiler is balancing a system, not maximizing one number in isolation.</p></div>
      </section>

      <section className="techniques-section" id="techniques">
        <div className="shell">
          <div className="section-heading inverse">
            <div><span className="section-number">04</span><p className="label">THE OPTIMIZATION PLAYBOOK</p></div>
            <h2>Eight moves.<br /><i>One objective.</i></h2>
            <p>Minimize cycles without changing the tree traversal and hash result.</p>
          </div>
          <div className="technique-grid">
            {techniques.map(item => <article key={item.n}><div className="tech-meta"><span>{item.n}</span><b>{item.optimizes}</b></div><h3>{item.name}</h3><p>{item.detail}</p><small>RESULT · {item.change}</small></article>)}
          </div>
        </div>
      </section>

      <section className="examples-section shell" id="examples">
        <div className="section-heading">
          <div><span className="section-number">05</span><p className="label">CODE, BEFORE AND AFTER</p></div>
          <h2>Make the rewrite<br /><i>concrete.</i></h2>
          <p>These compact examples illustrate the transformation pattern. They use readable pseudocode rather than copying a full compiler dump.</p>
        </div>
        <div className="example-tabs" role="tablist" aria-label="Compiler code examples">
          {codeExamples.map((example, index) => <button key={example.id} role="tab" aria-selected={exampleActive === index} className={exampleActive === index ? "active" : ""} onClick={() => setExampleActive(index)}><span>0{index + 1}</span>{example.id}</button>)}
        </div>
        <article className="example-workbench" role="tabpanel">
          <div className="example-intro"><span>{codeExample.title}</span><h3>{codeExample.question}</h3><p>{codeExample.explanation}</p><div><b>Optimization effect</b><small>{codeExample.effect}</small></div></div>
          <div className="example-code">
            <div className="example-pane before"><div><span>BEFORE</span><b>{codeExample.beforeLabel}</b></div><pre>{codeExample.before.map((line, index) => <code key={`${line}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{line}</code>)}</pre></div>
            <div className="transform-arrow"><span>PASS</span>→</div>
            <div className="example-pane after"><div><span>AFTER</span><b>{codeExample.afterLabel}</b></div><pre>{codeExample.after.map((line, index) => <code key={`${line}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{line}</code>)}</pre></div>
          </div>
          <p className="example-caveat"><b>Correctness guard:</b> the compiler applies each rewrite only when its analysis proves the relevant independence, aliasing, use-count, control-flow, and bundle constraints.</p>
        </article>
      </section>

      <section className="glossary-section shell" id="glossary">
        <div className="section-heading">
          <div><span className="section-number">06</span><p className="label">TERMINOLOGY, DECODED</p></div>
          <h2>The jargon,<br /><i>in plain English.</i></h2>
          <p>Filter the glossary by compiler level, analysis concept, optimization pass, or machine term.</p>
        </div>
        <div className="term-filters" aria-label="Glossary categories">
          {["All", "IR", "Analysis", "Pass", "Machine"].map(filter => <button key={filter} className={termFilter === filter ? "active" : ""} onClick={() => setTermFilter(filter)} aria-pressed={termFilter === filter}>{filter}<span>{filter === "All" ? terms.length : terms.filter(item => item.category === filter).length}</span></button>)}
        </div>
        <div className="glossary-list">
          {visibleTerms.map((item, index) => <article key={item.term}><span className="term-index">{String(index + 1).padStart(2,"0")}</span><div><span className="term-category">{item.category}</span><h3>{item.term}</h3><b>{item.expansion}</b></div><p>{item.definition}</p></article>)}
        </div>
      </section>

      <section className="bundle-section shell">
        <div className="bundle-copy">
          <span className="section-number">07</span>
          <p className="label">WHY VLIW IS THE ENDGAME</p>
          <h2>A bundle is a<br /><i>tiny schedule.</i></h2>
          <p>Every row below is one cycle. Different engines can work together, but operations in the same bundle read the old state—so dependent instructions must wait.</p>
          <div className="rule"><b>Compiler problem</b><span>Find the widest legal grouping of ready operations.</span></div>
          <div className="bundle-rules"><p><b>RAW dependency</b> Producer and consumer need separate bundles.</p><p><b>Side effects</b> Memory ordering and barriers must stay correct.</p><p><b>Slot limits</b> A ready operation may still wait if its engine is full.</p></div>
        </div>
        <div className="bundle-visual" aria-label="Example VLIW schedule">
          <div className="bundle-head"><span>CYCLE</span><span>LOAD ×2</span><span>ALU ×12</span><span>VALU ×6</span><span>FLOW ×1</span></div>
          {[
            ["184", "vload A", "i + 1", "—", "—"],
            ["185", "gather B", "mask & 1", "A ^ key", "—"],
            ["186", "—", "2 × idx", "A × C + D", "—"],
            ["187", "vstore A", "+ parity", "hash₈(A)", "jump loop"],
          ].map(row => <div className="bundle-row" key={row[0]}>{row.map((cell, ci) => <span className={cell === "—" ? "empty" : `c${ci}`} key={`${cell}-${ci}`}>{cell}</span>)}</div>)}
          <p className="bundle-note"><span>●</span> Slots are illustrative; the final schedule is produced from the dependency graph.</p>
        </div>
      </section>

      <section className="benchmark-section" id="benchmarks">
        <div className="shell">
          <div className="section-heading inverse">
            <div><span className="section-number">08</span><p className="label">PERFORMANCE CONTEXT</p></div>
            <h2>Cycles are the<br /><i>scoreboard.</i></h2>
            <p>Anthropic publishes these reference results for the later two-hour version that started at 18,532 cycles. They provide context—not an AI-Comp result claim.</p>
          </div>
          <div className="benchmark-chart" role="img" aria-label="Published Anthropic benchmark speedups relative to the 18,532-cycle two-hour starter">
            <div className="chart-axis"><span>1×</span><span>4×</span><span>8×</span><span>12×</span><span>13.6×</span></div>
            {benchmarkLadder.map(item => (
              <div className={`benchmark-row ${item.kind ?? ""}`} key={item.label}>
                <div className="benchmark-label"><b>{item.label}</b><span>{item.cycles.toLocaleString()} cycles</span></div>
                <div className="benchmark-bar-track"><span style={{width: `${(item.speedup / 13.6) * 100}%`}}><b>{item.speedup.toFixed(item.speedup === 1 ? 1 : 2)}×</b></span></div>
              </div>
            ))}
          </div>
          <div className="benchmark-note"><b>How to read it</b><p>Lower cycle count means higher speedup. The open challenge README warns that correctness tests must remain unchanged; an invalid shortcut is not an optimization.</p><a href="https://github.com/anthropics/original_performance_takehome#performance-benchmarks" target="_blank" rel="noreferrer">Official benchmark table ↗</a></div>
        </div>
      </section>

      <section className="sources-section shell" id="sources">
        <div className="section-heading">
          <div><span className="section-number">09</span><p className="label">REVIEWED SOURCES</p></div>
          <h2>Trace every claim<br /><i>to a source.</i></h2>
          <p>Reviewed 16 July 2026. Project-specific behavior is checked against the current AI-Comp main branch; general terminology is cross-checked with official LLVM and Perfetto documentation.</p>
        </div>
        <div className="review-status"><span>✓</span><div><b>Correctness review completed</b><p>AI-Comp clone matched origin/main at review time. Default pass order, VLEN=8, scratch=1,536 words, slot limits, pre-bundle read semantics, scheduler rules, and default spill setting were checked in source.</p></div></div>
        <div className="source-list">
          {sources.map((source, index) => <a href={source.url} target="_blank" rel="noreferrer" key={source.title}><span>{String(index + 1).padStart(2, "0")}</span><div><small>{source.group}</small><h3>{source.title}</h3><p>{source.note}</p></div><b>↗</b></a>)}
        </div>
      </section>

      <section className="takeaway">
        <div className="shell takeaway-inner">
          <p className="label">THE BIG IDEA</p>
          <blockquote>Optimization is less about making one instruction faster—and more about creating enough <i>independent work</i> to keep every engine busy.</blockquote>
          <a className="button primary dark" href="https://github.com/fiigii/ai-comp" target="_blank" rel="noreferrer">Explore fiigii/ai-comp ↗</a>
        </div>
      </section>

      <footer className="shell"><div className="brand"><span className="brand-mark">A/C</span><span>AI-COMP<br />DECODED</span></div><p>An independent visual explanation based on the AI-Comp README and repository. Original work by <a href="https://github.com/fiigii" target="_blank" rel="noreferrer">fiigii</a>.</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}
