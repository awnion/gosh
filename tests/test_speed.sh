#!/bin/bash
set -e
set -o pipefail
. ./util.sh

REPO_NAME="repo_speed_$(date +%s)"

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

echo 0000 > 0.txt
git add 0.txt
git commit -m start

{ time git push -u origin main ; } &> ../one_commit.time.log
ONE_PUSH=$(cat ../one_commit.time.log | grep real | cut -d 'm' -f 2 | cut -d ',' -f 1)
for i in {1..20}; do
  echo "blabla$i" > "$i".txt
  git add *
  sleep 1
  git commit -m "main$i"
done

{ time git push -u origin main ; } &> ../many_commits.time.log
MANY_PUSH=$(cat ../many_commits.time.log | grep real | cut -d 'm' -f 2 | cut -d ',' -f 1)
# echo "***** awaiting set commit into $BRANCH_NAME *****"
# wait_set_commit $REPO_ADDR $BRANCH_NAME
echo "one_push=$ONE_PUSH many_push=$MANY_PUSH"
ONE_PUSH=$((ONE_PUSH*2))

if [ $MANY_PUSH -ge $ONE_PUSH ]; then
  echo "Push of many commits is too slow"
  exit 1
fi

echo "***** cloning repo *****"
cd ..

sleep 10

git clone gosh://$SYSTEM_CONTRACT_ADDR/$DAO_NAME/$REPO_NAME $REPO_NAME"-clone"

echo "***** comparing repositories *****"
DIFF_STATUS=1
if  diff --brief --recursive $REPO_NAME $REPO_NAME"-clone" --exclude ".git"; then
    DIFF_STATUS=0
fi

exit $DIFF_STATUS