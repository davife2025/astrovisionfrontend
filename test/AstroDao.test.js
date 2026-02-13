// test/AstroDAO.test.js - FULLY CORRECTED VERSION
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AstroDAO Security Tests", function () {
  let astroDAO;
  let owner, alice, bob, charlie;
  
  beforeEach(async function () {
    [owner, alice, bob, charlie] = await ethers.getSigners();
    
    const AstroDAO = await ethers.getContractFactory("AstroDAO");
    astroDAO = await AstroDAO.deploy();
    await astroDAO.waitForDeployment();
    
    // Bootstrap reputation
    await astroDAO.awardReputation(alice.address, 10);
    await astroDAO.awardReputation(bob.address, 10);
  });
  
  describe("Critical Security Tests", function () {
    
    it("Should prevent double voting via delegation", async function () {
      // Alice creates proposal
      await astroDAO.connect(alice).createProposal(
        0, // WEEKLY_THEME
        "Test Proposal",
        "Description",
        "ipfs://test",
        false
      );
      
      // Bob delegates to Alice
      await astroDAO.connect(bob).delegate(alice.address);
      
      // Bob tries to vote (should fail with custom error)
      await expect(
        astroDAO.connect(bob).vote(1, 1)
      ).to.be.revertedWithCustomError(astroDAO, "AlreadyDelegated");
    });
    
    it("Should cap reputation at MAX_REPUTATION", async function () {
      // Award max reputation
      await astroDAO.awardReputation(alice.address, 10000);
      
      let rep = await astroDAO.userReputation(alice.address);
      expect(rep).to.equal(10000);
      
      // Try to award more
      await astroDAO.awardReputation(alice.address, 5000);
      
      rep = await astroDAO.userReputation(alice.address);
      expect(rep).to.equal(10000); // Still capped
    });
    
    it("Should prevent unauthorized execution", async function () {
      // Create and pass proposal
      await astroDAO.connect(alice).createProposal(
        0, "Proposal", "Desc", "ipfs://", false
      );
      
      // Vote to pass (need 5 votes minimum)
      const [, , , , u1, u2, u3] = await ethers.getSigners();
      await astroDAO.awardReputation(u1.address, 10);
      await astroDAO.awardReputation(u2.address, 10);
      await astroDAO.awardReputation(u3.address, 10);
      
      await astroDAO.connect(alice).vote(1, 1);
      await astroDAO.connect(bob).vote(1, 1);
      await astroDAO.connect(u1).vote(1, 1);
      await astroDAO.connect(u2).vote(1, 1);
      await astroDAO.connect(u3).vote(1, 1);
      
      // Advance time past voting period (7 days)
      await time.increase(7 * 24 * 60 * 60 + 1);
      
      // Finalize
      await astroDAO.finalizeProposal(1);
      
      // Advance past execution time (2 days)
      await time.increase(2 * 24 * 60 * 60 + 1);
      
      // Charlie (not proposer/owner) needs to wait 1 extra day for public execution
      await expect(
        astroDAO.connect(charlie).executeProposal(1)
      ).to.be.revertedWith("Public execution not yet available");
      
      // Alice (proposer) can execute immediately after execution time
      await expect(
        astroDAO.connect(alice).executeProposal(1)
      ).to.not.be.reverted;
    });
    
    it("Should calculate quorum correctly", async function () {
      // Create proposal
      await astroDAO.connect(alice).createProposal(
        0, "Proposal", "Desc", "ipfs://", false
      );
      
      // Get more voters
      const [, , , , user1, user2, user3] = await ethers.getSigners();
      
      // Award reputation to new users
      await astroDAO.awardReputation(user1.address, 10);
      await astroDAO.awardReputation(user2.address, 10);
      await astroDAO.awardReputation(user3.address, 10);
      
      // Vote with at least 5 people to meet minimum
      await astroDAO.connect(alice).vote(1, 1); // Voter 1
      await astroDAO.connect(bob).vote(1, 1);   // Voter 2
      await astroDAO.connect(user1).vote(1, 1); // Voter 3
      await astroDAO.connect(user2).vote(1, 1); // Voter 4
      await astroDAO.connect(user3).vote(1, 1); // Voter 5
      
      // Check quorum is reached
      const quorumReached = await astroDAO.isQuorumReached(1);
      expect(quorumReached).to.be.true;
    });
    
  });
  
  describe("Gas Optimization Tests", function () {
    
    it("Should handle 10 voters efficiently", async function () {
      // Award reputation to 10 test addresses
      const voters = [];
      const signers = await ethers.getSigners();
      
      for (let i = 4; i < 14; i++) {
        const voter = signers[i];
        voters.push(voter);
        await astroDAO.awardReputation(voter.address, 10);
      }
      
      // Create proposal
      await astroDAO.connect(alice).createProposal(
        0, "Load Test", "Desc", "ipfs://", false
      );
      
      // All vote
      for (const voter of voters) {
        await astroDAO.connect(voter).vote(1, 1);
      }
      
      // Finalize should not run out of gas
      await time.increase(7 * 24 * 60 * 60 + 1);
      
      const tx = await astroDAO.finalizeProposal(1);
      const receipt = await tx.wait();
      
      console.log(`Gas used for finalizing with ${voters.length} voters: ${receipt.gasUsed}`);
      expect(receipt.gasUsed).to.be.lessThan(500000);
    });
    
  });
  
  describe("Additional Tests", function () {
    
    it("Should deploy with correct initial values", async function () {
      expect(await astroDAO.proposalCount()).to.equal(0);
      expect(await astroDAO.currentWeek()).to.equal(1);
      expect(await astroDAO.MAX_REPUTATION()).to.equal(10000);
    });
    
    it("Should create proposals correctly", async function () {
      await astroDAO.connect(alice).createProposal(
        0,
        "Test",
        "Description",
        "ipfs://hash",
        false
      );
      
      const count = await astroDAO.proposalCount();
      expect(count).to.equal(1);
      
      const proposal = await astroDAO.getProposal(1);
      expect(proposal.title).to.equal("Test");
      expect(proposal.proposer).to.equal(alice.address);
    });
    
    it("Should reject proposals from users without reputation", async function () {
      const [, , , , newUser] = await ethers.getSigners();
      
      await expect(
        astroDAO.connect(newUser).createProposal(
          0, "Test", "Desc", "ipfs://", false
        )
      ).to.be.revertedWithCustomError(astroDAO, "InsufficientReputation");
    });
    
    it("Should allow delegation", async function () {
      await astroDAO.connect(bob).delegate(alice.address);
      
      const delegate = await astroDAO.delegates(bob.address);
      expect(delegate).to.equal(alice.address);
    });
    
    it("Should allow undelegation", async function () {
      await astroDAO.connect(bob).delegate(alice.address);
      await astroDAO.connect(bob).undelegate();
      
      const delegate = await astroDAO.delegates(bob.address);
      expect(delegate).to.equal(ethers.ZeroAddress);
    });
    
    it("Should earn reputation for voting", async function () {
      // Create proposal
      await astroDAO.connect(alice).createProposal(
        0, "Test", "Desc", "ipfs://", false
      );
      
      const repBefore = await astroDAO.userReputation(bob.address);
      
      // Vote
      await astroDAO.connect(bob).vote(1, 1);
      
      const repAfter = await astroDAO.userReputation(bob.address);
      expect(repAfter).to.be.greaterThan(repBefore);
    });
    
    it("Should finalize proposals correctly", async function () {
      // Create proposal
      await astroDAO.connect(alice).createProposal(
        0, "Test", "Desc", "ipfs://", false
      );
      
      // Get enough votes (need 5 minimum)
      const [, , , , u1, u2, u3] = await ethers.getSigners();
      await astroDAO.awardReputation(u1.address, 10);
      await astroDAO.awardReputation(u2.address, 10);
      await astroDAO.awardReputation(u3.address, 10);
      
      await astroDAO.connect(alice).vote(1, 1);
      await astroDAO.connect(bob).vote(1, 1);
      await astroDAO.connect(u1).vote(1, 1);
      await astroDAO.connect(u2).vote(1, 1);
      await astroDAO.connect(u3).vote(1, 1);
      
      // Advance time past voting period
      await time.increase(7 * 24 * 60 * 60 + 1);
      
      // Finalize
      await astroDAO.finalizeProposal(1);
      
      const proposal = await astroDAO.getProposal(1);
      // Status should be 4 (QUEUED)
      // Enum: PENDING(0), ACTIVE(1), PASSED(2), REJECTED(3), QUEUED(4), EXECUTED(5), CANCELLED(6)
      expect(proposal.status).to.equal(4); // QUEUED
    });
    
    it("Should pause and unpause", async function () {
      await astroDAO.pause();
      
      await expect(
        astroDAO.connect(alice).createProposal(
          0, "Test", "Desc", "ipfs://", false
        )
      ).to.be.revertedWithCustomError(astroDAO, "EnforcedPause");
      
      await astroDAO.unpause();
      
      await expect(
        astroDAO.connect(alice).createProposal(
          0, "Test", "Desc", "ipfs://", false
        )
      ).to.not.be.reverted;
    });
    
    it("Should execute weekly theme proposals", async function () {
      // Create weekly theme proposal using createProposal with WEEKLY_THEME type and quick vote
      await astroDAO.connect(alice).createProposal(
        0, // WEEKLY_THEME
        "AI Research",
        "Discussion on AI advancements",
        "ipfs://",
        true // Quick vote (3 days)
      );
      
      // Get enough votes
      const [, , , , u1, u2, u3] = await ethers.getSigners();
      await astroDAO.awardReputation(u1.address, 10);
      await astroDAO.awardReputation(u2.address, 10);
      await astroDAO.awardReputation(u3.address, 10);
      
      await astroDAO.connect(alice).vote(1, 1);
      await astroDAO.connect(bob).vote(1, 1);
      await astroDAO.connect(u1).vote(1, 1);
      await astroDAO.connect(u2).vote(1, 1);
      await astroDAO.connect(u3).vote(1, 1);
      
      // Finalize (quick vote period - 3 days)
      await time.increase(3 * 24 * 60 * 60 + 1);
      await astroDAO.finalizeProposal(1);
      
      // Execute (execution delay - 2 days)
      await time.increase(2 * 24 * 60 * 60 + 1);
      await astroDAO.connect(alice).executeProposal(1);
      
      // Check it's now active
      const activeTheme = await astroDAO.activeWeeklyTheme();
      expect(activeTheme).to.equal(1);
    });
    
    it("Should handle abstain votes correctly", async function () {
      // Create proposal
      await astroDAO.connect(alice).createProposal(
        0, "Test", "Desc", "ipfs://", false
      );
      
      const [, , , , u1, u2, u3] = await ethers.getSigners();
      await astroDAO.awardReputation(u1.address, 10);
      await astroDAO.awardReputation(u2.address, 10);
      await astroDAO.awardReputation(u3.address, 10);
      
      // Vote with different choices
      await astroDAO.connect(alice).vote(1, 1); // FOR
      await astroDAO.connect(bob).vote(1, 0);   // AGAINST
      await astroDAO.connect(u1).vote(1, 2);    // ABSTAIN
      await astroDAO.connect(u2).vote(1, 2);    // ABSTAIN
      await astroDAO.connect(u3).vote(1, 1);    // FOR
      
      const proposal = await astroDAO.getProposal(1);
      expect(proposal.votesFor).to.equal(2);
      expect(proposal.votesAgainst).to.equal(1);
      expect(proposal.votesAbstain).to.equal(2);
    });
    
    it("Should reject proposals without quorum", async function () {
      // Create proposal
      await astroDAO.connect(alice).createProposal(
        0, "Test", "Desc", "ipfs://", false
      );
      
      // Only 2 votes (not enough for quorum)
      await astroDAO.connect(alice).vote(1, 1);
      await astroDAO.connect(bob).vote(1, 1);
      
      // Advance time
      await time.increase(7 * 24 * 60 * 60 + 1);
      
      // Finalize should reject due to quorum not reached
      await astroDAO.finalizeProposal(1);
      
      const proposal = await astroDAO.getProposal(1);
      expect(proposal.status).to.equal(3); // REJECTED
    });
    
    it("Should allow public execution after extra delay", async function () {
      // Create and pass proposal
      await astroDAO.connect(alice).createProposal(
        0, "Test", "Desc", "ipfs://", false
      );
      
      // Get enough votes
      const [, , , , u1, u2, u3] = await ethers.getSigners();
      await astroDAO.awardReputation(u1.address, 10);
      await astroDAO.awardReputation(u2.address, 10);
      await astroDAO.awardReputation(u3.address, 10);
      
      await astroDAO.connect(alice).vote(1, 1);
      await astroDAO.connect(bob).vote(1, 1);
      await astroDAO.connect(u1).vote(1, 1);
      await astroDAO.connect(u2).vote(1, 1);
      await astroDAO.connect(u3).vote(1, 1);
      
      // Finalize
      await time.increase(7 * 24 * 60 * 60 + 1);
      await astroDAO.finalizeProposal(1);
      
      // Wait for execution time + 1 extra day for public execution
      await time.increase(3 * 24 * 60 * 60 + 1); // 2 days + 1 day
      
      // Now charlie (public) can execute
      await expect(
        astroDAO.connect(charlie).executeProposal(1)
      ).to.not.be.reverted;
    });
    
    it("Should update governance parameters", async function () {
      await astroDAO.updateGovernanceParams(
        5 * 24 * 60 * 60,  // 5 days voting
        2 * 24 * 60 * 60,  // 2 days quick vote
        10,                // min votes
        15,                // quorum %
        1 * 24 * 60 * 60,  // 1 day execution delay
        5                  // proposal threshold
      );
      
      expect(await astroDAO.votingPeriod()).to.equal(5 * 24 * 60 * 60);
      expect(await astroDAO.quorumPercentage()).to.equal(15);
      expect(await astroDAO.proposalThreshold()).to.equal(5);
    });
    
    it("Should create different proposal types", async function () {
      // Weekly Theme
      await astroDAO.connect(alice).createProposal(
        0, "Weekly Theme", "AI Ethics", "ipfs://", true
      );
      
      // Research Discovery
      await astroDAO.connect(bob).createProposal(
        1, "New Discovery", "Quantum Computing Breakthrough", "ipfs://paper", false
      );
      
      // Community Proposal
      await astroDAO.connect(alice).createProposal(
        2, "Community Vote", "Update governance params", "ipfs://", false
      );
      
      const count = await astroDAO.proposalCount();
      expect(count).to.equal(3);
      
      const proposal1 = await astroDAO.getProposal(1);
      const proposal2 = await astroDAO.getProposal(2);
      const proposal3 = await astroDAO.getProposal(3);
      
      expect(proposal1.proposalType).to.equal(0); // WEEKLY_THEME
      expect(proposal2.proposalType).to.equal(1); // RESEARCH_DISCOVERY
      expect(proposal3.proposalType).to.equal(2); // COMMUNITY_PROPOSAL
    });
    
  });
});