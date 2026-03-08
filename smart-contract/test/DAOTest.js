import { expect } from "chai";
import hardhat from "hardhat";

const { ethers } = hardhat;

describe("DAO Contract", function () {
  let dao;

  beforeEach(async function () {
    const DAO = await ethers.getContractFactory("DAO");
    dao = await DAO.deploy();
    await dao.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(dao.target).to.not.equal(undefined);
    });
  });

  describe("Proposals", function () {
    it("Should create a proposal", async function () {
      await dao.createProposal("Test proposal");
      
      const proposal = await dao.proposals(0);
      expect(proposal.description).to.equal("Test proposal");
      expect(proposal.votesFor).to.equal(0n);
      expect(proposal.votesAgainst).to.equal(0n);
      expect(proposal.executed).to.equal(false);
    });

    it("Should allow voting", async function () {
      await dao.createProposal("Test proposal");

      await dao.vote(0, true);
      await dao.vote(0, false);

      const proposal = await dao.proposals(0);
      expect(proposal.votesFor).to.equal(1n);
      expect(proposal.votesAgainst).to.equal(1n);
    });

    it("Should revert for invalid proposal id", async function () {
      await expect(dao.vote(0, true)).to.be.revertedWith("Invalid proposal id");
    });
  });
});
