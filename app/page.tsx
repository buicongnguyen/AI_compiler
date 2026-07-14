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
  { n: "01", name: "Expose the work", detail: "Loop unrolling duplicates the hot traversal body, revealing operations from several iterations that can execute together." },
  { n: "02", name: "Delete the noise", detail: "DCE, CSE, copy propagation, constant folding, and CFG cleanup repeatedly shrink the program as new opportunities appear." },
  { n: "03", name: "Promote memory", detail: "SROA turns small aggregate and table accesses into scalar SSA values; load elimination and DSE remove redundant traffic using pointer restrictions." },
  { n: "04", name: "Make arithmetic cheaper", detail: "Strength reduction replaces costly induction expressions, while MAD synthesis recognizes multiply-plus-add shapes the vector engine supports directly." },
  { n: "05", name: "Pack eight lanes", detail: "Superword-level parallelism groups isomorphic scalar operations into the VM’s 8-lane vectors, including memory and gather patterns." },
  { n: "06", name: "Schedule the graph", detail: "A data-dependency graph decides what is ready. The scheduler prioritizes load-unblocking work, fills engine slots, and can stagger streams." },
  { n: "07", name: "Spend registers wisely", detail: "Live ranges are mapped into 1,536 scratch words. The default pipeline disables spilling, so scheduling and allocation must respect pressure." },
  { n: "08", name: "Bundle for width", detail: "Independent operations share a cycle: up to 12 scalar ALU, 6 vector ALU, 2 loads, 2 stores, and 1 flow slot." },
];

const passes = ["DCE", "UNROLL", "SIMPLIFY", "CSE", "SROA", "LOAD ELIM", "DSE", "SLSR", "SLP ×8", "MAD", "LOWER", "COPY PROP", "CFG", "PHI ELIM", "SCHEDULE", "REGALLOC", "VLIW"];

export default function Home() {
  const [active, setActive] = useState(0);
  const stage = stages[active];

  return (
    <main>
      <nav className="nav shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="AI-Comp decoded home"><span className="brand-mark">A/C</span><span>AI-COMP<br />DECODED</span></a>
        <div className="nav-links">
          <a href="#pipeline">Pipeline</a>
          <a href="#techniques">Techniques</a>
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

      <section className="techniques-section" id="techniques">
        <div className="shell">
          <div className="section-heading inverse">
            <div><span className="section-number">02</span><p className="label">THE OPTIMIZATION PLAYBOOK</p></div>
            <h2>Eight moves.<br /><i>One objective.</i></h2>
            <p>Minimize cycles without changing the tree traversal and hash result.</p>
          </div>
          <div className="technique-grid">
            {techniques.map(item => <article key={item.n}><span>{item.n}</span><h3>{item.name}</h3><p>{item.detail}</p></article>)}
          </div>
        </div>
      </section>

      <section className="bundle-section shell">
        <div className="bundle-copy">
          <span className="section-number">03</span>
          <p className="label">WHY VLIW IS THE ENDGAME</p>
          <h2>A bundle is a<br /><i>tiny schedule.</i></h2>
          <p>Every row below is one cycle. Different engines can work together, but operations in the same bundle read the old state—so dependent instructions must wait.</p>
          <div className="rule"><b>Compiler problem</b><span>Find the widest legal grouping of ready operations.</span></div>
        </div>
        <div className="bundle-visual" aria-label="Example VLIW schedule">
          <div className="bundle-head"><span>CYCLE</span><span>LOAD ×2</span><span>ALU ×12</span><span>VALU ×6</span><span>FLOW ×1</span></div>
          {[
            ["184", "vload A", "i + 1", "—", "—"],
            ["185", "gather B", "mask & 1", "A ^ key", "—"],
            ["186", "—", "2 × idx", "A × C + D", "—"],
            ["187", "vstore A", "+ parity", "hash₈(A)", "jump loop"],
          ].map((row, ri) => <div className="bundle-row" key={row[0]}>{row.map((cell, ci) => <span className={cell === "—" ? "empty" : `c${ci}`} key={`${cell}-${ci}`}>{cell}</span>)}</div>)}
          <p className="bundle-note"><span>●</span> Slots are illustrative; the final schedule is produced from the dependency graph.</p>
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
