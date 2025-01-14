#!/bin/bash
set -e
set -o pipefail
. ./util.sh
set -x

NOW=$(date +%s)
REPO_NAME="repo20_$NOW"
BRANCH=dev

[ -d $REPO_NAME ] && rm -rf $REPO_NAME
[ -d $REPO_NAME"-clone" ] && rm -rf $REPO_NAME"-clone"

deploy_repo
REPO_ADDR=$(tonos-cli -j run $SYSTEM_CONTRACT_ADDR getAddrRepository "{\"name\":\"$REPO_NAME\",\"dao\":\"$DAO_NAME\"}" --abi $SYSTEM_CONTRACT_ABI | sed -n '/value0/ p' | cut -d'"' -f 4)

echo "***** awaiting repo deploy *****"
wait_account_active $REPO_ADDR

echo "***** cloning repo *****"
git clone gosh://$SYSTEM_CONTRACT_ADDR/$DAO_NAME/$REPO_NAME

#check
cd $REPO_NAME
# config git client
git config user.email "foo@bar.com"
git config user.name "My name"
git branch -m main

echo "main: $(date +%s)" > last
git add last
git commit -m "created 'last'"
git push -u origin main

git checkout -b $BRANCH
echo "$BRANCH: $(date +%s)" > last
git add last
git commit -m "$BRANCH: update 'last'"
git push -u origin $BRANCH

LIST=`list_branches $REPO_ADDR`
if [ "$(echo "$LIST" | grep -e "^$BRANCH\$")" != $BRANCH ]; then
    echo "FAILED: branch '$BRANCH' not found"
    exit 1
fi

GOSH_TRACE=5 git push origin :$BRANCH &> trace.log

LIST=`list_branches $REPO_ADDR`
if [ "$(echo "$LIST" | grep -e "^$BRANCH\$")" != "" ]; then
    echo "FAILED: branch '$BRANCH' still exists"
    exit 1
fi

echo "TEST SUCCEEDED"

