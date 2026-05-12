/**
 * ComplianceRegistry.test.ts
 *
 * TESTING PHILOSOPHY:
 *   Good smart contract tests follow three categories:
 *   1. Happy path   — does it work when used correctly?
 *   2. Edge cases   — what happens at boundaries?
 *   3. Failure modes — does it revert when it should?
 *
 * We use Hardhat's `loadFixture` pattern:
 *   • A fixture deploys contracts once and snapshots blockchain state
 *   • Each test restores that snapshot — clean slate, no shared state
 *   • Far faster than redeploying contracts per test
 *
 * RUNNING TESTS:
 *   npm test                     (all tests)
 *   npx hardhat test --grep "batch"  (filter by name)
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import type { ComplianceRegistry } from "../typechain-types";

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE
// ─────────────────────────────────────────────────────────────────────────────

async function deployRegistryFixture() {
  // Hardhat gives us 20 pre-funded test accounts.
  // Destructuring lets us name them for readability.
  const [owner, user1, user2, user3, attacker] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("ComplianceRegistry");
  const registry: ComplianceRegistry = await Factory.deploy();

  return { registry, owner, user1, user2, user3, attacker };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe("ComplianceRegistry", function () {

  // ── Deployment ────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("sets the deployer as owner", async function () {
      const { registry, owner } = await loadFixture(deployRegistryFixture);
      // owner() comes from OpenZeppelin Ownable
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("starts with zero approved addresses", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);
      expect(await registry.totalApproved()).to.equal(0);
    });

    it("starts with every address unapproved", async function () {
      const { registry, user1 } = await loadFixture(deployRegistryFixture);
      expect(await registry.isApproved(user1.address)).to.equal(false);
    });
  });

  // ── approveAddress ────────────────────────────────────────────────────────

  describe("approveAddress", function () {
    it("owner can approve an address", async function () {
      const { registry, user1 } = await loadFixture(deployRegistryFixture);
      await registry.approveAddress(user1.address);
      expect(await registry.isApproved(user1.address)).to.equal(true);
    });

    it("increments totalApproved", async function () {
      const { registry, user1, user2 } = await loadFixture(deployRegistryFixture);
      await registry.approveAddress(user1.address);
      expect(await registry.totalApproved()).to.equal(1);
      await registry.approveAddress(user2.address);
      expect(await registry.totalApproved()).to.equal(2);
    });

    it("emits AddressApproved with correct args", async function () {
      const { registry, owner, user1 } = await loadFixture(deployRegistryFixture);
      await expect(registry.approveAddress(user1.address))
        .to.emit(registry, "AddressApproved")
        // anyValue matches the timestamp (we don't know block.timestamp in advance)
        .withArgs(user1.address, owner.address, anyValue);
    });

    it("reverts when called by non-owner", async function () {
      const { registry, user1, attacker } = await loadFixture(deployRegistryFixture);
      // .connect(signer) sends the transaction as that signer
      await expect(
        registry.connect(attacker).approveAddress(user1.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("reverts for zero address", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);
      await expect(
        registry.approveAddress(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("reverts when approving an already-approved address", async function () {
      const { registry, user1 } = await loadFixture(deployRegistryFixture);
      await registry.approveAddress(user1.address);
      await expect(
        registry.approveAddress(user1.address)
      ).to.be.revertedWithCustomError(registry, "AlreadyApproved")
        .withArgs(user1.address);
    });
  });

  // ── approveAddresses (batch) ───────────────────────────────────────────────

  describe("approveAddresses (batch)", function () {
    it("approves multiple addresses atomically", async function () {
      const { registry, user1, user2, user3 } = await loadFixture(deployRegistryFixture);
      await registry.approveAddresses([user1.address, user2.address, user3.address]);
      expect(await registry.isApproved(user1.address)).to.equal(true);
      expect(await registry.isApproved(user2.address)).to.equal(true);
      expect(await registry.isApproved(user3.address)).to.equal(true);
      expect(await registry.totalApproved()).to.equal(3);
    });

    it("skips already-approved addresses without reverting", async function () {
      const { registry, user1, user2 } = await loadFixture(deployRegistryFixture);
      await registry.approveAddress(user1.address);

      // user1 is already approved — batch must not revert, just skip
      await expect(
        registry.approveAddresses([user1.address, user2.address])
      ).to.not.be.reverted;

      // user1 was already counted, user2 was added → total should be 2
      expect(await registry.totalApproved()).to.equal(2);
    });

    it("reverts when non-owner calls batch approve", async function () {
      const { registry, attacker, user1 } = await loadFixture(deployRegistryFixture);
      await expect(
        registry.connect(attacker).approveAddresses([user1.address])
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("reverts if any address in the batch is zero", async function () {
      const { registry, user1 } = await loadFixture(deployRegistryFixture);
      await expect(
        registry.approveAddresses([user1.address, ethers.ZeroAddress])
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });
  });

  // ── revokeAddress ─────────────────────────────────────────────────────────

  describe("revokeAddress", function () {
    it("owner can revoke an approved address", async function () {
      const { registry, user1 } = await loadFixture(deployRegistryFixture);
      await registry.approveAddress(user1.address);
      await registry.revokeAddress(user1.address);
      expect(await registry.isApproved(user1.address)).to.equal(false);
    });

    it("decrements totalApproved on revoke", async function () {
      const { registry, user1, user2 } = await loadFixture(deployRegistryFixture);
      await registry.approveAddresses([user1.address, user2.address]);
      expect(await registry.totalApproved()).to.equal(2);

      await registry.revokeAddress(user1.address);
      expect(await registry.totalApproved()).to.equal(1);
    });

    it("emits AddressRevoked event", async function () {
      const { registry, owner, user1 } = await loadFixture(deployRegistryFixture);
      await registry.approveAddress(user1.address);

      await expect(registry.revokeAddress(user1.address))
        .to.emit(registry, "AddressRevoked")
        .withArgs(user1.address, owner.address, anyValue);
    });

    it("reverts when revoking a non-approved address", async function () {
      const { registry, user1 } = await loadFixture(deployRegistryFixture);
      await expect(
        registry.revokeAddress(user1.address)
      ).to.be.revertedWithCustomError(registry, "NotApproved")
        .withArgs(user1.address);
    });

    it("reverts when non-owner tries to revoke", async function () {
      const { registry, user1, attacker } = await loadFixture(deployRegistryFixture);
      await registry.approveAddress(user1.address);
      await expect(
        registry.connect(attacker).revokeAddress(user1.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  // ── revokeAddresses (batch) ────────────────────────────────────────────────

  describe("revokeAddresses (batch)", function () {
    it("revokes multiple addresses atomically", async function () {
      const { registry, user1, user2, user3 } = await loadFixture(deployRegistryFixture);
      await registry.approveAddresses([user1.address, user2.address, user3.address]);
      await registry.revokeAddresses([user1.address, user2.address]);

      expect(await registry.isApproved(user1.address)).to.equal(false);
      expect(await registry.isApproved(user2.address)).to.equal(false);
      expect(await registry.isApproved(user3.address)).to.equal(true);
      expect(await registry.totalApproved()).to.equal(1);
    });

    it("skips non-approved addresses in batch revoke without reverting", async function () {
      const { registry, user1 } = await loadFixture(deployRegistryFixture);
      // user1 was never approved — batch should skip, not revert
      await expect(
        registry.revokeAddresses([user1.address])
      ).to.not.be.reverted;
    });
  });

  // ── Ownership transfer ────────────────────────────────────────────────────

  describe("Ownership", function () {
    it("owner can transfer ownership", async function () {
      const { registry, user1 } = await loadFixture(deployRegistryFixture);
      await registry.transferOwnership(user1.address);
      expect(await registry.owner()).to.equal(user1.address);
    });

    it("new owner can approve addresses", async function () {
      const { registry, user1, user2 } = await loadFixture(deployRegistryFixture);
      await registry.transferOwnership(user1.address);

      // user1 is now the owner — they should be able to approve user2
      await registry.connect(user1).approveAddress(user2.address);
      expect(await registry.isApproved(user2.address)).to.equal(true);
    });
  });
});
