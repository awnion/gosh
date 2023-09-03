#!/bin/bash
set -e 
set -o pipefail
. ./util.sh

set -x

if [ "$1" = "ignore" ]; then
  echo "Test $0 ignored"
  exit 0
fi

REPO_NAME=upgrade_repo002
DAO_NAME="dao-upgrade-test002_$(date +%s)"
NEW_REPO_PATH=upgrade_repo002_v2

# delete folders
[ -d $REPO_NAME ] && rm -rf $REPO_NAME
[ -d $NEW_REPO_PATH ] && rm -rf $NEW_REPO_PATH

# deploy new DAO that will be upgraded
deploy_DAO_and_repo

export OLD_LINK="gosh://$SYSTEM_CONTRACT_ADDR/$DAO_NAME/$REPO_NAME"
echo "OLD_LINK=$OLD_LINK"

echo "Upgrade DAO"
upgrade_DAO

echo "***** new repo02 deploy *****"
tonos-cli call --abi $WALLET_ABI_1 --sign $WALLET_KEYS $WALLET_ADDR AloneDeployRepository \
    "{\"nameRepo\":\"$REPO_NAME\",\"descr\":\"\",\"previous\":{\"addr\":\"$REPO_ADDR\", \"version\":\"$CUR_VERSION\"}}" || exit 1
REPO_ADDR=$(tonos-cli -j run $SYSTEM_CONTRACT_ADDR_1 getAddrRepository "{\"name\":\"$REPO_NAME\",\"dao\":\"$DAO_NAME\"}" --abi $SYSTEM_CONTRACT_ABI_1 | sed -n '/value0/ p' | cut -d'"' -f 4)
echo "REPO_ADDR=$REPO_ADDR"

echo "***** awaiting repo deploy *****"
wait_account_active $REPO_ADDR
sleep 3

export NEW_LINK="gosh://$SYSTEM_CONTRACT_ADDR_1/$DAO_NAME/$REPO_NAME"
echo "NEW_LINK=$NEW_LINK"

sleep 20

echo "***** cloning repo with new link *****"
git clone $NEW_LINK $NEW_REPO_PATH

echo "***** push to new version *****"
cd $NEW_REPO_PATH
git config user.email "foo@bar.com"
git config user.name "My name"
git branch -m main

echo new_ver > 1.txt
git add 1.txt
git commit -m test2
GOSH_TRACE=5 git push -u origin main &> ../trace_up_020.log

cd ..

echo "***** cloning repo with new link *****"
git clone $NEW_LINK $REPO_NAME

cd $REPO_NAME
cur_ver=$(cat 1.txt)
if [ $cur_ver != "new_ver" ]; then
  echo "WRONG VERSION"
  exit 1
fi
echo "GOOD VERSION"
cd ..

echo "TEST SUCCEEDED"