#!/bin/bash
set -e
set -o pipefail
. ./util.sh

set -x

if [ "$1" = "ignore" ]; then
    echo "Test $0 ignored"
    exit 0
fi

REPO_NAME=upgrade_repo08
DAO_NAME="dao-upgrade-test08_$(date +%s)"
TAG_NAME=release

# delete folders
[ -d $REPO_NAME ] && rm -rf $REPO_NAME

# deploy new DAO that will be upgraded
deploy_DAO_and_repo

export REPO_LINK="gosh://$SYSTEM_CONTRACT_ADDR/$DAO_NAME/$REPO_NAME"
echo "REPO_LINK=$REPO_LINK"

echo "***** cloning old version repo *****"
git clone $REPO_LINK

cd $REPO_NAME
git config user.email "foo@bar.com"
git config user.name "My name"
git branch -m main
# push 1 file
echo "***** Pushing file to the repo *****"
date +%s > last
git add last
git commit -m "added 'last'"
git push -u origin main
PARENT_COMMIT_ID=$(git rev-parse --short HEAD)

git tag $TAG_NAME
git push origin $TAG_NAME

cd ..

echo "Upgrade DAO"
upgrade_DAO

echo "***** new $REPO_NAME deploy *****"
tonos-cli call --abi $WALLET_ABI_1 --sign $WALLET_KEYS $WALLET_ADDR AloneDeployRepository \
    "{\"nameRepo\":\"$REPO_NAME\",\"descr\":\"\",\"previous\":{\"addr\":\"$REPO_ADDR\", \"version\":\"$CUR_VERSION\"}}" || exit 1
REPO_ADDR=$(tonos-cli -j run $SYSTEM_CONTRACT_ADDR_1 getAddrRepository "{\"name\":\"$REPO_NAME\",\"dao\":\"$DAO_NAME\"}" --abi $SYSTEM_CONTRACT_ABI | sed -n '/value0/ p' | cut -d'"' -f 4)
echo "REPO_ADDR=$REPO_ADDR"

echo "***** awaiting repo deploy *****"
wait_account_active $REPO_ADDR
delay 3

#
# after repo was upgraded someone must redeploy all tags
#
delay 60
cd $REPO_NAME
git push --tags

echo "**** Fetch repo *****"
git fetch
FETCHED_TAG=$(git tag -l $TAG_NAME)

if [ "$FETCHED_TAG" != "$TAG_NAME" ]; then
    echo "ERR: expected tag is missing ($FETCHED_TAG != $TAG_NAME)"
    exit 1
fi

date +%s > last
git add last
git commit -m "updated 'last'"
git push

git tag -d $TAG_NAME
git tag $TAG_NAME

set +e
git push origin $TAG_NAME
set -e

RESULT=$(echo $?)
if [ $RESULT == 0 ]; then
    echo "ERR: pushing the tag was successful (should have failed)"
fi

echo "TEST SUCCEEDED"
