"""
Copy contracts ABIs to project.
"""

import sys
import json
from pathlib import Path


SRC_CONTRACTS_PATH = Path('../contracts')
DST_CONTRACTS_PATH = Path('./src/resources/contracts/abi.json')
CONTRACTS = [
    'gosh/root',
    'gosh/gosh',
    'gosh/goshdao',
    'gosh/profile',
    'gosh/profiledao',
    'gosh/goshwallet',
    'gosh/repository',
    'gosh/commit',
    'gosh/snapshot',
    'gosh/tag',
    'gosh/diff',
    'gosh/tree',
    'gosh/content-signature',
    'smv/SMVProposal',
    'smv/SMVTokenLocker',
    'smv/SMVClient',
    'smv/TokenRoot'
]


def main():
    """Entry point main"""

    [_, version] = sys.argv

    abis = {}
    if Path.exists(DST_CONTRACTS_PATH):
        abis = json.load(open(DST_CONTRACTS_PATH))

    if not abis.get(version):
        abis[version] = {}

    for contract in CONTRACTS:
        src = SRC_CONTRACTS_PATH / f'{contract}.abi.json'
        key = contract.replace('gosh/', '').replace('smv/', '').lower()
        if key in ['root', 'profile', 'profiledao']:
            abis[key] = json.load(open(src))
        else:
            abis[version][key] = json.load(open(src))

    json.dump(abis, open(DST_CONTRACTS_PATH, 'w'))


if __name__ == '__main__':
    main()