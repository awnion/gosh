#!/bin/bash

PROPOSAL_KIND_DEPLOY_REPO=0x000000000000000000000000000000000000000000000000000000000000000c

function get_proposal_details {
    proposal_addr=$1
    ensure_provided proposal_addr
    tonos-cli -j -u network.gosh.sh run $1 getDetails {} \
        --abi ../v5_x/v5.1.0/contracts/gosh/smv/SMVProposal.abi.json | jq -r .
}

function get_proposal_deploy_repo_status {
    proposal_addr=$1
    ensure_provided proposal_addr
    status=$(tonos-cli -j -u network.gosh.sh run $1 getDetails {} \
        --abi ../v5_x/v5.1.0/contracts/gosh/smv/SMVProposal.abi.json \
        | jq -r ". | select(.value0==\"$PROPOSAL_KIND_DEPLOY_REPO\") | .value1")
    echo -n $status
}

function get_proposal_deploy_repo_name {
    proposal_addr=$1
    ensure_provided proposal_addr
    tonos-cli -j -u network.gosh.sh run $1 getGoshDeployRepoProposalParams {} \
        --abi ../v5_x/v5.1.0/contracts/gosh/smv/SMVProposal.abi.json \
        | jq -r ". | select(.proposalKind==\"$PROPOSAL_KIND_DEPLOY_REPO\") | .repoName"

}
