#!/bin/bash
set -e

export NETWORK="${NETWORK:-http://192.168.31.227}"
#export NETWORK=http://172.16.0.62
SE_GIVER_ADDRESS="0:ece57bcc6c530283becbbd8a3b24d3c5987cdddc3c8b7b33be6e4a6312490415"
SE_GIVER_ABI="../../tests/node_se_scripts/local_giver.abi.json"
SE_GIVER_KEYS="../../tests/node_se_scripts/local_giver.keys.json"
GIVER_VALUE=20000000000000000

echo "NETWORK=$NETWORK"

cd ../contracts/multisig

make generate-docker
export GIVER_ADDR=`cat Giver.addr`
echo "GIVER_ADDR = $GIVER_ADDR"

gosh-cli config -e localhost
gosh-cli callx --abi $SE_GIVER_ABI --addr $SE_GIVER_ADDRESS --keys $SE_GIVER_KEYS -m sendTransaction --value $GIVER_VALUE --bounce false --dest $GIVER_ADDR

make deploy-docker


# deploy giver for upgrade

cd ../v1.0.0/gosh
echo "" > gosh.seed
echo "" > VersionController.addr
echo "" > SystemContract.addr
echo "" > SystemContract-1.0.0.addr

#sed -i 's/1 minutes/1 seconds/' modifiers/modifiers.sol
#proposal_period=$(cat modifiers/modifiers.sol | grep SET_UPGRADE_PROPOSAL_START_AFTER | cut -d '=' -f 2)
#if [ $proposal_period != " 1 seconds;" ]; then
#  echo "Failed to change proposal period"
#  exit 1
#fi

#make build
make deploy-docker

#sed -i 's/1 seconds/1 minutes/' modifiers/modifiers.sol
