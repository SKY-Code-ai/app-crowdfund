import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

// Your contract ABI (replace with actual ABI after deployment)
const CONTRACT_ABI = [
  "function createProject(string memory _title, string memory _description, uint256 _goalAmount, uint256 _durationInDays) public",
  "function contribute(uint256 _projectId) public payable",
  "function withdrawFunds(uint256 _projectId) public",
  "function getRefund(uint256 _projectId) public",
  "function getAllProjects() public view returns (tuple(uint256 id, string title, string description, address creator, uint256 goalAmount, uint256 raisedAmount, uint256 deadline, bool isActive, bool goalReached)[])",
  "function getUserContribution(uint256 _projectId, address _user) public view returns (uint256)",
  "function getTimeRemaining(uint256 _projectId) public view returns (uint256)",
  "event ProjectCreated(uint256 indexed projectId, string title, address indexed creator, uint256 goalAmount, uint256 deadline)",
  "event ContributionMade(uint256 indexed projectId, address indexed contributor, uint256 amount)"
];

// Replace with your deployed contract address
const CONTRACT_ADDRESS = "0xd9145CCE52D386f254917e481eB44e9943F39138";

// Shardeum Unstable Testnet configuration
const SHARDEUM_NETWORK = {
  chainId: '0x1F90', // 8080 in hex
  chainName: 'Shardeum Sphinx 1.X',
  nativeCurrency: {
    name: 'Shardeum',
    symbol: 'SHM',
    decimals: 18,
  },
  rpcUrls: ['https://sphinx.shardeum.org/'],
  blockExplorerUrls: ['https://explorer-sphinx.shardeum.org/'],
};

function App() {
  // State variables
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    goalAmount: '',
    duration: ''
  });

  // Connect to MetaMask and switch to Shardeum
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      // Switch to Shardeum network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: SHARDEUM_NETWORK.chainId }],
        });
      } catch (switchError) {
        // Network not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [SHARDEUM_NETWORK],
          });
        }
      }

      // Setup provider and signer
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      setProvider(provider);
      setSigner(signer);
      setAccount(accounts[0]);

      // Initialize contract if address is provided
      if (CONTRACT_ADDRESS !== "") {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        setContract(contract);
        await loadProjects(contract);
      }

    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    }
  };

  // Load all projects from the contract
  const loadProjects = async (contractInstance = contract) => {
    if (!contractInstance) return;
    
    try {
      setLoading(true);
      const allProjects = await contractInstance.getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create a new project
  const createProject = async () => {
    if (!contract) return;

    try {
      setLoading(true);
      
      const goalAmountWei = ethers.utils.parseEther(newProject.goalAmount);
      const tx = await contract.createProject(
        newProject.title,
        newProject.description,
        goalAmountWei,
        parseInt(newProject.duration)
      );
      
      await tx.wait();
      alert('Project created successfully!');
      
      // Reset form and reload projects
      setNewProject({ title: '', description: '', goalAmount: '', duration: '' });
      setShowCreateForm(false);
      await loadProjects();
      
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  // Contribute to a project
  const contribute = async (projectId, amount) => {
    if (!contract || !amount) return;

    try {
      setLoading(true);
      
      const contributionAmount = ethers.utils.parseEther(amount);
      const tx = await contract.contribute(projectId, { value: contributionAmount });
      
      await tx.wait();
      alert('Contribution successful!');
      await loadProjects();
      
    } catch (error) {
      console.error('Error contributing:', error);
      alert('Failed to contribute');
    } finally {
      setLoading(false);
    }
  };

  // Withdraw funds (for project creators)
  const withdrawFunds = async (projectId) => {
    if (!contract) return;

    try {
      setLoading(true);
      
      const tx = await contract.withdrawFunds(projectId);
      await tx.wait();
      
      alert('Funds withdrawn successfully!');
      await loadProjects();
      
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      alert('Failed to withdraw funds');
    } finally {
      setLoading(false);
    }
  };

  // Get refund (for contributors)
  const getRefund = async (projectId) => {
    if (!contract) return;

    try {
      setLoading(true);
      
      const tx = await contract.getRefund(projectId);
      await tx.wait();
      
      alert('Refund processed successfully!');
      await loadProjects();
      
    } catch (error) {
      console.error('Error getting refund:', error);
      alert('Failed to get refund');
    } finally {
      setLoading(false);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (timestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const deadline = timestamp.toNumber();
    
    if (deadline <= now) return "Expired";
    
    const remaining = deadline - now;
    const days = Math.floor(remaining / (24 * 3600));
    const hours = Math.floor((remaining % (24 * 3600)) / 3600);
    
    return `${days}d ${hours}h remaining`;
  };

  // Calculate progress percentage
  const calculateProgress = (raised, goal) => {
    const raisedEth = parseFloat(ethers.utils.formatEther(raised));
    const goalEth = parseFloat(ethers.utils.formatEther(goal));
    return Math.min((raisedEth / goalEth) * 100, 100);
  };

  useEffect(() => {
    // Auto-connect if wallet was previously connected
    if (window.ethereum && window.ethereum.selectedAddress) {
      connectWallet();
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 Crowdfunding dApp</h1>
        <p>Decentralized Crowdfunding on Shardeum Unstablenet</p>
        
        {!account ? (
          <button className="connect-btn" onClick={connectWallet}>
            Connect MetaMask
          </button>
        ) : (
          <div className="wallet-info">
            <p>Connected: {account.substring(0, 6)}...{account.substring(38)}</p>
            <button 
              className="create-btn" 
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Cancel' : 'Create Project'}
            </button>
          </div>
        )}
      </header>

      <main className="App-main">
        {CONTRACT_ADDRESS === "0xd9145CCE52D386f254917e481eB44e9943F39138" && (
          <div>
            
          </div>
        )}

        {/* Create Project Form */}
        {showCreateForm && (
          <div className="create-form">
            <h3>Create New Project</h3>
            <input
              type="text"
              placeholder="Project Title"
              value={newProject.title}
              onChange={(e) => setNewProject({...newProject, title: e.target.value})}
            />
            <textarea
              placeholder="Project Description"
              value={newProject.description}
              onChange={(e) => setNewProject({...newProject, description: e.target.value})}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Goal Amount (SHM)"
              value={newProject.goalAmount}
              onChange={(e) => setNewProject({...newProject, goalAmount: e.target.value})}
            />
            <input
              type="number"
              placeholder="Duration (days)"
              value={newProject.duration}
              onChange={(e) => setNewProject({...newProject, duration: e.target.value})}
            />
            <button 
              className="submit-btn" 
              onClick={createProject}
              disabled={loading || !newProject.title || !newProject.goalAmount}
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        )}

        {/* Projects Grid */}
        <div className="projects-container">
          <h2>All Projects ({projects.length})</h2>
          
          {loading && <p>Loading...</p>}
          
          {projects.length === 0 && !loading && (
            <p>No projects found. Create the first one!</p>
          )}
          
          <div className="projects-grid">
            {projects.map((project) => (
              <ProjectCard 
                key={project.id.toString()} 
                project={project}
                currentAccount={account}
                onContribute={contribute}
                onWithdraw={withdrawFunds}
                onRefund={getRefund}
                formatTimeRemaining={formatTimeRemaining}
                calculateProgress={calculateProgress}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// Project Card Component
function ProjectCard({ 
  project, 
  currentAccount, 
  onContribute, 
  onWithdraw, 
  onRefund,
  formatTimeRemaining,
  calculateProgress 
}) {
  const [contributionAmount, setContributionAmount] = useState('');
  
  const isCreator = currentAccount.toLowerCase() === project.creator.toLowerCase();
  const isExpired = Date.now() / 1000 >= project.deadline.toNumber();
  const progress = calculateProgress(project.raisedAmount, project.goalAmount);
  
  return (
    <div className="project-card">
      <h3>{project.title}</h3>
      <p className="description">{project.description}</p>
      
      <div className="project-stats">
        <div className="stat">
          <span className="label">Goal:</span>
          <span className="value">{ethers.utils.formatEther(project.goalAmount)} SHM</span>
        </div>
        <div className="stat">
          <span className="label">Raised:</span>
          <span className="value">{ethers.utils.formatEther(project.raisedAmount)} SHM</span>
        </div>
        <div className="stat">
          <span className="label">Creator:</span>
          <span className="value">
            {project.creator.substring(0, 6)}...{project.creator.substring(38)}
          </span>
        </div>
        <div className="stat">
          <span className="label">Status:</span>
          <span className={`status ${project.goalReached ? 'success' : isExpired ? 'expired' : 'active'}`}>
            {project.goalReached ? 'Goal Reached!' : isExpired ? 'Expired' : 'Active'}
          </span>
        </div>
        <div className="stat">
          <span className="label">Time:</span>
          <span className="value">{formatTimeRemaining(project.deadline)}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <p className="progress-text">{progress.toFixed(1)}% funded</p>

      {/* Action Buttons */}
      <div className="project-actions">
        {!isCreator && !isExpired && (
          <div className="contribute-section">
            <input
              type="number"
              step="0.01"
              placeholder="Amount (SHM)"
              value={contributionAmount}
              onChange={(e) => setContributionAmount(e.target.value)}
            />
            <button 
              className="contribute-btn"
              onClick={() => {
                onContribute(project.id, contributionAmount);
                setContributionAmount('');
              }}
              disabled={!contributionAmount || parseFloat(contributionAmount) <= 0}
            >
              Contribute
            </button>
          </div>
        )}
        
        {isCreator && project.goalReached && project.raisedAmount.gt(0) && (
          <button 
            className="withdraw-btn"
            onClick={() => onWithdraw(project.id)}
          >
            Withdraw Funds
          </button>
        )}
        
        {!isCreator && isExpired && !project.goalReached && (
          <button 
            className="refund-btn"
            onClick={() => onRefund(project.id)}
          >
            Get Refund
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});

const reportWebVitals = onPerfEntry => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

import '@testing-library/jest-dom';

