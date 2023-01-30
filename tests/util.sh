if [ -e env.env ]; then
    . ./env.env
fi

function delay {
    sleep_for=$1

    echo "falling asleep for ${sleep_for} sec"
    sleep $sleep_for
}

function wait_account_active {
    stop_at=$((SECONDS+120))
    contract_addr=$1
    while [ $SECONDS -lt $stop_at ]; do
        status=`tonos-cli -j -u $NETWORK account $contract_addr | jq -r '."'"$contract_addr"'".acc_type'`
        if [ "$status" = "Active" ]; then
            is_ok=1
            echo account is active
            break
        fi
        sleep 5
    done

    if [ "$is_ok" = "0" ]; then
        echo account is not active
        exit 2
    fi
}

function wait_set_commit {
    stop_at=$((SECONDS+300))
    repo_addr=$1
    branch=$2
    expected_commit=`git rev-parse HEAD`

    expected_commit_addr=`tonos-cli -j -u $NETWORK run $repo_addr getCommitAddr '{"nameCommit":"'"$expected_commit"'"}' --abi ../$REPO_ABI | jq -r .value0`

    is_ok=0

    while [ $SECONDS -lt $stop_at ]; do
        last_commit_addr=`tonos-cli -j -u $NETWORK run $repo_addr getAddrBranch '{"name":"'"$branch"'"}' --abi ../$REPO_ABI | jq -r .value0.commitaddr`
        if [ "$last_commit_addr" = "$expected_commit_addr" ]; then
            is_ok=1
            echo set_commit success
            break
        fi

        sleep 5
    done

    if [ "$is_ok" = "0" ]; then
        echo set_commit failed
        exit 2
    fi
}

function deploy_DAO_and_repo {
  echo "Deploy DAO"
  echo "DAO_NAME=$DAO_NAME"
  gosh-cli -j call --abi $USER_PROFILE_ABI $USER_PROFILE_ADDR --sign $WALLET_KEYS deployDao \
    "{\"systemcontract\":\"$SYSTEM_CONTRACT_ADDR\", \"name\":\"$DAO_NAME\", \"pubmem\":[\"$USER_PROFILE_ADDR\"]}"
  DAO_ADDR=$(gosh-cli -j run $SYSTEM_CONTRACT_ADDR getAddrDao "{\"name\":\"$DAO_NAME\"}" --abi $SYSTEM_CONTRACT_ABI | sed -n '/value0/ p' | cut -d'"' -f 4)
  echo "***** awaiting dao deploy *****"
  wait_account_active $DAO_ADDR
  echo "DAO_ADDR=$DAO_ADDR"

  WALLET_ADDR=$(gosh-cli -j run $DAO_ADDR getAddrWallet "{\"pubaddr\":\"$USER_PROFILE_ADDR\",\"index\":0}" --abi $DAO_ABI | sed -n '/value0/ p' | cut -d'"' -f 4)
  echo "WALLET_ADDR=$WALLET_ADDR"

  echo "***** turn DAO on *****"
  gosh-cli -j call --abi $USER_PROFILE_ABI $USER_PROFILE_ADDR --sign $WALLET_KEYS turnOn \
    "{\"pubkey\":\"$WALLET_PUBKEY\",\"wallet\":\"$WALLET_ADDR\"}"

  sleep 10

  GRANTED_PUBKEY=$(gosh-cli -j run --abi $WALLET_ABI $WALLET_ADDR getAccess {} | jq -r .value0)
  echo $GRANTED_PUBKEY

  echo "***** repo01 deploy *****"
  gosh-cli -j call --abi $WALLET_ABI --sign $WALLET_KEYS $WALLET_ADDR deployRepository \
      "{\"nameRepo\":\"$REPO_NAME\", \"previous\":null}" || exit 1
  REPO_ADDR=$(gosh-cli -j run $SYSTEM_CONTRACT_ADDR getAddrRepository "{\"name\":\"$REPO_NAME\",\"dao\":\"$DAO_NAME\"}" --abi $SYSTEM_CONTRACT_ABI | sed -n '/value0/ p' | cut -d'"' -f 4)

  echo "***** awaiting repo deploy *****"
  wait_account_active $REPO_ADDR
  sleep 3
}

# upgrade_DAO 1 or 2 to deploy to TEST_VERSION1 or TEST_VERSION2
function upgrade_DAO {
  if [ $1 = 2 ]; then
    TEST_VERSION=$TEST_VERSION2
    PROP_ID=$PROP_ID2
    NEW_SYSTEM_CONTRACT_ADDR=$SYSTEM_CONTRACT_ADDR_2
  else
    TEST_VERSION=$TEST_VERSION1
    PROP_ID=$PROP_ID1
    NEW_SYSTEM_CONTRACT_ADDR=$SYSTEM_CONTRACT_ADDR_1
  fi
  echo "***** start proposal for upgrade *****"
  gosh-cli -j callx --abi $WALLET_ABI --addr $WALLET_ADDR --keys $WALLET_KEYS -m startProposalForUpgradeDao --newversion $TEST_VERSION --description "" --num_clients 1

  echo "***** get data for proposal *****"
  tip3VotingLocker=$(gosh-cli -j run $WALLET_ADDR  --abi $WALLET_ABI tip3VotingLocker "{}" | sed -n '/tip3VotingLocker/ p' | cut -d'"' -f 4)
  echo "tip3VotingLocker=$tip3VotingLocker"

  platform_id=$(gosh-cli -j runx --addr $WALLET_ADDR -m getPlatfotmId --abi $WALLET_ABI --propId $PROP_ID --platformType 1 --_tip3VotingLocker $tip3VotingLocker | sed -n '/value0/ p' | cut -d'"' -f 4)
  echo "platform_id=$platform_id"

  sleep 3

  gosh-cli -j callx --abi $WALLET_ABI --addr $WALLET_ADDR --keys $WALLET_KEYS -m voteFor --platform_id $platform_id --choice true --amount 20 --num_clients 1

  wallet_tombstone=$(gosh-cli -j runx --addr $WALLET_ADDR -m getTombstone --abi $WALLET_ABI | sed -n '/value0/ p' | cut -d':' -f 2)
  echo "WALLET tombstone: $wallet_tombstone"

  if [ "$wallet_tombstone" = "false" ]; then
    echo "Tombstone was not set"
    exit 1
  fi

  echo "gosh-cli -j runx --addr $NEW_SYSTEM_CONTRACT_ADDR -m getAddrDao --abi $SYSTEM_CONTRACT_ABI --name $DAO_NAME"
  new_dao_addr=$(gosh-cli -j runx --addr $NEW_SYSTEM_CONTRACT_ADDR -m getAddrDao --abi $SYSTEM_CONTRACT_ABI --name $DAO_NAME | sed -n '/value0/ p' | cut -d'"' -f 4)

  echo "New DAO address: $new_dao_addr"

  NEW_WALLET_ADDR=$(gosh-cli -j run $new_dao_addr getAddrWallet "{\"pubaddr\":\"$USER_PROFILE_ADDR\",\"index\":0}" --abi $DAO_ABI | sed -n '/value0/ p' | cut -d'"' -f 4)
  echo "NEW_WALLET_ADDR=$NEW_WALLET_ADDR"

  gosh-cli call --abi $USER_PROFILE_ABI $USER_PROFILE_ADDR --sign $WALLET_KEYS turnOn \
    "{\"pubkey\":\"$WALLET_PUBKEY\",\"wallet\":\"$NEW_WALLET_ADDR\"}"

}