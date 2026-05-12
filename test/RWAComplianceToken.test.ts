/**
 * RWAComplianceToken.test.ts
 *
 * Tests for the compliance-gated ERC-20 token.
 *
 * Key scenarios to cover:
 *   • Deployment: correct initial state
 *   • Minting: owner-only, compliance-checked, supply-capped
 *   • Transfer: compliance-checked for both sender and recipient
 *   • Compliance toggle: disabling compliance opens up transfers
 *   • View helpers: getTokenInfo(), canTransact()
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { ComplianceRegistry, RWAComplianceToken } from "../typechain-types";

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deploys both contracts, approves the deployer (owner), and returns
 * everything the tests need.
 */
async function deployTokenFixture() {
  const [owner, alice, bob, charlie, attacker] = await ethers.getSigners();

  // 1. Deploy registry
  const RegistryFactory = await ethers.getContractFactory("ComplianceRegistry");
  const registry: ComplianceRegistry = await RegistryFactory.deploy();

  // 2. Deploy token pointing at the registry
  const TokenFactory = await ethers.getContractFactory("RWAComplianceToken");
  const token: RWAComplianceToken = await TokenFactory.deploy(
    "Test RWA Token",
    "TRWA",
    1_000_000,        // 1 million token cap
    await registry.getAddress()
  );

  // 3. Approve owner so they can receive minted tokens
  await registry.approveAddress(owner.address);

  return { token, registry, owner, alice, bob, charlie, attacker };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe("RWAComplianceToken", function () {

  // ── Deployment ────────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("sets correct token name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.name()).to.equal("Test RWA Token");
      expect(await token.symbol()).to.equal("TRWA");
    });

    it("sets deployer as owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      expect(await token.owner()).to.equal(owner.address);
    });

    it("sets MAX_SUPPLY correctly (in wei)", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      // 1,000,000 tokens × 10^18 = 1e24
      const expected = ethers.parseEther("1000000");
      expect(await token.MAX_SUPPLY()).to.equal(expected);
    });

    it("starts with zero total supply", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.totalSupply()).to.equal(0);
    });

    it("starts with compliance enabled", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.complianceEnabled()).to.equal(true);
    });

    it("stores the registry address correctly", async function () {
      const { token, registry } = await loadFixture(deployTokenFixture);
      expect(await token.complianceRegistry()).to.equal(await registry.getAddress());
    });

    it("reverts deployment with zero registry address", async function () {
      const Factory = await ethers.getContractFactory("RWAComplianceToken");
      await expect(
        Factory.deploy("Bad Token", "BAD", 100, ethers.ZeroAddress)
      ).to.be.revertedWith("Registry cannot be zero address");
    });
  });

  // ── Minting ───────────────────────────────────────────────────────────────

  describe("mint", function () {
    it("owner can mint to approved address", async function () {
      const { token, registry, alice } = await loadFixture(deployTokenFixture);
      await registry.approveAddress(alice.address);

      await token.mint(alice.address, 100);

      // 100 tokens = 100 × 10^18 wei
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
    });

    it("increases total supply after mint", async function () {
      const { token, registry, alice } = await loadFixture(deployTokenFixture);
      await registry.approveAddress(alice.address);
      await token.mint(alice.address, 500);

      expect(await token.totalSupply()).to.equal(ethers.parseEther("500"));
    });

    it("emits TokensMinted event", async function () {
      const { token, registry, owner, alice } = await loadFixture(deployTokenFixture);
      await registry.approveAddress(alice.address);

      await expect(token.mint(alice.address, 100))
        .to.emit(token, "TokensMinted")
        .withArgs(alice.address, ethers.parseEther("100"), owner.address);
    });

    it("emits ERC20 Transfer event from zero address", async function () {
      const { token, registry, alice } = await loadFixture(deployTokenFixture);
      await registry.approveAddress(alice.address);

      // Standard ERC-20 minting emits Transfer(address(0), recipient, amount)
      await expect(token.mint(alice.address, 100))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, alice.address, ethers.parseEther("100"));
    });

    it("reverts when non-owner tries to mint", async function () {
      const { token, registry, alice } = await loadFixture(deployTokenFixture);
      await registry.approveAddress(alice.address);

      await expect(
        token.connect(alice).mint(alice.address, 100)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("reverts when minting to unapproved address", async function () {
      const { token, alice } = await loadFixture(deployTokenFixture);
      // alice was NOT approved in registry

      await expect(
        token.mint(alice.address, 100)
      ).to.be.revertedWithCustomError(token, "RecipientNotCompliant")
        .withArgs(alice.address);
    });

    it("reverts when minting zero tokens", async function () {
      const { token, registry, alice } = await loadFixture(deployTokenFixture);
      await registry.approveAddress(alice.address);

      await expect(
        token.mint(alice.address, 0)
      ).to.be.revertedWithCustomError(token, "ZeroAmount");
    });

    it("reverts when minting to zero address", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      await expect(
        token.mint(ethers.ZeroAddress, 100)
      ).to.be.revertedWithCustomError(token, "ZeroAddress");
    });

    it("reverts when mint exceeds MAX_SUPPLY", async function () {
      const { token, registry, alice } = await loadFixture(deployTokenFixture);
      await registry.approveAddress(alice.address);

      // Try to mint 1 more than the cap
      const tooBig = 1_000_001;
      await expect(
        token.mint(alice.address, tooBig)
      ).to.be.revertedWithCustomError(token, "ExceedsMaxSupply");
    });
  });

  // ── Transfers ─────────────────────────────────────────────────────────────

  describe("transfer", function () {
    // Helper fixture: mint tokens to alice first, then test transfers
    async function mintedFixture() {
      const base = await deployTokenFixture();
      const { token, registry, alice } = base;
      await registry.approveAddress(alice.address);
      await token.mint(alice.address, 1000);
      return base;
    }

    it("approved sender can transfer to approved recipient", async function () {
      const { token, registry, alice, bob } = await loadFixture(mintedFixture);
      await registry.approveAddress(bob.address);

      await token.connect(alice).transfer(bob.address, ethers.parseEther("100"));

      expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("100"));
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("900"));
    });

    it("reverts when sender is not approved", async function () {
      // attacker has tokens somehow but is not in registry
      // We need to set up this scenario manually by disabling compliance,
      // minting, then re-enabling compliance.
      const { token, registry, attacker } = await loadFixture(deployTokenFixture);

      // Disable compliance to mint to attacker
      await token.setComplianceEnabled(false);
      await token.mint(attacker.address, 100); // Works because compliance is off
      await token.setComplianceEnabled(true);  // Re-enable

      // Now attacker tries to transfer — they're not in registry
      await expect(
        token.connect(attacker).transfer(attacker.address, ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(token, "SenderNotCompliant");
    });

    it("reverts when recipient is not approved", async function () {
      const { token, registry, alice, bob } = await loadFixture(mintedFixture);
      // bob was NOT approved

      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(token, "RecipientNotCompliant")
        .withArgs(bob.address);
    });

    it("emits Transfer event on successful transfer", async function () {
      const { token, registry, alice, bob } = await loadFixture(mintedFixture);
      await registry.approveAddress(bob.address);

      await expect(
        token.connect(alice).transfer(bob.address, ethers.parseEther("200"))
      )
        .to.emit(token, "Transfer")
        .withArgs(alice.address, bob.address, ethers.parseEther("200"));
    });
  });

  // ── Compliance Toggle ─────────────────────────────────────────────────────

  describe("setComplianceEnabled", function () {
    it("owner can disable compliance", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      await token.setComplianceEnabled(false);
      expect(await token.complianceEnabled()).to.equal(false);
    });

    it("with compliance off, unapproved addresses can receive tokens", async function () {
      const { token, alice } = await loadFixture(deployTokenFixture);
      // alice is NOT in registry

      await token.setComplianceEnabled(false);
      await expect(token.mint(alice.address, 100)).to.not.be.reverted;
      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("100"));
    });

    it("emits ComplianceStatusChanged event", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      await expect(token.setComplianceEnabled(false))
        .to.emit(token, "ComplianceStatusChanged")
        .withArgs(false, owner.address);
    });

    it("reverts when non-owner toggles compliance", async function () {
      const { token, attacker } = await loadFixture(deployTokenFixture);
      await expect(
        token.connect(attacker).setComplianceEnabled(false)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  // ── View Helpers ──────────────────────────────────────────────────────────

  describe("getTokenInfo", function () {
    it("returns correct token metadata", async function () {
      const { token, registry, alice } = await loadFixture(deployTokenFixture);
      await registry.approveAddress(alice.address);
      await token.mint(alice.address, 250);

      const info = await token.getTokenInfo();
      expect(info.tokenName).to.equal("Test RWA Token");
      expect(info.tokenSymbol).to.equal("TRWA");
      expect(info.tokenDecimals).to.equal(18);
      expect(info.currentSupply).to.equal(ethers.parseEther("250"));
      expect(info.maxSupplyCap).to.equal(ethers.parseEther("1000000"));
      expect(info.isComplianceActive).to.equal(true);
    });
  });

  describe("canTransact", function () {
    it("returns true for approved address when compliance is on", async function () {
      const { token, registry, alice } = await loadFixture(deployTokenFixture);
      await registry.approveAddress(alice.address);

      const [canTransact, isApproved, isActive] = await token.canTransact(alice.address);
      expect(canTransact).to.equal(true);
      expect(isApproved).to.equal(true);
      expect(isActive).to.equal(true);
    });

    it("returns false for unapproved address when compliance is on", async function () {
      const { token, alice } = await loadFixture(deployTokenFixture);
      // alice not approved

      const [canTransact, isApproved, isActive] = await token.canTransact(alice.address);
      expect(canTransact).to.equal(false);
      expect(isApproved).to.equal(false);
      expect(isActive).to.equal(true);
    });

    it("returns true for unapproved address when compliance is OFF", async function () {
      const { token, alice } = await loadFixture(deployTokenFixture);
      await token.setComplianceEnabled(false);

      const [canTransact, isApproved, isActive] = await token.canTransact(alice.address);
      expect(canTransact).to.equal(true);   // compliance off → anyone can transact
      expect(isApproved).to.equal(false);   // still not in registry
      expect(isActive).to.equal(false);     // compliance enforcement is off
    });
  });
});
