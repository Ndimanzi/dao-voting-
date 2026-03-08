import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
const DAO_CONTRACT_ADDRESS = process.env.REACT_APP_DAO_ADDRESS || "";

const DAO_ABI = [
  "function vote(uint256 id, bool support)",
  "function proposals(uint256) view returns (string description, uint256 votesFor, uint256 votesAgainst, bool executed)",
];

const sampleProposals = [
  { id: 0, title: "Treasury budget for Q2", votesFor: 42, votesAgainst: 9 },
  { id: 1, title: "Community grants round #4", votesFor: 27, votesAgainst: 5 },
  { id: 2, title: "Add delegate dashboard metrics", votesFor: 19, votesAgainst: 14 },
];

function formatAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getMetaMaskProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  const { ethereum } = window;
  if (!ethereum) {
    return null;
  }

  if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
    return ethereum.providers.find((provider) => provider.isMetaMask) || ethereum.providers[0];
  }

  return ethereum;
}

function toReadableChain(chainIdHex) {
  if (!chainIdHex) {
    return "N/A";
  }

  if (chainIdHex.toLowerCase() === SEPOLIA_CHAIN_ID_HEX) {
    return "sepolia";
  }

  return `chain ${parseInt(chainIdHex, 16)}`;
}

async function createEthersProvider(walletProvider) {
  if (typeof ethers.BrowserProvider === "function") {
    return new ethers.BrowserProvider(walletProvider);
  }

  throw new Error("Unsupported ethers version. Install ethers v6.");
}

async function ensureSepolia(walletProvider) {
  const currentChain = await walletProvider.request({ method: "eth_chainId" });
  if (currentChain?.toLowerCase() === SEPOLIA_CHAIN_ID_HEX) {
    return;
  }

  try {
    await walletProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
    });
  } catch (error) {
    if (error?.code === 4902) {
      throw new Error("Sepolia is not added in MetaMask. Add it, then try again.");
    }

    throw error;
  }
}

function getConnectErrorMessage(error) {
  if (!error) {
    return "Failed to connect wallet.";
  }

  if (error.code === 4001) {
    return "Connection request was rejected in MetaMask.";
  }

  if (error.code === -32002) {
    return "A MetaMask request is pending. Open MetaMask and complete it first.";
  }

  return error.message || "Failed to connect wallet.";
}

function getVoteErrorMessage(error) {
  if (!error) {
    return "Vote failed.";
  }

  if (error.code === 4001) {
    return "Vote transaction was rejected in MetaMask.";
  }

  if (error.code === -32002) {
    return "A MetaMask request is pending. Complete it before sending another vote.";
  }

  if (String(error.message || "").toLowerCase().includes("insufficient funds")) {
    return "Wallet has insufficient ETH for gas on Sepolia.";
  }

  return error.message || "Vote failed.";
}

function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [chainIdHex, setChainIdHex] = useState("");
  const [connectError, setConnectError] = useState("");
  const [voteError, setVoteError] = useState("");
  const [voteSuccess, setVoteSuccess] = useState("");
  const [proposalId, setProposalId] = useState("0");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVotingFor, setIsVotingFor] = useState(false);
  const [isVotingAgainst, setIsVotingAgainst] = useState(false);

  const walletStatus = useMemo(
    () => (walletAddress ? formatAddress(walletAddress) : "Not connected"),
    [walletAddress]
  );
  const networkLabel = useMemo(() => toReadableChain(chainIdHex), [chainIdHex]);

  useEffect(() => {
    const walletProvider = getMetaMaskProvider();
    if (!walletProvider) {
      return undefined;
    }

    let mounted = true;

    const syncState = async () => {
      try {
        const [accounts, chainId] = await Promise.all([
          walletProvider.request({ method: "eth_accounts" }),
          walletProvider.request({ method: "eth_chainId" }),
        ]);

        if (!mounted) {
          return;
        }

        setChainIdHex(chainId || "");
        if (accounts && accounts.length > 0) {
          setWalletAddress(accounts[0]);
        } else {
          setWalletAddress("");
        }
      } catch {
        if (mounted) {
          setWalletAddress("");
          setChainIdHex("");
        }
      }
    };

    const handleAccountsChanged = (accounts) => {
      if (!mounted) {
        return;
      }

      if (!accounts || accounts.length === 0) {
        setWalletAddress("");
        return;
      }

      setWalletAddress(accounts[0]);
    };

    const handleChainChanged = (nextChainId) => {
      if (!mounted) {
        return;
      }

      setChainIdHex(nextChainId || "");
    };

    syncState();
    walletProvider.on?.("accountsChanged", handleAccountsChanged);
    walletProvider.on?.("chainChanged", handleChainChanged);

    return () => {
      mounted = false;
      walletProvider.removeListener?.("accountsChanged", handleAccountsChanged);
      walletProvider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const connectWallet = async () => {
    if (isConnecting) {
      return;
    }

    try {
      setConnectError("");
      setIsConnecting(true);

      const walletProvider = getMetaMaskProvider();
      if (!walletProvider) {
        throw new Error("MetaMask is not installed in this browser.");
      }

      const accounts = await walletProvider.request({ method: "eth_requestAccounts" });
      const chainId = await walletProvider.request({ method: "eth_chainId" });

      if (!accounts || accounts.length === 0) {
        throw new Error("No wallet account returned by MetaMask.");
      }

      setWalletAddress(accounts[0]);
      setChainIdHex(chainId || "");
    } catch (error) {
      setConnectError(getConnectErrorMessage(error));
    } finally {
      setIsConnecting(false);
    }
  };

  const vote = async (support) => {
    const setLoading = support ? setIsVotingFor : setIsVotingAgainst;
    if (isVotingFor || isVotingAgainst) {
      return;
    }

    try {
      setVoteError("");
      setVoteSuccess("");
      setLoading(true);

      const walletProvider = getMetaMaskProvider();
      if (!walletProvider) {
        throw new Error("MetaMask is not installed.");
      }

      if (!walletAddress) {
        throw new Error("Connect your wallet first.");
      }

      if (!DAO_CONTRACT_ADDRESS || !ethers.isAddress(DAO_CONTRACT_ADDRESS)) {
        throw new Error("Set REACT_APP_DAO_ADDRESS to your deployed DAO contract address.");
      }

      const parsedId = Number.parseInt(proposalId, 10);
      if (!Number.isInteger(parsedId) || parsedId < 0) {
        throw new Error("Proposal ID must be a non-negative integer.");
      }

      await ensureSepolia(walletProvider);

      const provider = await createEthersProvider(walletProvider);
      const signer = await provider.getSigner();
      const dao = new ethers.Contract(DAO_CONTRACT_ADDRESS, DAO_ABI, signer);

      const tx = await dao.vote(parsedId, support);
      setVoteSuccess(`Transaction submitted: ${tx.hash}. Waiting for confirmation...`);

      await tx.wait();
      setVoteSuccess(`Vote confirmed onchain. Tx: ${tx.hash}`);
    } catch (error) {
      setVoteError(getVoteErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 md:px-10">
      <section className="mb-8 rounded-3xl border border-black/5 bg-white/65 p-7 shadow-panel backdrop-blur-sm animate-reveal md:p-10">
        <p className="mb-2 text-sm uppercase tracking-[0.2em] text-clay">DAO Governance Dashboard</p>
        <h1 className="font-title text-4xl text-ink md:text-5xl">Vote, track, and govern onchain</h1>
        <p className="mt-4 max-w-2xl text-sm text-ink/70 md:text-base">
          Connect MetaMask and cast votes directly on your DAO contract.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl bg-ink p-6 text-sand shadow-panel animate-reveal">
          <h2 className="font-title text-2xl">Active Proposals</h2>
          <div className="mt-5 space-y-4">
            {sampleProposals.map((proposal, index) => (
              <article
                key={proposal.id}
                className="rounded-2xl border border-white/15 bg-white/5 p-4"
                style={{ animationDelay: `${index * 110}ms` }}
              >
                <p className="text-xs uppercase tracking-wider text-mint">Proposal #{proposal.id}</p>
                <h3 className="mt-1 text-lg">{proposal.title}</h3>
                <div className="mt-3 flex gap-3 text-sm">
                  <span className="rounded-full bg-mint/20 px-3 py-1 text-mint">
                    For: {proposal.votesFor}
                  </span>
                  <span className="rounded-full bg-clay/20 px-3 py-1 text-[#ffb08f]">
                    Against: {proposal.votesAgainst}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-panel backdrop-blur-sm animate-reveal">
          <h2 className="font-title text-2xl text-ink">Wallet</h2>
          <p className="mt-2 text-sm text-ink/65">Status: {walletStatus}</p>
          <p className="text-sm text-ink/65">Network: {networkLabel}</p>
          <p className="mt-1 break-all text-xs text-ink/60">
            DAO: {DAO_CONTRACT_ADDRESS || "Set REACT_APP_DAO_ADDRESS in .env"}
          </p>

          <button
            type="button"
            onClick={connectWallet}
            disabled={isConnecting}
            className="mt-5 w-full rounded-2xl bg-clay px-4 py-3 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#c95f36] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isConnecting ? "Connecting..." : "Connect MetaMask"}
          </button>

          {connectError && (
            <p className="mt-4 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700">{connectError}</p>
          )}

          <div className="mt-6 border-t border-black/10 pt-5">
            <label htmlFor="proposalId" className="block text-sm font-medium text-ink/80">
              Proposal ID
            </label>
            <input
              id="proposalId"
              type="number"
              min="0"
              value={proposalId}
              onChange={(event) => setProposalId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-clay"
            />

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => vote(true)}
                disabled={isVotingFor || isVotingAgainst}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isVotingFor ? "Voting..." : "Vote For"}
              </button>
              <button
                type="button"
                onClick={() => vote(false)}
                disabled={isVotingFor || isVotingAgainst}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isVotingAgainst ? "Voting..." : "Vote Against"}
              </button>
            </div>

            {voteError && (
              <p className="mt-4 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700">{voteError}</p>
            )}
            {voteSuccess && (
              <p className="mt-4 rounded-xl bg-emerald-100 px-3 py-2 text-sm text-emerald-700">
                {voteSuccess}
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
