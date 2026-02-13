// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AstroDAO - SECURE Version for opBNB
 * @dev All critical security issues fixed
 */
contract AstroDAO is Ownable, ReentrancyGuard, Pausable {
    
    // ============================================
    // ENUMS (MUST BE DEFINED FIRST!)
    // ============================================
    
    enum ProposalType {
        WEEKLY_THEME,
        RESEARCH_DISCOVERY,
        COMMUNITY_PROPOSAL,
        KNOWLEDGE_SHARING,
        COLLABORATION
    }
    
    enum ProposalStatus {
        PENDING,
        ACTIVE,
        PASSED,
        REJECTED,
        QUEUED,
        EXECUTED,
        CANCELLED
    }
    
    enum VoteChoice {
        AGAINST,
        FOR,
        ABSTAIN
    }
    
    // ============================================
    // CUSTOM ERRORS
    // ============================================
    
    error InsufficientReputation();
    error AlreadyVoted();
    error ProposalNotActive();
    error QuorumNotReached();
    error AlreadyDelegated();
    error InvalidProposalId();
    error Unauthorized();
    
    // ============================================
    // STRUCTS
    // ============================================
    
    struct Proposal {
        uint256 id;
        address proposer;
        ProposalType proposalType;
        string title;
        string description;
        string ipfsHash;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 votesAbstain;
        uint256 startTime;
        uint256 endTime;
        uint256 executionTime;
        ProposalStatus status;
        bool executed;
        mapping(address => bool) hasVoted;
        mapping(address => VoteChoice) voteChoice;
    }
    
    struct Discovery {
        uint256 proposalId;
        string title;
        string researcherName;
        string institution;
        string paperIPFS;
        string[] tags;
        uint256 votingScore;
        uint256 timestamp;
        bool verified;
        mapping(address => bool) researcherApprovals;
        uint256 approvalCount;
    }
    
    struct WeeklyTheme {
        uint256 proposalId;
        string themeName;
        string description;
        uint256 weekNumber;
        uint256 votingScore;
        bool isActive;
    }
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    uint256 public proposalCount;
    uint256 public discoveryCount;
    uint256 public currentWeek;
    
    // Governance parameters
    uint256 public votingPeriod = 7 days;
    uint256 public quickVotePeriod = 3 days;
    uint256 public minVotesRequired = 5;
    uint256 public quorumPercentage = 10;
    uint256 public executionDelay = 2 days;
    uint256 public proposalThreshold = 3;
    
    // SECURITY FIX: Reputation cap
    uint256 public constant MAX_REPUTATION = 10000;
    
    // SECURITY FIX: Active voter tracking
    uint256 public totalVoterCount;
    mapping(address => uint256) public lastVoteTime;
    uint256 public activeVoterWindow = 30 days;
    
    // Reputation & delegation
    mapping(address => uint256) public userReputation;
    mapping(address => bool) public verifiedResearchers;
    mapping(address => address) public delegates;
    
    // Mappings
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => Discovery) public discoveries;
    mapping(uint256 => WeeklyTheme) public weeklyThemes;
    mapping(uint256 => address[]) public proposalVoters;
    
    // Lists
    uint256[] public weeklyThemeProposals;
    uint256[] public discoveryProposals;
    uint256[] public communityProposals;
    uint256[] public knowledgeSharingProposals;
    
    // Voter tracking
    mapping(address => bool) public isRegisteredVoter;
    mapping(address => uint256) public userVoteCount;
    mapping(address => uint256[]) public userProposals;
    
    uint256 public activeWeeklyTheme;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType indexed proposalType,
        string title,
        uint256 endTime
    );
    
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteChoice choice,
        uint256 newVoteCount
    );
    
    event ProposalFinalized(
        uint256 indexed proposalId,
        ProposalStatus status,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 votesAbstain
    );
    
    event ProposalQueued(
        uint256 indexed proposalId,
        uint256 executionTime
    );
    
    event ProposalExecuted(uint256 indexed proposalId);
    
    event DiscoverySubmitted(
        uint256 indexed proposalId,
        uint256 indexed discoveryId,
        string title,
        string researcher
    );
    
    event WeeklyThemeSet(
        uint256 indexed proposalId,
        string themeName,
        uint256 weekNumber
    );
    
    event DiscoveryVerified(
        uint256 indexed discoveryId,
        uint256 totalApprovals
    );
    
    event DelegateChanged(
        address indexed delegator,
        address indexed fromDelegate,
        address indexed toDelegate
    );
    
    event ReputationEarned(
        address indexed user,
        uint256 amount,
        string reason
    );
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor() Ownable(msg.sender) {
        currentWeek = 1;
    }
    
    // ============================================
    // CORE FUNCTIONS
    // ============================================
    
    function createProposal(
        ProposalType _type,
        string calldata _title,
        string calldata _description,
        string calldata _ipfsHash,
        bool _quickVote
    ) external whenNotPaused returns (uint256) {
        require(bytes(_title).length > 0, "Title required");
        require(bytes(_description).length > 0, "Description required");
        
        if (userReputation[msg.sender] < proposalThreshold) {
            revert InsufficientReputation();
        }
        
        proposalCount++;
        uint256 proposalId = proposalCount;
        
        Proposal storage newProposal = proposals[proposalId];
        newProposal.id = proposalId;
        newProposal.proposer = msg.sender;
        newProposal.proposalType = _type;
        newProposal.title = _title;
        newProposal.description = _description;
        newProposal.ipfsHash = _ipfsHash;
        newProposal.startTime = block.timestamp;
        newProposal.endTime = block.timestamp + (_quickVote ? quickVotePeriod : votingPeriod);
        newProposal.status = ProposalStatus.ACTIVE;
        
        // Categorize
        if (_type == ProposalType.WEEKLY_THEME) {
            weeklyThemeProposals.push(proposalId);
        } else if (_type == ProposalType.RESEARCH_DISCOVERY) {
            discoveryProposals.push(proposalId);
        } else if (_type == ProposalType.COMMUNITY_PROPOSAL) {
            communityProposals.push(proposalId);
        } else if (_type == ProposalType.KNOWLEDGE_SHARING) {
            knowledgeSharingProposals.push(proposalId);
        }
        
        userProposals[msg.sender].push(proposalId);
        
        emit ProposalCreated(proposalId, msg.sender, _type, _title, newProposal.endTime);
        
        return proposalId;
    }
    
    // SECURITY FIX: Prevent double voting via delegation
    function vote(uint256 _proposalId, VoteChoice _choice) external whenNotPaused {
        Proposal storage proposal = proposals[_proposalId];
        
        if (proposal.id == 0) revert InvalidProposalId();
        if (proposal.status != ProposalStatus.ACTIVE) revert ProposalNotActive();
        if (block.timestamp > proposal.endTime) revert ProposalNotActive();
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();
        if (delegates[msg.sender] != address(0)) revert AlreadyDelegated();
        
        // Register voter
        if (!isRegisteredVoter[msg.sender]) {
            isRegisteredVoter[msg.sender] = true;
            totalVoterCount++;
        }
        
        lastVoteTime[msg.sender] = block.timestamp;
        
        // Record vote
        proposal.hasVoted[msg.sender] = true;
        proposal.voteChoice[msg.sender] = _choice;
        
        if (_choice == VoteChoice.FOR) {
            proposal.votesFor++;
        } else if (_choice == VoteChoice.AGAINST) {
            proposal.votesAgainst++;
        } else {
            proposal.votesAbstain++;
        }
        
        proposalVoters[_proposalId].push(msg.sender);
        userVoteCount[msg.sender]++;
        
        _earnReputation(msg.sender, 1, "Voted on proposal");
        
        emit VoteCast(_proposalId, msg.sender, _choice, userVoteCount[msg.sender]);
    }
    
    function finalizeProposal(uint256 _proposalId) external whenNotPaused {
        Proposal storage proposal = proposals[_proposalId];
        
        if (proposal.status != ProposalStatus.ACTIVE) revert ProposalNotActive();
        require(block.timestamp >= proposal.endTime, "Voting still active");
        
        // Check quorum
        if (!isQuorumReached(_proposalId)) {
            proposal.status = ProposalStatus.REJECTED;
            emit ProposalFinalized(_proposalId, ProposalStatus.REJECTED, proposal.votesFor, proposal.votesAgainst, proposal.votesAbstain);
            return;
        }
        
        // Check if passed
        if (proposal.votesFor > proposal.votesAgainst) {
            proposal.status = ProposalStatus.QUEUED;
            proposal.executionTime = block.timestamp + executionDelay;
            emit ProposalQueued(_proposalId, proposal.executionTime);
        } else {
            proposal.status = ProposalStatus.REJECTED;
        }
        
        emit ProposalFinalized(_proposalId, proposal.status, proposal.votesFor, proposal.votesAgainst, proposal.votesAbstain);
    }
    
    // SECURITY FIX: Access control on execute
    function executeProposal(uint256 _proposalId) external whenNotPaused {
        Proposal storage proposal = proposals[_proposalId];
        
        if (proposal.status != ProposalStatus.QUEUED) revert InvalidProposalId();
        if (proposal.executed) revert InvalidProposalId();
        
        // Only proposer or owner can execute immediately
        if (msg.sender != proposal.proposer && msg.sender != owner()) {
            require(
                block.timestamp >= proposal.executionTime + 1 days,
                "Public execution not yet available"
            );
        } else {
            require(block.timestamp >= proposal.executionTime, "Time lock active");
        }
        
        proposal.executed = true;
        proposal.status = ProposalStatus.EXECUTED;
        
        if (proposal.proposalType == ProposalType.WEEKLY_THEME) {
            activeWeeklyTheme = _proposalId;
            weeklyThemes[_proposalId].isActive = true;
        }
        
        _earnReputation(proposal.proposer, 5, "Proposal executed");
        
        emit ProposalExecuted(_proposalId);
    }
    
    function delegate(address _delegatee) external {
        require(_delegatee != msg.sender, "Cannot delegate to self");
        require(_delegatee != address(0), "Cannot delegate to zero");
        
        address oldDelegate = delegates[msg.sender];
        delegates[msg.sender] = _delegatee;
        
        emit DelegateChanged(msg.sender, oldDelegate, _delegatee);
    }
    
    function undelegate() external {
        address oldDelegate = delegates[msg.sender];
        require(oldDelegate != address(0), "Not delegating");
        
        delete delegates[msg.sender];
        
        emit DelegateChanged(msg.sender, oldDelegate, address(0));
    }
    
    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    // SECURITY FIX: Capped reputation
    function _earnReputation(address _user, uint256 _amount, string memory _reason) internal {
        uint256 newRep = userReputation[_user] + _amount;
        
        if (newRep > MAX_REPUTATION) {
            newRep = MAX_REPUTATION;
        }
        
        userReputation[_user] = newRep;
        emit ReputationEarned(_user, _amount, _reason);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    function getProposal(uint256 _proposalId) external view returns (
        uint256 id,
        address proposer,
        ProposalType proposalType,
        string memory title,
        string memory description,
        string memory ipfsHash,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 votesAbstain,
        uint256 endTime,
        uint256 executionTime,
        ProposalStatus status
    ) {
        Proposal storage p = proposals[_proposalId];
        return (
            p.id,
            p.proposer,
            p.proposalType,
            p.title,
            p.description,
            p.ipfsHash,
            p.votesFor,
            p.votesAgainst,
            p.votesAbstain,
            p.endTime,
            p.executionTime,
            p.status
        );
    }
    
    // SECURITY FIX: Better quorum calculation
    function isQuorumReached(uint256 _proposalId) public view returns (bool) {
        Proposal storage proposal = proposals[_proposalId];
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
        
        if (totalVotes < minVotesRequired) {
            return false;
        }
        
        // Use simple total voter count for now
        uint256 quorum = (totalVoterCount * quorumPercentage) / 100;
        
        return totalVotes >= quorum;
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    function updateGovernanceParams(
        uint256 _votingPeriod,
        uint256 _quickVotePeriod,
        uint256 _minVotesRequired,
        uint256 _quorumPercentage,
        uint256 _executionDelay,
        uint256 _proposalThreshold
    ) external onlyOwner {
        require(_votingPeriod >= 3 days, "Voting period too short");
        require(_quickVotePeriod >= 1 days, "Quick vote too short");
        require(_minVotesRequired > 0, "Min votes must be positive");
        require(_quorumPercentage > 0 && _quorumPercentage <= 100, "Invalid quorum");
        require(_executionDelay >= 1 days, "Delay too short");
        require(_proposalThreshold > 0, "Threshold must be positive");
        
        votingPeriod = _votingPeriod;
        quickVotePeriod = _quickVotePeriod;
        minVotesRequired = _minVotesRequired;
        quorumPercentage = _quorumPercentage;
        executionDelay = _executionDelay;
        proposalThreshold = _proposalThreshold;
    }
    
    function setVerifiedResearcher(address _researcher, bool _verified) external onlyOwner {
        verifiedResearchers[_researcher] = _verified;
    }
    
    function awardReputation(address _user, uint256 _amount) external onlyOwner {
        _earnReputation(_user, _amount, "Awarded by admin");
    }
    
    // SECURITY FIX: Proposer can cancel
    function cancelProposal(uint256 _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        
        if (msg.sender != proposal.proposer && msg.sender != owner()) {
            revert Unauthorized();
        }
        
        if (proposal.status != ProposalStatus.ACTIVE && proposal.status != ProposalStatus.PENDING) {
            revert InvalidProposalId();
        }
        
        proposal.status = ProposalStatus.CANCELLED;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // SECURITY FIX: Emergency withdrawal
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    function incrementWeek() external onlyOwner {
        require(currentWeek < type(uint256).max, "Week overflow");
        currentWeek++;
        activeWeeklyTheme = 0;
    }
}