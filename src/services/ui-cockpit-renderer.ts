import type { UiCockpitClaimState, UiCockpitState, UiCockpitWitnessState } from "./ui-cockpit-state.js";

const truncate = (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;

const responseLabel = (claim: UiCockpitClaimState): string => {
  if (claim.settlement) return claim.settlement.response.type;
  if (claim.proposal) return claim.proposal.response.type;
  return "none";
};

const renderClaim = (claim: UiCockpitClaimState): string => {
  const proposal = claim.proposal ? ` proposal=${responseLabel(claim)} expires=${claim.proposal.expiresAt}` : "";
  const dispute = claim.disputeReason ? ` dispute=${claim.disputeReason}` : "";
  return `- ${claim.id} [${claim.domain}/${claim.kind}] status=${claim.status}${proposal}${dispute}\n  ${truncate(claim.statement, 120)}`;
};

const renderWitness = (witness: UiCockpitWitnessState): string =>
  [
    `- ${witness.nodeId}`,
    `role=${witness.witnessRole ?? "unknown"}`,
    `status=${witness.status}`,
    `claim=${witness.activeClaimId ?? "none"}`,
    `observations=${witness.observationCount}`,
    `earned=${witness.earnedAtomic} OUSD`
  ].join(" ");

export const renderUiCockpit = (state: UiCockpitState): string => {
  const lines: string[] = [];
  lines.push("OLEANDER NETWORK COCKPIT");
  lines.push(`Run: ${state.runId ?? "none"} [${state.runStatus}]`);
  if (state.error) lines.push(`Error: ${state.error}`);
  lines.push(
    [
      `Claims: ${state.claimOrder.length}`,
      `Witnesses: ${state.witnessOrder.length}`,
      `OUSD funded: ${state.balances.sponsorFundedAtomic}`,
      `OUSD available: ${state.balances.availableBudgetAtomic}`,
      `OUSD committed: ${state.balances.committedPayoutAtomic}`,
      `OUSD unpaid: ${state.balances.unpaidPayoutAtomic}`,
      `OUSD paid: ${state.balances.paidPayoutAtomic}`
    ].join(" | ")
  );

  lines.push("");
  lines.push("Claims");
  if (state.claimOrder.length === 0) {
    lines.push("- none");
  } else {
    for (const claimId of state.claimOrder.slice(0, 12)) {
      const claim = state.claims[claimId];
      if (claim) lines.push(renderClaim(claim));
    }
    if (state.claimOrder.length > 12) lines.push(`- ... ${state.claimOrder.length - 12} more claims`);
  }

  lines.push("");
  lines.push("Witnesses");
  if (state.witnessOrder.length === 0) {
    lines.push("- none");
  } else {
    for (const nodeId of state.witnessOrder.slice(0, 12)) {
      const witness = state.witnesses[nodeId];
      if (witness) lines.push(renderWitness(witness));
    }
    if (state.witnessOrder.length > 12) lines.push(`- ... ${state.witnessOrder.length - 12} more witnesses`);
  }

  lines.push("");
  lines.push("Balances");
  const accounts = Object.values(state.balances.accounts);
  if (accounts.length === 0) {
    lines.push("- none");
  } else {
    for (const account of accounts.slice(0, 12)) {
      lines.push(
        `- ${account.accountId} balance=${account.balanceAtomic} OUSD pending=${account.pendingAtomic} settled=${account.settledAtomic}`
      );
    }
    if (accounts.length > 12) lines.push(`- ... ${accounts.length - 12} more accounts`);
  }

  lines.push("");
  lines.push("Event Log");
  if (state.eventLog.length === 0) {
    lines.push("- none");
  } else {
    for (const entry of state.eventLog.slice(-12)) {
      lines.push(`- ${entry.label}`);
    }
  }

  return `${lines.join("\n")}\n`;
};
