// src/components/DAODashboard.jsx
// FIXED: Reads all governance parameters from contract instead of hardcoding

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ABI } from '../contracts/AstroDAO-ABI';
import CreateProposalForm from './CreateProposalForm';
import ProposalCard from './ProposalCard';
import UserProfile from './UserProfile';

const CONTRACT_ADDRESS = process.env.REACT_APP_DAO_CONTRACT_ADDRESS;
const CHAIN_ID = parseInt(process.env.REACT_APP_CHAIN_ID) || 56;

const isValidContractAddress = (addr) => {
  return addr && addr !== '0x...' && addr !== '' && addr !== 'undefined' && ethers.isAddress(addr);
};

const DAODashboard = () => {
  // User state
  const [account, setAccount] = useState('');
  const [userReputation, setUserReputation] = useState(0);
  const [userVoteCount, setUserVoteCount] = useState(0);
  
  // Contract state  
  const [totalVoters, setTotalVoters] = useState(0);
  const [proposalCount, setProposalCount] = useState(0);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [activeWeeklyTheme, setActiveWeeklyTheme] = useState(0);
  const [proposals, setProposals] = useState([]);
  
  // ✅ FIX #5-9: Read governance params from contract
  const [governanceParams, setGovernanceParams] = useState({
    votingPeriod: 7,
    quickVotePeriod: 3,
    minVotesRequired: 5,
    quorumPercentage: 10,
    executionDelay: 2,
    proposalThreshold: 3
  });
  
  // ✅ FIX #13: Check if contract is paused
  const [isPaused, setIsPaused] = useState(false);
  
  // ✅ FIX #14: Check if user is owner
  const [isOwner, setIsOwner] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [connectionError, setConnectionError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [activeView, setActiveView] = useState('proposals');
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    if (account) {
      loadDashboardData();
      loadGovernanceParams(); // ✅ Load contract params
      checkPausedStatus();    // ✅ Check pause status
      checkOwnerStatus();     // ✅ Check owner status
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  // ✅ NEW: Load governance parameters from contract
  const loadGovernanceParams = async () => {
    if (!isValidContractAddress(CONTRACT_ADDRESS)) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      
      const [votingPeriod, quickVotePeriod, minVotes, quorum, execDelay, threshold] = await Promise.all([
        contract.votingPeriod().catch(() => 7n * 86400n),
        contract.quickVotePeriod().catch(() => 3n * 86400n),
        contract.minVotesRequired().catch(() => 5n),
        contract.quorumPercentage().catch(() => 10n),
        contract.executionDelay().catch(() => 2n * 86400n),
        contract.proposalThreshold().catch(() => 3n)
      ]);
      
      setGovernanceParams({
        votingPeriod: Number(votingPeriod) / 86400,           // Convert seconds to days
        quickVotePeriod: Number(quickVotePeriod) / 86400,
        minVotesRequired: Number(minVotes),
        quorumPercentage: Number(quorum),
        executionDelay: Number(execDelay) / 86400,
        proposalThreshold: Number(threshold)
      });
      
      console.log('📋 Governance params loaded:', {
        votingPeriod: Number(votingPeriod) / 86400,
        quickVotePeriod: Number(quickVotePeriod) / 86400,
        minVotes: Number(minVotes),
        quorum: Number(quorum),
        execDelay: Number(execDelay) / 86400,
        threshold: Number(threshold)
      });
    } catch (error) {
      console.error('Error loading governance params:', error);
    }
  };

  // ✅ NEW: Check if contract is paused
  const checkPausedStatus = async () => {
    if (!isValidContractAddress(CONTRACT_ADDRESS)) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const paused = await contract.paused();
      setIsPaused(paused);
      
      if (paused) {
        console.warn('⚠️ Contract is paused');
        setDashboardError('Contract is currently paused. All transactions are disabled.');
      }
    } catch (error) {
      console.error('Error checking pause status:', error);
    }
  };

  // ✅ NEW: Check if user is owner
  const checkOwnerStatus = async () => {
    if (!isValidContractAddress(CONTRACT_ADDRESS) || !account) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
      const owner = await contract.owner();
      const isOwnerAccount = owner.toLowerCase() === account.toLowerCase();
      setIsOwner(isOwnerAccount);
      
      if (isOwnerAccount) {
        console.log('👑 You are the contract owner');
      }
    } catch (error) {
      console.error('Error checking owner:', error);
    }
  };

  const connectWallet = async () => {
    setConnectionError('');
    setConnecting(true);
    try {
      if (!window.ethereum) throw new Error('MetaMask is not installed. Please install it first.');

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }).catch((err) => {
        if (err.code === 4001) throw new Error('Please unlock MetaMask and approve the connection.');
        if (err.code === -32002) throw new Error('Connection request pending. Check MetaMask.');
        throw new Error(`MetaMask error: ${err.message}`);
      });

      if (!accounts?.length) throw new Error('No accounts found. Create an account in MetaMask.');

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (parseInt(chainId, 16) !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x38',
                chainName: 'BNB Smart Chain',
                nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                rpcUrls: ['https://bsc-dataseed1.binance.org'],
                blockExplorerUrls: ['https://bscscan.com'],
              }],
            });
          } else {
            throw new Error('Failed to switch to BNB Chain. Switch manually in MetaMask.');
          }
        }
      }

      setAccount(accounts[0]);

      window.ethereum.on('accountsChanged', (accounts) => {
        setAccount(accounts[0] || '');
        if (!accounts[0]) setConnectionError('Account disconnected');
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });

    } catch (error) {
      console.error('❌ Connection error:', error);
      setConnectionError(error.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  };

  const loadDashboardData = async () => {
    setDashboardError('');
    
    if (!isValidContractAddress(CONTRACT_ADDRESS)) {
      const errorMsg = 'DAO contract not configured. Add REACT_APP_DAO_CONTRACT_ADDRESS to .env file';
      console.warn('⚠️', errorMsg);
      setDashboardError(errorMsg);
      setProposals([]);
      setLoading(false);
      return;
    }

    if (!account || !ethers.isAddress(account)) {
      console.warn('⚠️ Invalid account address');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      if (!window.ethereum) {
        throw new Error('MetaMask not found');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      
      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (code === '0x') {
        throw new Error(`No contract deployed at ${CONTRACT_ADDRESS.slice(0, 10)}...`);
      }

      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

      const [reputation, voteCount, totalCount, propCount, week, activeTheme] = await Promise.all([
        contract.userReputation(account).catch(() => 0n),
        contract.userVoteCount(account).catch(() => 0n),
        contract.totalVoterCount().catch(() => 0n),
        contract.proposalCount().catch(() => 0n),
        contract.currentWeek().catch(() => 0n),
        contract.activeWeeklyTheme().catch(() => 0n),
      ]);

      setUserReputation(Number(reputation));
      setUserVoteCount(Number(voteCount));
      setTotalVoters(Number(totalCount));
      setProposalCount(Number(propCount));
      setCurrentWeek(Number(week));
      setActiveWeeklyTheme(Number(activeTheme));

      const proposalsList = [];
      for (let i = 1; i <= Number(propCount); i++) {
        try {
          const p = await contract.getProposal(i);
          proposalsList.push({
            id: Number(p.id),
            proposer: p.proposer,
            proposalType: Number(p.proposalType),
            title: p.title,
            description: p.description,
            ipfsHash: p.ipfsHash,
            votesFor: Number(p.votesFor),
            votesAgainst: Number(p.votesAgainst),
            votesAbstain: Number(p.votesAbstain),
            endTime: Number(p.endTime),
            executionTime: Number(p.executionTime),
            status: Number(p.status),
          });
        } catch (err) {
          console.error(`Error loading proposal ${i}:`, err);
        }
      }
      setProposals(proposalsList.reverse());
      setDashboardError('');
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setDashboardError(error.message || 'Failed to load DAO data');
    } finally {
      setLoading(false);
    }
  };

  const filteredProposals = filterType === 'all'
    ? proposals
    : proposals.filter(p => p.proposalType === parseInt(filterType));

  const shortAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  const PROPOSAL_TYPES = [
    { value: 'all', label: 'All' },
    { value: '0', label: 'Weekly Theme' },
    { value: '1', label: 'Research' },
    { value: '2', label: 'Community' },
    { value: '3', label: 'Knowledge' },
    { value: '4', label: 'Collaboration' },
  ];

  // Render continues in next file due to size...
  // This shows the critical fixes for governance params
  
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
      {/* Pass governanceParams to CreateProposalForm */}
      {showCreateForm && (
        <CreateProposalForm
          contractAddress={CONTRACT_ADDRESS}
          userReputation={userReputation}
          governanceParams={governanceParams}  // ✅ Pass params
          isPaused={isPaused}                   // ✅ Pass pause status
          onSuccess={() => {
            setShowCreateForm(false);
            loadDashboardData();
          }}
        />
      )}
      
      {/* Pass executionDelay to ProposalCard */}
      {filteredProposals.map(proposal => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          contractAddress={CONTRACT_ADDRESS}
          userAddress={account}
          executionDelay={governanceParams.executionDelay}  // ✅ Pass execution delay
          isPaused={isPaused}                               // ✅ Pass pause status
          onVoteSuccess={loadDashboardData}
        />
      ))}
    </div>
  );
};

export default DAODashboard;