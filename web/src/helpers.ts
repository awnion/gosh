import { builderOpBitString, NetworkQueriesProtocol, TonClient } from '@eversdk/core';
import { toast } from 'react-toastify';
import cryptoJs, { SHA1, SHA256 } from 'crypto-js';
import { Buffer } from 'buffer';
import { GoshTree, GoshCommit, GoshDaoCreator, GoshRoot } from './types/classes';
import { IGoshRepository, TGoshCommit, TGoshTree, TGoshTreeItem } from './types/types';
import * as Diff from 'diff';
// import LightningFS from '@isomorphic-git/lightning-fs';
// import { EGoshError, GoshError } from './types/errors';

// export const fs = new LightningFS('app.gosh');

export const ZERO_ADDR =
    '0:0000000000000000000000000000000000000000000000000000000000000000';
export const ZERO_COMMIT = '0000000000000000000000000000000000000000';
export const MAX_ONCHAIN_FILE_SIZE = 15360;
export const MAX_ONCHAIN_DIFF_SIZE = 15000;

export const goshClient = new TonClient({
    network: {
        endpoints: process.env.REACT_APP_GOSH_NETWORK?.split(','),
        queries_protocol: NetworkQueriesProtocol.WS,
    },
});
export const goshDaoCreator = new GoshDaoCreator(
    goshClient,
    process.env.REACT_APP_CREATOR_ADDR || ''
);
export const goshRoot = new GoshRoot(goshClient, process.env.REACT_APP_GOSH_ADDR || '');

export const getPaginatedAccounts = async (params: {
    filters?: string[];
    result?: string[];
    limit?: number;
    lastId?: string;
}): Promise<{ results: any[]; lastId?: string; completed: boolean }> => {
    const { filters = [], result = ['id'], limit = 10, lastId = null } = params;
    const query = `query AccountsQuery( $lastId: String, $limit: Int) {
        accounts(
            filter: {
                id: { gt: $lastId },
                ${filters.join(',')}
            }
            orderBy: [{ path: "id", direction: ASC }]
            limit: $limit
        ) {
            ${result.join(' ')}
        }
    }`;
    const response = await goshClient.net.query({ query, variables: { lastId, limit } });
    const results = response.result.data.accounts;
    return {
        results,
        lastId: results.length ? results[results.length - 1].id : undefined,
        completed: results.length < limit,
    };
};

// export const getEndpoints = (): string[] => {
//     switch (process.env.REACT_APP_EVER_NETWORK) {
//         case 'devnet':
//             return ['https://vps23.ton.dev'];
//         case 'mainnet':
//             return ['https://network.gosh.sh'];
//         case 'se':
//         default:
//             return ['http://localhost'];
//     }
// };

// export const fsExists = async (pathname: string): Promise<boolean> => {
//     try {
//         await fs.promises.stat(pathname);
//         return true;
//     } catch (e: any) {
//         if (e.code === 'ENOENT' || e.code === 'ENOTDIR') {
//             return false;
//         } else {
//             console.debug('Unhandled error in `fs.exists()`', e);
//             throw e;
//         }
//     }
// };

// export const getGoshDaoCreator = (client: TonClient): IGoshDaoCreator => {
//     const address = process.env.REACT_APP_CREATOR_ADDR;
//     if (!address) throw new GoshError(EGoshError.NO_CREATOR_ADDR);
//     return new GoshDaoCreator(client, address);
// };

export const getCodeLanguageFromFilename = (monaco: any, filename: string): string => {
    let splitted = filename.split('.');
    const ext = `.${splitted.slice(-1)}`;
    const found = monaco.languages
        .getLanguages()
        .find((item: any) => item.extensions && item.extensions.indexOf(ext) >= 0);
    return found?.id || 'plaintext';
};

/**
 * Convert from nanoevers to evers
 * @param value
 * @param round
 * @returns
 */
export const toEvers = (value: any, round: number = 3): number => {
    const rounder = 10 ** round;
    return Math.round((value / 10 ** 9) * rounder) / rounder;
};

/**
 * Convert from evers to nanoevers
 * @param value
 * @returns
 */
export const fromEvers = (value: number): number => {
    return value * 10 ** 9;
};

export const isMainBranch = (branch: string = 'main'): boolean =>
    ['master', 'main'].indexOf(branch) >= 0;

export const sha1 = (
    data: string | Buffer,
    type: 'blob' | 'commit' | 'tree' | 'tag',
    mode: 'sha1' | 'sha256'
): string => {
    let content = data;

    const size = Buffer.isBuffer(content)
        ? content.byteLength
        : Buffer.from(content, 'utf-8').byteLength;

    let words = cryptoJs.enc.Utf8.parse(`${type} ${size}\0`);
    words.concat(
        Buffer.isBuffer(content)
            ? cryptoJs.enc.Hex.parse(content.toString('hex'))
            : cryptoJs.enc.Utf8.parse(content)
    );

    let hash;
    if (mode === 'sha1') hash = SHA1(words);
    if (mode === 'sha256') hash = SHA256(words);
    if (!hash) throw new Error('Could not calculate hash');
    // const hash = SHA1(words);
    return hash.toString();
};

export const sha1Tree = (items: TGoshTreeItem[], mode: 'sha1' | 'sha256') => {
    const buffer = Buffer.concat(
        items
            //@ts-ignore
            .sort((a: any, b: any) => (a.name > b.name) - (a.name < b.name))
            .map((i) =>
                Buffer.concat([
                    Buffer.from(`${i.mode === '040000' ? '40000' : i.mode} ${i.name}\0`),
                    Buffer.from(i.sha1, 'hex'),
                ])
            )
    );
    return sha1(buffer, 'tree', mode);
};

export const getTreeItemsFromPath = async (
    fullpath: string,
    content: string | Buffer,
    flags: number,
    ipfs: string | null
): Promise<TGoshTreeItem[]> => {
    const items: TGoshTreeItem[] = [];

    // Get blob sha, path and name and push it to items
    let [path, name] = splitByPath(fullpath);
    const sha = sha1(content, 'blob', 'sha1');

    // const sha256 = sha1(fileContent, 'blob', 'sha256');
    const sha256 = await tvmHash(ipfs || (content as string));

    items.push({
        flags,
        mode: '100644',
        type: 'blob',
        sha1: sha,
        sha256: `0x${sha256}`,
        path,
        name,
    });

    // Parse blob path and push subtrees to items
    while (path !== '') {
        const [dirPath, dirName] = splitByPath(path);
        if (!items.find((item) => item.path === dirPath && item.name === dirName)) {
            items.push({
                flags: 0,
                mode: '040000',
                type: 'tree',
                sha1: '',
                sha256: '',
                path: dirPath,
                name: dirName,
            });
        }
        path = dirPath;
    }
    return items;
};

/** Build grouped by path tree from TGoshTreeItem[] */
export const getTreeFromItems = (items: TGoshTreeItem[]): TGoshTree => {
    const isTree = (i: TGoshTreeItem) => i.type === 'tree';

    const result = items.filter(isTree).reduce(
        (acc: TGoshTree, i) => {
            const path = i.path !== '' ? `${i.path}/${i.name}` : i.name;
            if (!acc.path) acc[path] = [];
            return acc;
        },
        { '': [] }
    );

    items.forEach((i: any) => {
        result[i.path].push(i);
    });
    return result;
};

/**
 * Get repository tree for specific commit
 * @param repo
 * @param commitAddr
 * @param filterPath Load only part of tree with provided path. Full tree will be loaded if `undefined`
 * @returns
 */
export const getRepoTree = async (
    repo: IGoshRepository,
    commitAddr: string,
    filterPath?: string
): Promise<{ tree: TGoshTree; items: TGoshTreeItem[] }> => {
    /** Recursive walker through tree blobs */
    const blobTreeWalker = async (path: string, subitems: TGoshTreeItem[]) => {
        let trees = subitems.filter((item) => item.type === 'tree');

        if (filterPath) {
            let [_path] = splitByPath(filterPath);
            const filtered: string[] = [filterPath, _path];
            while (_path !== '') {
                const [__path] = splitByPath(_path);
                filtered.push(__path);
                _path = __path;
            }

            trees = trees.filter(
                (item) =>
                    filtered.indexOf(`${item.path ? `${item.path}/` : ''}${item.name}`) >=
                    0
            );
        }

        for (let i = 0; i < trees.length; i++) {
            const tree = trees[i];
            const treeAddr = await goshRoot.getTreeAddr(repo.address, tree.sha1);
            const treeBlob = new GoshTree(goshClient, treeAddr);

            const treeItems = (await treeBlob.getTree()).tree;
            const treePath = `${path ? `${path}/` : ''}${tree.name}`;

            treeItems.forEach((item) => (item.path = treePath));
            items.push(...treeItems);
            await new Promise((resolve) => setInterval(resolve, 150));
            await blobTreeWalker(treePath, treeItems);
        }
    };

    // Get latest branch commit
    if (!commitAddr) return { tree: { '': [] }, items: [] };
    const commit = new GoshCommit(goshClient, commitAddr);
    const commitName = await commit.getName();

    // Get root tree items and recursively get subtrees
    let items: TGoshTreeItem[] = [];
    if (commitName !== ZERO_COMMIT) {
        const rootTreeAddr = await commit.getTree();
        const rootTree = new GoshTree(goshClient, rootTreeAddr);
        items = (await rootTree.getTree()).tree;
    }
    if (filterPath !== '') await blobTreeWalker('', items);

    // Build full tree
    const tree = getTreeFromItems(items);
    console.debug('[Helpers: getRepoTree] - Tree:', tree);
    return { tree, items };
};

/**
 * Sort the hole tree by the longest key (this key will contain blobs only),
 * calculate each subtree sha and update subtree parent item
 */
export const calculateSubtrees = (tree: TGoshTree) => {
    Object.keys(tree)
        .sort((a, b) => b.length - a.length)
        .filter((key) => key.length)
        .forEach((key) => {
            const [path, name] = splitByPath(key);
            const found = tree[path].find(
                (item) => item.path === path && item.name === name
            );
            if (found) {
                found.sha1 = sha1Tree(tree[key], 'sha1');
                // found.sha256 = sha1Tree(tree[key], 'sha256');
                found.sha256 = `0x${sha1Tree(tree[key], 'sha256')}`;
            }
        });
};

export const getBlobDiffPatch = (
    filename: string,
    modified: string,
    original: string
) => {
    /** Git like patch representation */
    // let patch = Diff.createTwoFilesPatch(
    //     `a/${filename}`,
    //     `b/${filename}`,
    //     original,
    //     modified
    // );
    // patch = patch.split('\n').slice(1).join('\n');

    // const shaOriginal = original ? sha1(original, 'blob') : '0000000';
    // const shaModified = modified ? sha1(modified, 'blob') : '0000000';
    // patch =
    //     `index ${shaOriginal.slice(0, 7)}..${shaModified.slice(0, 7)} 100644\n` + patch;

    // if (!original) patch = patch.replace(`a/${filename}`, '/dev/null');
    // if (!modified) patch = patch.replace(`b/${filename}`, '/dev/null');

    /** Gosh snapshot recommended patch representation */
    const patch = Diff.createPatch(filename, original, modified);
    return patch.split('\n').slice(4).join('\n');
};

export const getCommit = async (
    repo: IGoshRepository,
    commitAddr: string
): Promise<TGoshCommit> => {
    const commit = new GoshCommit(repo.account.client, commitAddr);
    const meta = await commit.getCommit();
    const commitData = {
        addr: commitAddr,
        addrRepo: meta.repo,
        branch: meta.branch,
        name: meta.sha,
        content: meta.content,
        parents: meta.parents,
    };

    return {
        ...commitData,
        content: GoshCommit.parseContent(commitData.content),
    };
};

/** Split file path to path and file name */
export const splitByPath = (fullPath: string): [path: string, name: string] => {
    const lastSlashIndex = fullPath.lastIndexOf('/');
    const path = lastSlashIndex >= 0 ? fullPath.slice(0, lastSlashIndex) : '';
    const name = lastSlashIndex >= 0 ? fullPath.slice(lastSlashIndex + 1) : fullPath;
    return [path, name];
};

export const unixtimeWithTz = (): string => {
    const pad = (num: number): string => (num < 10 ? '0' : '') + num;
    const unixtime = Math.floor(Date.now() / 1000);
    const tzo = -new Date().getTimezoneOffset();
    const dif = tzo >= 0 ? '+' : '-';
    return [
        `${unixtime} ${dif}`,
        pad(Math.floor(Math.abs(tzo) / 60)),
        pad(Math.abs(tzo) % 60),
    ].join('');
};

export const getCommitTime = (str: string): Date => {
    const [unixtime] = str.split(' ').slice(-2);
    return new Date(+unixtime * 1000);
};

export const generateRandomBytes = async (
    client: TonClient,
    length: number,
    hex: boolean = false
): Promise<string> => {
    const result = await client.crypto.generate_random_bytes({ length });
    if (hex) return Buffer.from(result.bytes, 'base64').toString('hex');
    return result.bytes;
};

export const chacha20 = {
    async encrypt(
        client: TonClient,
        data: string,
        key: string,
        nonce: string
    ): Promise<string> {
        const result = await client.crypto.chacha20({
            data,
            key: key.padStart(64, '0'),
            nonce,
        });
        return result.data;
    },
    async decrypt(
        client: TonClient,
        data: string,
        key: string,
        nonce: string
    ): Promise<string> {
        const result = await client.crypto.chacha20({
            data,
            key: key.padStart(64, '0'),
            nonce,
        });
        return result.data;
    },
};

export const zstd = {
    async compress(client: TonClient, data: string | Buffer): Promise<string> {
        const uncompressed = Buffer.isBuffer(data)
            ? data.toString('base64')
            : Buffer.from(data).toString('base64');
        const result = await client.utils.compress_zstd({
            uncompressed,
        });
        return result.compressed;
    },
    async decompress(
        client: TonClient,
        data: string,
        uft8: boolean = true
    ): Promise<string> {
        const result = await client.utils.decompress_zstd({ compressed: data });
        if (uft8) return Buffer.from(result.decompressed, 'base64').toString();
        return result.decompressed;
    },
};

/**
 * @link https://docs.ipfs.io/reference/http/api/#api-v0-add
 * @param content
 * @param filename
 * @returns
 */
export const saveToIPFS = async (content: string, filename?: string): Promise<string> => {
    if (!process.env.REACT_APP_IPFS) throw new Error('IPFS url undefined');

    const form = new FormData();
    const blob = new Blob([content]);
    form.append('file', blob, filename);

    const response = await fetch(
        `${process.env.REACT_APP_IPFS}/api/v0/add?pin=true&quiet=true`,
        { method: 'POST', body: form }
    );

    if (!response.ok)
        throw new Error(`Error while uploading (${JSON.stringify(response)})`);
    const responseBody = await response.json();
    const { Hash: cid } = responseBody;
    return cid;
};

/**
 * @param cid
 * @returns
 */
export const loadFromIPFS = async (cid: string): Promise<Buffer> => {
    if (!process.env.REACT_APP_IPFS) throw new Error('IPFS url undefined');

    const response = await fetch(`${process.env.REACT_APP_IPFS}/ipfs/${cid.toString()}`, {
        method: 'GET',
    });

    if (!response.ok)
        throw new Error(`Error while uploading (${JSON.stringify(response)})`);
    return Buffer.from(await response.arrayBuffer());
};

export const tvmHash = async (data: string): Promise<string> => {
    const boc = await goshClient.boc.encode_boc({
        builder: [builderOpBitString(Buffer.from(data).toString('hex'))],
    });
    const hash = await goshClient.boc.get_boc_hash({ boc: boc.boc });
    return hash.hash;
};

/**
 * Toast shortcuts
 */
export const ToastOptionsShortcuts = {
    Default: {
        position: toast.POSITION.TOP_RIGHT,
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        pauseOnFocusLoss: false,
        draggable: true,
        closeButton: true,
        progress: undefined,
    },
    Message: {
        position: toast.POSITION.TOP_CENTER,
        autoClose: 1500,
        pauseOnFocusLoss: false,
        pauseOnHover: false,
        closeButton: false,
        hideProgressBar: true,
    },
    CopyMessage: {
        position: toast.POSITION.TOP_CENTER,
        autoClose: 1500,
        pauseOnFocusLoss: false,
        pauseOnHover: false,
        closeButton: false,
        hideProgressBar: true,
        style: { width: '50%' },
        className: 'mx-auto',
    },
};
