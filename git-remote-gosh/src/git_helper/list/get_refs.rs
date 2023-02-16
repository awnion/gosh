use crate::blockchain::{branch_list, get_commit_by_addr, BlockchainContractAddress, EverClient};

const ZERO_COMMIT: &str = "0000000000000000000000000000000000000000";
// pub const EMPTY_TREE_SHA: &str = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"; // $ echo -n '' | git hash-object --stdin -t tree
// pub const EMPTY_BLOB_SHA: &str = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"; // $ echo -n '' | git hash-object --stdin -t blob

pub async fn get_refs(
    context: &EverClient,
    repo_addr: &BlockchainContractAddress,
) -> anyhow::Result<Option<Vec<String>>> {
    let _list = branch_list(context, repo_addr)
        .await
        .map_err(|e| anyhow::Error::from(e))?
        .branch_ref;
    if _list.is_empty() {
        return Ok(None);
    }

    let mut ref_list: Vec<String> = Vec::new(); //_list.iter().map(|branch| format!("<SHA> refs/heads/{}", branch.branch_name)).collect();
    for branch in _list {
        let _commit = get_commit_by_addr(context, &branch.commit_address)
            .await
            .unwrap()
            .unwrap();
        if _commit.sha != ZERO_COMMIT {
            ref_list.push(format!("{} refs/heads/{}", _commit.sha, branch.branch_name));
        }
    }
    Ok(Some(ref_list))
}
