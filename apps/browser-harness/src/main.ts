import * as d3 from "d3";
import claimsJson from "../../../claims/x402-fifty-claims.json";
import "./styles.css";

type ClaimKind = "yes_no" | "hash_attestation";
type ClaimDomain = "stablecoins" | "availability";
type ClaimStatus = "pending" | "observed";
type NodeType = "sponsor" | "x402" | "feed" | "claim" | "oracle" | "receipt" | "gossip";
type RegimeId = "full" | "sponsor" | "availability" | "attestation" | "peg" | "stablecoins";

interface ClaimSpec {
  readonly id: string;
  readonly kind: ClaimKind;
  readonly domain: ClaimDomain;
  readonly statement: string;
  readonly sources: string[];
  readonly livenessSeconds: number;
}

interface GraphNode extends d3.SimulationNodeDatum {
  readonly id: string;
  readonly label: string;
  readonly type: NodeType;
  readonly claim?: ClaimSpec;
  status?: ClaimStatus;
  radius: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  readonly id: string;
  readonly source: string | GraphNode;
  readonly target: string | GraphNode;
  active?: boolean;
}

interface OracleStats {
  readonly nodeId: string;
  claimIds: string[];
  observations: number;
  usdcAtomic: bigint;
  zapAtomic: bigint;
}

interface EventItem {
  readonly tick: number;
  readonly label: string;
}

interface Regime {
  readonly id: RegimeId;
  readonly label: string;
  readonly predicate: (claim: ClaimSpec) => boolean;
}

const claims = (claimsJson as ClaimSpec[]).map((claim) => ({ ...claim }));
const bountyAtomic = 1_000_000n;
const zapAtomic = 1_000_000_000_000_000_000n;

const regimes: Regime[] = [
  { id: "full", label: "Full Network", predicate: () => true },
  { id: "sponsor", label: "Sponsor Gate", predicate: () => false },
  { id: "availability", label: "Availability Oracles", predicate: (claim) => claim.domain === "availability" },
  {
    id: "attestation",
    label: "Attestation Oracles",
    predicate: (claim) => claim.domain === "stablecoins" && claim.kind === "hash_attestation"
  },
  {
    id: "peg",
    label: "Peg Oracles",
    predicate: (claim) => claim.domain === "stablecoins" && claim.kind === "yes_no"
  },
  { id: "stablecoins", label: "Stablecoin Oracles", predicate: (claim) => claim.domain === "stablecoins" }
];

let activeRegime = regimes[0]!;
let runIndex = 0;
let running = false;
let timer: number | undefined;
let verbose = false;
let selectedNodeId = "sponsor";
let activeIndex = 0;
let activeClaims = claims.filter(activeRegime.predicate);
let events: EventItem[] = [];
let verboseLines: string[] = [];

const oracleStats: Record<string, OracleStats> = {
  "witness-availability": { nodeId: "witness-availability", claimIds: [], observations: 0, usdcAtomic: 0n, zapAtomic: 0n },
  "witness-attestation": { nodeId: "witness-attestation", claimIds: [], observations: 0, usdcAtomic: 0n, zapAtomic: 0n },
  "witness-peg": { nodeId: "witness-peg", claimIds: [], observations: 0, usdcAtomic: 0n, zapAtomic: 0n }
};

const nodeById = new Map<string, GraphNode>();
const linkById = new Map<string, GraphLink>();

const el = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
};

const svg = d3.select<SVGSVGElement, unknown>("#network-graph");
const graphShell = document.querySelector<HTMLElement>(".graph-shell");
if (!graphShell) throw new Error("Missing graph shell");

const colorFor = (node: GraphNode): string => {
  if (node.type === "sponsor") return "#f7c948";
  if (node.type === "x402") return "#ff8f5f";
  if (node.type === "feed") return "#46c2ff";
  if (node.type === "oracle") return "#58d68d";
  if (node.type === "receipt") return "#b98cff";
  if (node.type === "gossip") return "#9ba99d";
  if (node.claim?.domain === "availability") return "#58d68d";
  if (node.claim?.kind === "hash_attestation") return "#b98cff";
  return "#46c2ff";
};

const oracleForClaim = (claim: ClaimSpec): string => {
  if (claim.domain === "availability") return "witness-availability";
  if (claim.kind === "hash_attestation") return "witness-attestation";
  return "witness-peg";
};

const claimCategory = (claim: ClaimSpec): "peg" | "attestation" | "availability" => {
  if (claim.domain === "availability") return "availability";
  if (claim.kind === "hash_attestation") return "attestation";
  return "peg";
};

const shortClaimId = (id: string): string => id.replace("claim:x402:50:", "");

const buildGraph = () => {
  const nodes: GraphNode[] = [
    { id: "sponsor", label: "Sponsor", type: "sponsor", radius: 18 },
    { id: "facilitator", label: "x402 Facilitator", type: "x402", radius: 16 },
    { id: "resource", label: "Paid Resource", type: "x402", radius: 16 },
    { id: "feed", label: "Claim Feed", type: "feed", radius: 15 },
    { id: "witness-availability", label: "Availability Oracle", type: "oracle", radius: 17 },
    { id: "witness-attestation", label: "Attestation Oracle", type: "oracle", radius: 17 },
    { id: "witness-peg", label: "Peg Oracle", type: "oracle", radius: 17 },
    { id: "receipts", label: "Receipts", type: "receipt", radius: 15 },
    { id: "gossip", label: "CRDT Gossip", type: "gossip", radius: 15 }
  ];

  for (const claim of claims) {
    nodes.push({
      id: claim.id,
      label: shortClaimId(claim.id),
      type: "claim",
      claim,
      status: "pending",
      radius: claim.domain === "availability" ? 7 : 6
    });
  }

  const links: GraphLink[] = [
    { id: "sponsor-facilitator", source: "sponsor", target: "facilitator" },
    { id: "facilitator-resource", source: "facilitator", target: "resource" },
    { id: "resource-feed", source: "resource", target: "feed" },
    { id: "availability-receipts", source: "witness-availability", target: "receipts" },
    { id: "attestation-receipts", source: "witness-attestation", target: "receipts" },
    { id: "peg-receipts", source: "witness-peg", target: "receipts" },
    { id: "availability-gossip", source: "witness-availability", target: "gossip" },
    { id: "attestation-gossip", source: "witness-attestation", target: "gossip" },
    { id: "peg-gossip", source: "witness-peg", target: "gossip" }
  ];

  for (const claim of claims) {
    links.push({ id: `feed-${claim.id}`, source: "feed", target: claim.id });
    links.push({ id: `${claim.id}-${oracleForClaim(claim)}`, source: claim.id, target: oracleForClaim(claim) });
  }

  return { nodes, links };
};

const { nodes, links } = buildGraph();
for (const node of nodes) nodeById.set(node.id, node);
for (const link of links) linkById.set(link.id, link);

const simulation = d3.forceSimulation<GraphNode>(nodes)
  .force("link", d3.forceLink<GraphNode, GraphLink>(links).id((node) => node.id).distance((link) => {
    const source = typeof link.source === "string" ? link.source : link.source.id;
    if (source === "feed") return 92;
    return 118;
  }).strength(0.18))
  .force("charge", d3.forceManyBody().strength(-190))
  .force("collide", d3.forceCollide<GraphNode>().radius((node) => node.radius + 7))
  .force("center", d3.forceCenter(400, 300));

const linkLayer = svg.append("g").attr("class", "links");
const nodeLayer = svg.append("g").attr("class", "nodes");
const labelLayer = svg.append("g").attr("class", "labels");

const linkSelection = linkLayer
  .selectAll<SVGLineElement, GraphLink>("line")
  .data(links)
  .join("line")
  .attr("class", "link");

const nodeSelection = nodeLayer
  .selectAll<SVGCircleElement, GraphNode>("circle")
  .data(nodes)
  .join("circle")
  .attr("class", "graph-node")
  .attr("r", (node) => node.radius)
  .attr("fill", colorFor)
  .on("click", (_, node) => {
    selectedNodeId = node.id;
    renderAll();
  })
  .call(
    d3.drag<SVGCircleElement, GraphNode>()
      .on("start", (event, node) => {
        if (!event.active) simulation.alphaTarget(0.2).restart();
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", (event, node) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on("end", (event, node) => {
        if (!event.active) simulation.alphaTarget(0);
        if (node.type === "claim") {
          node.fx = null;
          node.fy = null;
        }
      })
  );

const labelSelection = labelLayer
  .selectAll<SVGTextElement, GraphNode>("text")
  .data(nodes.filter((node) => node.type !== "claim"))
  .join("text")
  .attr("class", "node-label")
  .attr("text-anchor", "middle")
  .text((node) => node.label);

const resizeGraph = () => {
  const rect = graphShell.getBoundingClientRect();
  svg.attr("viewBox", `0 0 ${rect.width} ${rect.height}`);
  simulation.force("center", d3.forceCenter(rect.width / 2, rect.height / 2));
  const anchors: Record<string, [number, number]> = {
    sponsor: [rect.width * 0.13, rect.height * 0.25],
    facilitator: [rect.width * 0.31, rect.height * 0.23],
    resource: [rect.width * 0.46, rect.height * 0.27],
    feed: [rect.width * 0.52, rect.height * 0.48],
    "witness-peg": [rect.width * 0.72, rect.height * 0.27],
    "witness-attestation": [rect.width * 0.78, rect.height * 0.53],
    "witness-availability": [rect.width * 0.67, rect.height * 0.75],
    receipts: [rect.width * 0.91, rect.height * 0.39],
    gossip: [rect.width * 0.88, rect.height * 0.73]
  };
  for (const [id, [fx, fy]] of Object.entries(anchors)) {
    const node = nodeById.get(id);
    if (node) {
      node.fx = fx;
      node.fy = fy;
    }
  }
  simulation.alpha(0.55).restart();
};

simulation.on("tick", () => {
  linkSelection
    .attr("x1", (link) => (link.source as GraphNode).x ?? 0)
    .attr("y1", (link) => (link.source as GraphNode).y ?? 0)
    .attr("x2", (link) => (link.target as GraphNode).x ?? 0)
    .attr("y2", (link) => (link.target as GraphNode).y ?? 0);

  nodeSelection
    .attr("cx", (node) => node.x ?? 0)
    .attr("cy", (node) => node.y ?? 0);

  labelSelection
    .attr("x", (node) => node.x ?? 0)
    .attr("y", (node) => ((node.y ?? 0) + node.radius + 15));
});

window.addEventListener("resize", resizeGraph);

const resetRun = () => {
  running = false;
  window.clearInterval(timer);
  activeIndex = 0;
  activeClaims = claims.filter(activeRegime.predicate);
  events = [];
  verboseLines = [];
  for (const node of nodes) {
    if (node.type === "claim") node.status = "pending";
  }
  for (const link of links) link.active = false;
  for (const stat of Object.values(oracleStats)) {
    stat.claimIds = [];
    stat.observations = 0;
    stat.usdcAtomic = 0n;
    stat.zapAtomic = 0n;
  }
  renderAll();
};

const addEvent = (label: string) => {
  events.unshift({ tick: events.length + 1, label });
  events = events.slice(0, 18);
};

const addVerboseReceipt = (claim: ClaimSpec, oracle: string) => {
  const receipt = {
    type: "x402_oracle_work",
    sponsor: "sponsor:x402:mock",
    oracle,
    claimId: claim.id,
    workReceipt: `work:${claim.id}:${oracle}`,
    stablecoinBounty: {
      stablecoin: "USDC",
      amountAtomic: bountyAtomic.toString(),
      payoutAddress: `mock-wallet:${oracle}`
    },
    zapReward: {
      zapAmountAtomic: zapAtomic.toString(),
      reason: "observation"
    }
  };
  verboseLines.unshift(JSON.stringify(receipt, null, 2));
  verboseLines = verboseLines.slice(0, 8);
};

const stepRun = () => {
  if (activeIndex >= activeClaims.length) {
    running = false;
    window.clearInterval(timer);
    addEvent("Run settled and cleanup completed");
    renderAll();
    return;
  }

  const claim = activeClaims[activeIndex]!;
  const oracle = oracleForClaim(claim);
  const node = nodeById.get(claim.id);
  if (node) node.status = "observed";

  const feedLink = linkById.get(`feed-${claim.id}`);
  const oracleLink = linkById.get(`${claim.id}-${oracle}`);
  if (feedLink) feedLink.active = true;
  if (oracleLink) oracleLink.active = true;

  const stat = oracleStats[oracle]!;
  stat.claimIds.push(claim.id);
  stat.observations += 1;
  stat.usdcAtomic += bountyAtomic;
  stat.zapAtomic += zapAtomic;

  addEvent(`${oracle} observed ${shortClaimId(claim.id)}`);
  addVerboseReceipt(claim, oracle);
  activeIndex += 1;
  renderAll();
};

const run = () => {
  if (running) return;
  if (activeIndex >= activeClaims.length) resetRun();
  runIndex += 1;
  running = true;
  addEvent(`Run ${runIndex} started: ${activeRegime.label}`);
  timer = window.setInterval(stepRun, 180);
  stepRun();
};

const pause = () => {
  running = false;
  window.clearInterval(timer);
  addEvent("Run paused");
  renderAll();
};

const counts = () => {
  const selected = activeClaims;
  const observed = selected.filter((claim) => nodeById.get(claim.id)?.status === "observed");
  const byCategory = (category: ReturnType<typeof claimCategory>) =>
    observed.filter((claim) => claimCategory(claim) === category).length;
  const totalsByCategory = (category: ReturnType<typeof claimCategory>) =>
    selected.filter((claim) => claimCategory(claim) === category).length;
  return { selected, observed, byCategory, totalsByCategory };
};

const renderMetrics = () => {
  const totalObserved = Object.values(oracleStats).reduce((sum, stat) => sum + stat.observations, 0);
  const totalUsdc = Object.values(oracleStats).reduce((sum, stat) => sum + stat.usdcAtomic, 0n);
  const totalZap = Object.values(oracleStats).reduce((sum, stat) => sum + stat.zapAtomic, 0n);
  el("metric-claims").textContent = String(activeClaims.length);
  el("metric-observed").textContent = String(totalObserved);
  el("metric-usdc").textContent = totalUsdc.toString();
  el("metric-zap").textContent = totalZap.toString();
  el("metric-regime").textContent = activeRegime.label;
};

const renderRegimes = () => {
  const container = el("regime-list");
  container.replaceChildren();
  for (const regime of regimes) {
    const button = document.createElement("button");
    button.className = `regime-button${regime.id === activeRegime.id ? " active" : ""}`;
    button.textContent = regime.label;
    button.addEventListener("click", () => {
      activeRegime = regime;
      resetRun();
    });
    container.appendChild(button);
  }
};

const renderClaims = () => {
  const { selected, observed, byCategory, totalsByCategory } = counts();
  el("claim-count-label").textContent = `${observed.length} / ${selected.length}`;
  const setBar = (id: string, done: number, total: number) => {
    el<HTMLElement>(id).style.width = `${total === 0 ? 0 : Math.round((done / total) * 100)}%`;
  };
  setBar("bar-peg", byCategory("peg"), totalsByCategory("peg"));
  setBar("bar-attestation", byCategory("attestation"), totalsByCategory("attestation"));
  setBar("bar-availability", byCategory("availability"), totalsByCategory("availability"));

  const container = el("claim-list");
  container.replaceChildren();
  for (const claim of selected.slice(0, 18)) {
    const row = document.createElement("button");
    const status = nodeById.get(claim.id)?.status;
    row.className = `claim-row${status === "observed" ? " observed" : ""}`;
    row.innerHTML = `<strong>${shortClaimId(claim.id)}</strong><span>${claim.domain} / ${claim.kind}</span>`;
    row.addEventListener("click", () => {
      selectedNodeId = claim.id;
      renderAll();
    });
    container.appendChild(row);
  }
}

const renderSelected = () => {
  const node = nodeById.get(selectedNodeId) ?? nodeById.get("sponsor")!;
  const container = el("selected-node");
  const detail = node.claim
    ? `<strong>${shortClaimId(node.claim.id)}</strong><p>${node.claim.statement}</p><p>${node.claim.domain} / ${node.claim.kind} / ${node.status}</p>`
    : `<strong>${node.label}</strong><p>${node.type}</p><p>${node.id}</p>`;
  container.innerHTML = detail;
};

const renderReceipts = () => {
  const container = el("receipt-list");
  container.replaceChildren();
  for (const stat of Object.values(oracleStats)) {
    const row = document.createElement("div");
    row.className = "receipt-row";
    row.innerHTML = `<strong>${stat.nodeId}</strong><span>${stat.observations} obs</span><span>${stat.usdcAtomic.toString()} USDC atomic</span><span>${stat.zapAtomic.toString()} ZAP atomic</span>`;
    container.appendChild(row);
  }
};

const renderEvents = () => {
  const container = el("event-list");
  container.replaceChildren();
  for (const event of events.slice(0, 12)) {
    const row = document.createElement("div");
    row.className = "event-row";
    row.innerHTML = `<span>#${event.tick}</span><strong>${event.label}</strong>`;
    container.appendChild(row);
  }
};

const renderVerbose = () => {
  const panel = el<HTMLElement>("verbose-panel");
  panel.hidden = !verbose;
  el("verbose-button").setAttribute("aria-pressed", String(verbose));
  el("verbose-button").classList.toggle("active", verbose);
  el("verbose-output").textContent = verboseLines.join("\n\n");
};

const renderGraphState = () => {
  nodeSelection
    .classed("observed", (node) => node.status === "observed")
    .attr("opacity", (node) => {
      if (node.type !== "claim") return 1;
      return activeClaims.includes(node.claim!) ? 1 : 0.18;
    });
  linkSelection
    .classed("active", (link) => Boolean(link.active))
    .attr("opacity", (link) => {
      const sourceId = typeof link.source === "string" ? link.source : link.source.id;
      const targetId = typeof link.target === "string" ? link.target : link.target.id;
      const claimId = sourceId.startsWith("claim:") ? sourceId : targetId.startsWith("claim:") ? targetId : undefined;
      if (!claimId) return 0.75;
      const claim = nodeById.get(claimId)?.claim;
      return claim && activeClaims.includes(claim) ? 0.72 : 0.08;
    });
};

const renderAll = () => {
  renderMetrics();
  renderRegimes();
  renderClaims();
  renderSelected();
  renderReceipts();
  renderEvents();
  renderVerbose();
  renderGraphState();
};

el("run-button").addEventListener("click", run);
el("pause-button").addEventListener("click", pause);
el("reset-button").addEventListener("click", resetRun);
el("verbose-button").addEventListener("click", () => {
  verbose = !verbose;
  renderAll();
});

resizeGraph();
resetRun();
