import { Account, AccountRunOptions } from '@eversdk/appkit'
import { KeyPair, ResultOfProcessMessage } from '@eversdk/core'
import { TDaoDetails } from './dao.types'

export type TUserStatePersist = {
    phrase?: string
    nonce?: string
    pin?: string
}

export type TUserState = TUserStatePersist & {
    keys?: KeyPair
}

export type TGoshWalletDetails = {
    address: string
    keys?: KeyPair
    daoAddress: string
}

export type TGoshRepoDetails = {
    address: string
    name: string
    branches: TGoshBranch[]
    head: string
    tags: TGoshTagDetails[]
}

export type TGoshTagDetails = {
    commit: string
    content: string
}

export type TSmvBalanceDetails = {
    balance: number
    smvBalance: number
    smvLocked: number
    smvBusy: boolean
}

export type TGoshEventDetails = {
    address: string
    id: string
    params: any
    time: { start: Date; finish: Date }
    votes: { yes: number; no: number }
    status: { completed: boolean; accepted: boolean }
}

export type TGoshBranch = {
    name: string
    commitAddr: string
    isProtected: boolean
}

export type TGoshCommitContent = {
    tree: string
    author: string
    committer: string
    title: string
    message: string
}

export type TGoshCommit = {
    addr: string
    addrRepo: string
    branch: string
    name: string
    content: TGoshCommitContent
    parents: string[]
}

export type TGoshCommitDetails = {
    address: string
    repoAddress: string
    branch: string
    name: string
    content: TGoshCommitContent
    parents: string[]
}

export type TGoshTreeItem = {
    flags: number
    mode: '040000' | '100644' | string
    type: 'tree' | 'blob' | 'blobExecutable' | 'link'
    sha1: string
    sha256: string
    path: string
    name: string
}

export type TGoshTree = {
    [key: string]: TGoshTreeItem[]
}

export type TGoshDiff = {
    snap: string
    patch: string | null
    ipfs: string | null
    commit: string
    sha1: string
    sha256: string
}

export type TCreateCommitCallbackParams = {
    diffsPrepare?: boolean
    treePrepare?: boolean
    treeDeploy?: boolean
    commitDeploy?: boolean
    tagsDeploy?: boolean
    completed?: boolean
}

export interface ICreateCommitCallback {
    (params: TCreateCommitCallbackParams): void
}

export enum EGoshBlobFlag {
    BINARY = 1,
    COMPRESSED = 2,
    IPFS = 4,
}

export enum EEventType {
    PR = 1,
    BRANCH_LOCK = 2,
    BRANCH_UNLOCK = 3,
}

export interface IContract {
    abi: any
    tvc?: string
    account: Account

    run(
        functionName: string,
        input: object,
        options?: AccountRunOptions,
        writeLog?: boolean,
    ): Promise<ResultOfProcessMessage>
}

export interface IGoshRoot extends IContract {
    address: string

    getGosh(version: string): Promise<IGosh>
}

export interface IGosh extends IContract {
    address: string

    deployProfile(pubkey: string): Promise<IGoshProfile>
    getDaoAddr(name: string): Promise<string>
    getDaoWalletCode(profileAddr: string): Promise<string>
    getRepoAddr(name: string, daoName: string): Promise<string>
    getDaoRepoCode(daoAddr: string): Promise<string>
    getSmvPlatformCode(): Promise<string>
    getContentAddr(
        daoName: string,
        repoName: string,
        commitHash: string,
        label: string,
    ): Promise<string>
    getTvmHash(data: string | Buffer): Promise<string>
    getProfileAddr(pubkey: string): Promise<string>
}

export interface IGoshProfile extends IContract {
    address: string

    setGosh(goshAddr: string): Promise<void>
    deployDao(name: string, prevAddr?: string): Promise<IGoshDao>
    deployWallet(daoAddr: string, profileAddr: string): Promise<IGoshWallet>
    turnOn(walletAddr: string, pubkey: string): Promise<void>
}

export interface IGoshDao extends IContract {
    address: string

    getDetails(): Promise<TDaoDetails>
    getWalletAddr(profileAddr: string, index: number): Promise<string>
    getWallets(): Promise<string[]>
    getName(): Promise<string>
    getSmvRootTokenAddr(): Promise<string>
    getSmvProposalCode(): Promise<string>
    getSmvClientCode(): Promise<string>
    mint(amount: number, recipient: string, daoOwnerKeys: KeyPair): Promise<void>
}

export interface IGoshWallet extends IContract {
    address: string
    isDaoParticipant: boolean

    getDao(): Promise<IGoshDao>
    getGosh(version: string): Promise<IGosh>
    getSmvLocker(): Promise<IGoshSmvLocker>
    createCommit(
        repo: IGoshRepository,
        branch: TGoshBranch,
        pubkey: string,
        blobs: {
            name: string
            modified: string | Buffer
            original?: string | Buffer
            isIpfs?: boolean
            treeItem?: TGoshTreeItem
        }[],
        message: string,
        tags?: string,
        parent2?: TGoshBranch,
        callback?: ICreateCommitCallback,
    ): Promise<void>

    getDaoAddr(): Promise<string>
    getRootAddr(): Promise<string>
    getPubkey(): Promise<string>
    deployRepo(name: string, prevAddr?: string): Promise<void>
    deployBranch(
        repo: IGoshRepository,
        newName: string,
        fromName: string,
        fromCommit: string,
    ): Promise<void>
    deleteBranch(repo: IGoshRepository, branchName: string): Promise<void>
    deployCommit(
        repo: IGoshRepository,
        branch: TGoshBranch,
        commitName: string,
        commitContent: string,
        parentAddrs: string[],
        treeAddr: string,
        upgrade: boolean,
        diffs: TGoshDiff[],
    ): Promise<void>
    deployTree(repo: IGoshRepository, items: TGoshTreeItem[]): Promise<string>
    deployTag(repo: IGoshRepository, commitName: string, content: string): Promise<void>
    deployNewSnapshot(
        repoAddr: string,
        branchName: string,
        commitName: string,
        filename: string,
        data: string,
        ipfs: string | null,
    ): Promise<string>
    deleteSnapshot(addr: string): Promise<void>
    getSnapshotCode(branch: string, repoAddr: string): Promise<string>
    getSnapshotAddr(
        repoAddr: string,
        branchName: string,
        filename: string,
    ): Promise<string>
    setCommit(
        repoName: string,
        branchName: string,
        commitName: string,
        filesCount: number,
    ): Promise<void>
    startProposalForSetCommit(
        repoName: string,
        branchName: string,
        commitName: string,
        filesCount: number,
    ): Promise<void>
    startProposalForAddProtectedBranch(
        repoName: string,
        branchName: string,
    ): Promise<void>
    startProposalForDeleteProtectedBranch(
        repoName: string,
        branchName: string,
    ): Promise<void>
    getSmvLockerAddr(): Promise<string>
    getSmvTokenBalance(): Promise<number>
    getSmvClientAddr(lockerAddr: string, proposalId: string): Promise<string>
    lockVoting(amount: number): Promise<void>
    unlockVoting(amount: number): Promise<void>
    voteFor(
        platformCode: string,
        clientCode: string,
        proposalAddr: string,
        choice: boolean,
        amount: number,
    ): Promise<void>
    tryProposalResult(proposalAddr: string): Promise<void>
    updateHead(): Promise<void>
    getDiffAddr(
        repoName: string,
        commitName: string,
        index1: number,
        index2: number,
    ): Promise<string>
    setHead(repoName: string, branch: string): Promise<void>
    deployContent(
        repoName: string,
        commitName: string,
        label: string,
        content: string,
    ): Promise<void>
    getContentAdress(repoName: string, commitName: string, label: string): Promise<string>
}

export interface IGoshRepository extends IContract {
    address: string
    meta?: {
        name: string
        branchCount: number
        tags: {
            content: string
            commit: string
        }[]
    }

    load(): Promise<void>
    getGosh(): Promise<IGosh>
    getName(): Promise<string>
    getBranches(): Promise<TGoshBranch[]>
    getBranch(name: string): Promise<TGoshBranch>
    getHead(): Promise<string>
    getCommitAddr(commitSha: string): Promise<string>
    getBlobAddr(blobName: string): Promise<string>
    getTagCode(): Promise<string>
    getTags(): Promise<{ content: string; commit: string }[]>
    getGoshAddr(): Promise<string>
    getSnapshotCode(branch: string): Promise<string>
    getSnapshotAddr(branch: string, filename: string): Promise<string>
    getTreeAddr(treeName: string): Promise<string>
    getDiffAddr(commitName: string, index1: number, index2: number): Promise<string>
    isBranchProtected(branch: string): Promise<boolean>
}

export interface IGoshCommit extends IContract {
    address: string
    meta?: {
        repoAddr: string
        branchName: string
        sha: string
        content: TGoshCommitContent
        parents: string[]
    }

    load(): Promise<void>
    getDetails(): Promise<TGoshCommitDetails>
    getCommit(): Promise<any>
    getName(): Promise<string>
    getParents(): Promise<string[]>
    getBlobs(): Promise<string[]>
    getTree(): Promise<string>
    getDiffAddr(index1: number, index2: number): Promise<string>
}

export interface IGoshDiff extends IContract {
    address: string

    getNextAddr(): Promise<string>
    getDiffs(): Promise<TGoshDiff[]>
}

export interface IGoshSnapshot extends IContract {
    address: string

    getName(): Promise<string>
    getSnapshot(
        commitName: string,
        treeItem: TGoshTreeItem,
    ): Promise<{ content: string | Buffer; patched: string; isIpfs: boolean }>
    getRepoAddr(): Promise<string>
}

export interface IGoshTree extends IContract {
    address: string

    getTree(): Promise<{ tree: TGoshTreeItem[]; ipfs: string }>
    getSha(): Promise<any>
}

export interface IGoshTag extends IContract {
    address: string
    meta?: {
        content: string
    }

    load(): Promise<void>
    getCommit(): Promise<string>
    getContent(): Promise<string>
}

export interface IGoshContentSignature extends IContract {
    address: string

    getContent(): Promise<string>
}

export interface IGoshSmvProposal extends IContract {
    address: string
    meta?: {
        id: string
        votes: { yes: number; no: number }
        time: { start: Date; finish: Date }
        isCompleted: boolean | null
        commit: {
            kind: string
            repoName: string
            branchName: string
            commitName: string
        }
    }

    load(): Promise<void>
    getDetails(): Promise<TGoshEventDetails>
    getId(): Promise<string>
    getVotes(): Promise<{ yes: number; no: number }>
    getTime(): Promise<{ start: Date; finish: Date }>
    getGoshSetCommitProposalParams(): Promise<any>
    getGoshAddProtectedBranchProposalParams(): Promise<any>
    getGoshDeleteProtectedBranchProposalParams(): Promise<any>
    getLockerAddr(): Promise<string>
    isCompleted(): Promise<boolean | null>
}

export interface IGoshSmvLocker extends IContract {
    address: string
    meta?: {
        votesTotal: number
        votesLocked: number
        isBusy: boolean
    }

    load(): Promise<void>
    getVotes(): Promise<{ total: number; locked: number }>
    getIsBusy(): Promise<boolean>
}

export interface IGoshSmvClient extends IContract {
    address: string

    getLockedAmount(): Promise<number>
}

export interface IGoshSmvTokenRoot extends IContract {
    address: string

    getTotalSupply(): Promise<number>
}