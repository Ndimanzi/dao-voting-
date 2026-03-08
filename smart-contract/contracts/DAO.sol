// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DAO {
    struct Proposal {
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
    }

    Proposal[] public proposals;

    function createProposal(string memory description) public {
        proposals.push(Proposal(description, 0, 0, false));
    }

    function vote(uint256 id, bool support) public {
        require(id < proposals.length, "Invalid proposal id");

        if (support) {
            proposals[id].votesFor++;
        } else {
            proposals[id].votesAgainst++;
        }
    }
}
