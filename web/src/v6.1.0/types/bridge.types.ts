import Web3 from 'web3'
import { RegisteredSubscription } from 'web3/lib/commonjs/eth.exports'
import { TIP3Wallet } from '../../blockchain/tip3wallet'

export enum EBridgeNetwork {
    ETH = 'eth',
    GOSH = 'gosh',
}

export type TBridgeTransferStatusItem = {
    type: 'awaiting' | 'pending' | 'completed'
    message: string
}

export type TBridgeTransferData = {
    web3: {
        instance: Web3<RegisteredSubscription> | null
        address: string
    }
    gosh: {
        instance: TIP3Wallet | null
        address: string
    }
    networks: {
        [key: string]: { label: string; token: string; balance: number; iconpath: string }
    }
    summary: {
        from: {
            network: string
            address: string
            amount: string
        }
        to: {
            network: string
            address: string
            amount: string
        }
        progress: TBridgeTransferStatusItem[]
    }
    step: 'route' | 'transfer' | 'complete'
}
