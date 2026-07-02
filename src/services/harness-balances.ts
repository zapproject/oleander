import type { HarnessEvent, SettlementAsset } from "./harness-events.js";

export interface HarnessBalanceAccount {
  readonly accountId: string;
  readonly asset: SettlementAsset;
  readonly pendingAtomic: string;
  readonly settledAtomic: string;
  readonly balanceAtomic: string;
  readonly claimIds: ReadonlyArray<string>;
}

export interface HarnessBalanceState {
  readonly asset: SettlementAsset;
  readonly sponsorFundedAtomic: string;
  readonly availableBudgetAtomic: string;
  readonly committedPayoutAtomic: string;
  readonly unpaidPayoutAtomic: string;
  readonly paidPayoutAtomic: string;
  readonly accounts: Record<string, HarnessBalanceAccount>;
}

interface MutableAccount {
  accountId: string;
  asset: SettlementAsset;
  pendingAtomic: bigint;
  settledAtomic: bigint;
  balanceAtomic: bigint;
  claimIds: Set<string>;
}

const getAccount = (accounts: Map<string, MutableAccount>, accountId: string): MutableAccount => {
  const existing = accounts.get(accountId);
  if (existing) return existing;
  const created = {
    accountId,
    asset: "OUSD" as const,
    pendingAtomic: 0n,
    settledAtomic: 0n,
    balanceAtomic: 0n,
    claimIds: new Set<string>()
  };
  accounts.set(accountId, created);
  return created;
};

const toState = (input: {
  readonly sponsorFundedAtomic: bigint;
  readonly committedPayoutAtomic: bigint;
  readonly paidPayoutAtomic: bigint;
  readonly accounts: Map<string, MutableAccount>;
}): HarnessBalanceState => {
  const accounts = [...input.accounts.values()]
    .sort((left, right) => left.accountId.localeCompare(right.accountId))
    .reduce<Record<string, HarnessBalanceAccount>>((result, account) => {
      result[account.accountId] = {
        accountId: account.accountId,
        asset: account.asset,
        pendingAtomic: account.pendingAtomic.toString(),
        settledAtomic: account.settledAtomic.toString(),
        balanceAtomic: account.balanceAtomic.toString(),
        claimIds: [...account.claimIds].sort()
      };
      return result;
    }, {});

  return {
    asset: "OUSD",
    sponsorFundedAtomic: input.sponsorFundedAtomic.toString(),
    availableBudgetAtomic: (input.sponsorFundedAtomic - input.committedPayoutAtomic).toString(),
    committedPayoutAtomic: input.committedPayoutAtomic.toString(),
    unpaidPayoutAtomic: (input.committedPayoutAtomic - input.paidPayoutAtomic).toString(),
    paidPayoutAtomic: input.paidPayoutAtomic.toString(),
    accounts
  };
};

export const reduceHarnessBalances = (events: ReadonlyArray<HarnessEvent>): HarnessBalanceState => {
  const accounts = new Map<string, MutableAccount>();
  const seenEventIds = new Set<string>();
  const seenReceiptIds = new Set<string>();
  let sponsorFundedAtomic = 0n;
  let committedPayoutAtomic = 0n;
  let paidPayoutAtomic = 0n;

  for (const event of events) {
    if (seenEventIds.has(event.eventId)) continue;
    seenEventIds.add(event.eventId);

    if (event.type === "work_receipt_created") {
      if (seenReceiptIds.has(event.workReceiptId)) continue;
      seenReceiptIds.add(event.workReceiptId);

      const amount = BigInt(event.amountAtomic);
      committedPayoutAtomic += amount;
      const account = getAccount(accounts, event.nodeId);
      account.pendingAtomic += amount;
      account.claimIds.add(event.claimId);
      continue;
    }

    if (event.type !== "balance_changed") continue;

    const delta = BigInt(event.deltaAtomic);
    const account = getAccount(accounts, event.accountId);
    account.balanceAtomic = BigInt(event.balanceAtomic);
    if (event.claimId) account.claimIds.add(event.claimId);

    if (event.reason === "sponsor_funded") {
      sponsorFundedAtomic += delta;
      continue;
    }

    if (event.reason === "work_receipt") {
      paidPayoutAtomic += delta;
      account.pendingAtomic -= delta;
      if (account.pendingAtomic < 0n) account.pendingAtomic = 0n;
      account.settledAtomic += delta;
    }
  }

  return toState({ sponsorFundedAtomic, committedPayoutAtomic, paidPayoutAtomic, accounts });
};
