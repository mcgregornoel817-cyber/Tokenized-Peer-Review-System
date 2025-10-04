import { describe, it, expect, beforeEach } from "vitest";
import { uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_AMOUNT = 101;
const ERR_INVALID_REVIEW_ID = 102;
const ERR_INSUFFICIENT_STAKE = 103;
const ERR_VOTING_NOT_FINALIZED = 104;
const ERR_ALREADY_CLAIMED = 105;
const ERR_NO_PENDING_REWARD = 106;
const ERR_INVALID_QUALITY_SCORE = 107;
const ERR_INVALID_REVIEWER = 108;
const ERR_SLASH_THRESHOLD_NOT_MET = 109;
const ERR_BATCH_LIMIT_EXCEEDED = 110;
const ERR_INVALID_TOKEN_CONTRACT = 111;
const ERR_INVALID_VOTING_CONTRACT = 112;
const ERR_INVALID_SUBMISSION_CONTRACT = 113;
const ERR_REVIEW_NOT_FOUND = 114;
const ERR_REVIEWER_ALREADY_STAKED = 115;
const ERR_REVIEWER_NOT_STAKED = 116;
const ERR_INVALID_PENALTY_RATE = 117;
const ERR_INVALID_REWARD_MULTIPLIER = 118;
const ERR_INVALID_MIN_STAKE = 119;
const ERR_INVALID_MAX_STAKE = 120;
const ERR_GOVERNANCE_NOT_SET = 121;
const ERR_INVALID_BATCH_SIZE = 122;
const ERR_INVALID_TIMESTAMP = 123;
const ERR_TRANSFER_FAILED = 124;

interface Result<T> {
  ok: boolean;
  value: T;
}

class RewardDistributionMock {
  state: {
    tokenContract: string;
    votingContract: string;
    submissionContract: string;
    governanceContract: string | null;
    minStakeAmount: number;
    maxStakeAmount: number;
    penaltyRate: number;
    rewardMultiplier: number;
    slashThreshold: number;
    batchLimit: number;
    totalStaked: number;
    totalRewardsDistributed: number;
    reviewerStakes: Map<string, number>;
    pendingRewards: Map<string, number>;
    claimedReviews: Map<string, number[]>;
    reviewQualityScores: Map<number, number>;
    reviewReviewers: Map<number, string>;
    slashedReviewers: Map<string, boolean>;
  } = {
    tokenContract: "ST1TEST",
    votingContract: "ST1TEST",
    submissionContract: "ST1TEST",
    governanceContract: null,
    minStakeAmount: 1000,
    maxStakeAmount: 1000000,
    penaltyRate: 20,
    rewardMultiplier: 2,
    slashThreshold: 50,
    batchLimit: 50,
    totalStaked: 0,
    totalRewardsDistributed: 0,
    reviewerStakes: new Map(),
    pendingRewards: new Map(),
    claimedReviews: new Map(),
    reviewQualityScores: new Map(),
    reviewReviewers: new Map(),
    slashedReviewers: new Map(),
  };
  caller: string = "ST1REVIEWER";
  blockHeight: number = 0;
  tokenTransfers: Array<{ amount: number; from: string; to: string }> = [];
  tokenMints: Array<{ amount: number; to: string }> = [];
  tokenBurns: Array<{ amount: number; from: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      tokenContract: "ST1TEST",
      votingContract: "ST1TEST",
      submissionContract: "ST1TEST",
      governanceContract: null,
      minStakeAmount: 1000,
      maxStakeAmount: 1000000,
      penaltyRate: 20,
      rewardMultiplier: 2,
      slashThreshold: 50,
      batchLimit: 50,
      totalStaked: 0,
      totalRewardsDistributed: 0,
      reviewerStakes: new Map(),
      pendingRewards: new Map(),
      claimedReviews: new Map(),
      reviewQualityScores: new Map(),
      reviewReviewers: new Map(),
      slashedReviewers: new Map(),
    };
    this.caller = "ST1REVIEWER";
    this.blockHeight = 0;
    this.tokenTransfers = [];
    this.tokenMints = [];
    this.tokenBurns = [];
  }

  getStake(reviewer: string): number {
    return this.state.reviewerStakes.get(reviewer) || 0;
  }

  getPendingReward(reviewer: string): number {
    return this.state.pendingRewards.get(reviewer) || 0;
  }

  getReviewQualityScore(reviewId: number): number {
    return this.state.reviewQualityScores.get(reviewId) || 0;
  }

  getTotalStaked(): number {
    return this.state.totalStaked;
  }

  getTotalRewardsDistributed(): number {
    return this.state.totalRewardsDistributed;
  }

  isSlashed(reviewer: string): boolean {
    return this.state.slashedReviewers.get(reviewer) || false;
  }

  setGovernanceContract(newContract: string): Result<boolean> {
    this.state.governanceContract = newContract;
    return { ok: true, value: true };
  }

  setMinStakeAmount(newAmount: number): Result<boolean> {
    if (!this.state.governanceContract) return { ok: false, value: ERR_GOVERNANCE_NOT_SET };
    if (newAmount <= 0 || newAmount > this.state.maxStakeAmount) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.minStakeAmount = newAmount;
    return { ok: true, value: true };
  }

  setPenaltyRate(newRate: number): Result<boolean> {
    if (!this.state.governanceContract) return { ok: false, value: ERR_GOVERNANCE_NOT_SET };
    if (newRate > 100) return { ok: false, value: ERR_INVALID_PENALTY_RATE };
    this.state.penaltyRate = newRate;
    return { ok: true, value: true };
  }

  setRewardMultiplier(newMultiplier: number): Result<boolean> {
    if (!this.state.governanceContract) return { ok: false, value: ERR_GOVERNANCE_NOT_SET };
    if (newMultiplier <= 0) return { ok: false, value: ERR_INVALID_REWARD_MULTIPLIER };
    this.state.rewardMultiplier = newMultiplier;
    return { ok: true, value: true };
  }

  setSlashThreshold(newThreshold: number): Result<boolean> {
    if (!this.state.governanceContract) return { ok: false, value: ERR_GOVERNANCE_NOT_SET };
    if (newThreshold < 0 || newThreshold > 100) return { ok: false, value: ERR_INVALID_QUALITY_SCORE };
    this.state.slashThreshold = newThreshold;
    return { ok: true, value: true };
  }

  stakeReviewer(amount: number): Result<number> {
    const currentStake = this.getStake(this.caller);
    if (amount <= 0 || amount > this.state.maxStakeAmount) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (amount < this.state.minStakeAmount) return { ok: false, value: ERR_INSUFFICIENT_STAKE };
    if (currentStake > 0) return { ok: false, value: ERR_REVIEWER_ALREADY_STAKED };
    this.tokenTransfers.push({ amount, from: this.caller, to: "contract" });
    this.state.reviewerStakes.set(this.caller, amount);
    this.state.totalStaked += amount;
    return { ok: true, value: amount };
  }

  unstakeReviewer(): Result<number> {
    const stake = this.getStake(this.caller);
    if (stake <= 0) return { ok: false, value: ERR_REVIEWER_NOT_STAKED };
    if (this.isSlashed(this.caller)) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.tokenTransfers.push({ amount: stake, from: "contract", to: this.caller });
    this.state.reviewerStakes.delete(this.caller);
    this.state.totalStaked -= stake;
    return { ok: true, value: stake };
  }

  claimReward(reviewId: number): Result<number> {
    if (reviewId <= 0) return { ok: false, value: ERR_INVALID_REVIEW_ID };
    const reviewer = this.state.reviewReviewers.get(reviewId);
    if (!reviewer || reviewer !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const score = this.getReviewQualityScore(reviewId);
    if (score < 0 || score > 100) return { ok: false, value: ERR_INVALID_QUALITY_SCORE };
    const claimed = this.state.claimedReviews.get(reviewer) || [];
    if (claimed.includes(reviewId)) return { ok: false, value: ERR_ALREADY_CLAIMED };
    const baseReward = score * this.state.rewardMultiplier;
    let currentPending = this.getPendingReward(reviewer);
    if (score < this.state.slashThreshold) {
      const stake = this.getStake(reviewer);
      const penalty = stake * (this.state.penaltyRate / 100);
      this.tokenBurns.push({ amount: penalty, from: "contract" });
      this.state.reviewerStakes.set(reviewer, stake - penalty);
      this.state.slashedReviewers.set(reviewer, true);
      this.state.totalStaked -= penalty;
      return { ok: true, value: 0 };
    } else {
      this.tokenMints.push({ amount: baseReward, to: reviewer });
      currentPending += baseReward;
      this.state.pendingRewards.set(reviewer, currentPending);
      this.state.totalRewardsDistributed += baseReward;
    }
    claimed.push(reviewId);
    this.state.claimedReviews.set(reviewer, claimed);
    return { ok: true, value: baseReward };
  }

  distributeBatch(reviewIds: number[]): Result<number> {
    if (reviewIds.length > this.state.batchLimit) return { ok: false, value: ERR_BATCH_LIMIT_EXCEEDED };
    let total = 0;
    for (const id of reviewIds) {
      const res = this.claimReward(id);
      if (res.ok) total += res.value as number;
    }
    return { ok: true, value: total };
  }
}

describe("RewardDistribution", () => {
  let contract: RewardDistributionMock;

  beforeEach(() => {
    contract = new RewardDistributionMock();
    contract.reset();
  });

  it("stakes reviewer successfully", () => {
    const result = contract.stakeReviewer(2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2000);
    expect(contract.getStake("ST1REVIEWER")).toBe(2000);
    expect(contract.getTotalStaked()).toBe(2000);
    expect(contract.tokenTransfers).toEqual([{ amount: 2000, from: "ST1REVIEWER", to: "contract" }]);
  });

  it("rejects stake below min amount", () => {
    const result = contract.stakeReviewer(500);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_STAKE);
  });

  it("rejects duplicate stake", () => {
    contract.stakeReviewer(2000);
    const result = contract.stakeReviewer(3000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REVIEWER_ALREADY_STAKED);
  });

  it("unstakes reviewer successfully", () => {
    contract.stakeReviewer(2000);
    const result = contract.unstakeReviewer();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2000);
    expect(contract.getStake("ST1REVIEWER")).toBe(0);
    expect(contract.getTotalStaked()).toBe(0);
    expect(contract.tokenTransfers[1]).toEqual({ amount: 2000, from: "contract", to: "ST1REVIEWER" });
  });

  it("rejects unstake if not staked", () => {
    const result = contract.unstakeReviewer();
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REVIEWER_NOT_STAKED);
  });

  it("claims reward successfully", () => {
    contract.state.reviewReviewers.set(1, "ST1REVIEWER");
    contract.state.reviewQualityScores.set(1, 80);
    const result = contract.claimReward(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(160);
    expect(contract.getPendingReward("ST1REVIEWER")).toBe(160);
    expect(contract.getTotalRewardsDistributed()).toBe(160);
    expect(contract.tokenMints).toEqual([{ amount: 160, to: "ST1REVIEWER" }]);
    expect(contract.state.claimedReviews.get("ST1REVIEWER")).toEqual([1]);
  });

  it("slashes stake for low score", () => {
    contract.stakeReviewer(2000);
    contract.state.reviewReviewers.set(1, "ST1REVIEWER");
    contract.state.reviewQualityScores.set(1, 40);
    const result = contract.claimReward(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    expect(contract.getStake("ST1REVIEWER")).toBe(1600);
    expect(contract.isSlashed("ST1REVIEWER")).toBe(true);
    expect(contract.getTotalStaked()).toBe(1600);
    expect(contract.tokenBurns).toEqual([{ amount: 400, from: "contract" }]);
  });

  it("rejects claim for invalid reviewer", () => {
    contract.state.reviewReviewers.set(1, "ST2OTHER");
    contract.state.reviewQualityScores.set(1, 80);
    const result = contract.claimReward(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects duplicate claim", () => {
    contract.state.reviewReviewers.set(1, "ST1REVIEWER");
    contract.state.reviewQualityScores.set(1, 80);
    contract.claimReward(1);
    const result = contract.claimReward(1);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ALREADY_CLAIMED);
  });

  it("distributes batch successfully", () => {
    contract.state.reviewReviewers.set(1, "ST1REVIEWER");
    contract.state.reviewQualityScores.set(1, 80);
    contract.state.reviewReviewers.set(2, "ST1REVIEWER");
    contract.state.reviewQualityScores.set(2, 90);
    const result = contract.distributeBatch([1, 2]);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(340);
    expect(contract.getPendingReward("ST1REVIEWER")).toBe(340);
    expect(contract.getTotalRewardsDistributed()).toBe(340);
    expect(contract.tokenMints.length).toBe(2);
  });

  it("rejects batch exceeding limit", () => {
    const ids = Array.from({ length: 51 }, (_, i) => i + 1);
    const result = contract.distributeBatch(ids);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BATCH_LIMIT_EXCEEDED);
  });

  it("sets penalty rate successfully", () => {
    contract.setGovernanceContract("STGOV");
    const result = contract.setPenaltyRate(30);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.penaltyRate).toBe(30);
  });

  it("rejects penalty rate without governance", () => {
    const result = contract.setPenaltyRate(30);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_GOVERNANCE_NOT_SET);
  });

  it("sets reward multiplier successfully", () => {
    contract.setGovernanceContract("STGOV");
    const result = contract.setRewardMultiplier(3);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.rewardMultiplier).toBe(3);
  });

  it("rejects invalid reward multiplier", () => {
    contract.setGovernanceContract("STGOV");
    const result = contract.setRewardMultiplier(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_REWARD_MULTIPLIER);
  });

  it("sets slash threshold successfully", () => {
    contract.setGovernanceContract("STGOV");
    const result = contract.setSlashThreshold(60);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.slashThreshold).toBe(60);
  });

  it("rejects invalid slash threshold", () => {
    contract.setGovernanceContract("STGOV");
    const result = contract.setSlashThreshold(101);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_QUALITY_SCORE);
  });
});