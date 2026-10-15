import { http, createConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

/**
 * Wagmi config for Allawii.
 *
 * BMONI's managed smart wallets anchor to an Ethereum address owned by the
 * user's browser wallet. We use the default injected connector (MetaMask,
 * WalletConnect, etc.) so the user signs the owner-proof challenge with
 * their own key — never server-side.
 *
 * The sandbox supports CNGN / USDB / EURe on the chains below; add more
 * chains here as BMONI expands coverage.
 */
export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});
