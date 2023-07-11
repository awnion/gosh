use super::GitHelper;

use crate::{
    blockchain,
    blockchain::{
        calculate_contract_address, get_contract_code, tag::load::TagObject,
        BlockchainContractAddress, BlockchainService, GetContractCodeResult, user_wallet::WalletError,
    },
};
use git_odb::{Find, Write};
use tokio::{sync::Mutex, task::JoinSet};
use tokio_retry::{
    RetryIf,
    strategy::FibonacciBackoff, Retry,
};
use tracing::Instrument;

use crate::blockchain::contract::GoshContract;
use crate::blockchain::{gosh_abi, GetNameBranchResult};

use bstr::ByteSlice;
use std::{
    collections::{HashMap, HashSet, VecDeque},
    io::Write as IoWrite,
    str::FromStr,
    sync::{Arc, atomic::AtomicU64},
};

use git_object::tree::EntryMode;

mod process_tree;
mod restore_blobs;

// #[derive(Debug)]
// struct TreeObjectsQueueItem {
//     pub path: String,
//     pub oid: git_hash::ObjectId,
//     pub branches: HashSet<String>,
// }

impl<Blockchain> GitHelper<Blockchain>
where
    Blockchain: BlockchainService,
{
    pub async fn calculate_commit_address(
        &mut self,
        commit_id: &git_hash::ObjectId,
    ) -> anyhow::Result<BlockchainContractAddress> {
        let commit_id = format!("{}", commit_id);
        tracing::info!(
            "Calculating commit address for repository {} and commit id <{}>",
            self.repo_addr,
            commit_id
        );
        let repo_contract = &mut self.blockchain.repo_contract().clone();
        blockchain::get_commit_address(&self.blockchain.client(), repo_contract, &commit_id).await
    }

    pub fn is_commit_in_local_cache(&self, object_id: &git_hash::ObjectId) -> bool {
        self.local_repository().objects.contains(object_id)
    }

    fn write_git_tree(&mut self, obj: &git_object::Tree) -> anyhow::Result<git_hash::ObjectId> {
        tracing::info!("Writing git tree object");
        let store = &self.local_repository().objects;
        // It should refresh once even if the refresh mode is never, just to initialize the index
        //store.refresh_never();
        let buf = process_tree::serialize_tree(obj).map_err(|e| {
            tracing::error!("Serialization of git tree object failed with: {}", e);
            e
        })?;
        let object_id = store.write_buf(git_object::Kind::Tree, &buf).map_err(|e| {
            tracing::error!("Write git object failed with: {}", e);
            e
        })?;
        tracing::info!("Writing git object - success, {}", object_id);
        Ok(object_id)
    }

    fn write_git_object(
        &mut self,
        obj: impl git_object::WriteTo,
    ) -> anyhow::Result<git_hash::ObjectId> {
        tracing::info!("Writing git object");
        let store = &self.local_repository().objects;
        // It should refresh once even if the refresh mode is never, just to initialize the index
        //store.refresh_never();
        let object_id = store.write(obj).map_err(|e| {
            tracing::error!("Write git object failed  with: {}", e);
            e
        })?;
        tracing::info!("Writing git object - success, {}", object_id);
        Ok(object_id)
    }

    #[instrument(level = "debug", skip_all)]
    pub async fn fetch_ref(
        &mut self,
        sha: &str,
        name: &str,
    ) -> anyhow::Result<Vec<(String, String)>> {
        const REFS_HEAD_PREFIX: &str = "refs/heads/";
        if !name.starts_with(REFS_HEAD_PREFIX) {
            anyhow::bail!("Error. Can not fetch an object without refs/heads/ prefix");
        }
        tracing::info!("Fetching sha: {} name: {}", sha, name);
        let branch = {
            let mut iter = name.chars();
            iter.by_ref().nth(REFS_HEAD_PREFIX.len() - 1);
            iter.as_str().to_owned()
        };
        tracing::debug!("Calculate branch: {}", branch);

        let context = self.blockchain.client();
        let remote_branches: Vec<String> = blockchain::branch_list(context, &self.repo_addr)
            .await?
            .branch_ref
            .iter()
            .map(|b| b.branch_name.clone())
            .collect();

        // let mut visited: HashSet<git_hash::ObjectId> = HashSet::new();
        let visited: Arc<Mutex<HashSet<git_hash::ObjectId>>> = Arc::new(Mutex::new(HashSet::new()));
        let visited_ipfs: Arc<Mutex<HashMap<String, git_hash::ObjectId>>> =
            Arc::new(Mutex::new(HashMap::new()));
        macro_rules! guard {
            ($id:ident) => {{
                let visited = visited.lock().await;
                if visited.contains(&$id) {
                    continue;
                }
            }
            if $id.is_null() {
                continue;
            }
            {
                let mut visited = visited.lock().await;
                visited.insert($id.clone());
                if self.is_commit_in_local_cache(&$id) {
                    continue;
                }
            }};
        }

        let mut commits_queue = VecDeque::<git_hash::ObjectId>::new();
        let tree_obj_queue = Arc::new(Mutex::new(VecDeque::<process_tree::TreeObjectsQueueItem>::new()));
        let blobs_restore_plan = Arc::new(Mutex::new(restore_blobs::BlobsRebuildingPlan::new()));
        let sha = git_hash::ObjectId::from_str(sha)?;
        commits_queue.push_front(sha);

        let mut dangling_trees = vec![];
        let mut dangling_commits = vec![];
        let mut next_commit_of_prev_version = vec![];
        loop {
            tracing::trace!("commits_queue={:?}", commits_queue);
            if let Some(id) = commits_queue.pop_back() {
                guard!(id);
                let address = &self.calculate_commit_address(&id).await?;
                let onchain_commit =
                    match blockchain::GoshCommit::load(&self.blockchain.client(), address).await {
                        Ok(commit) => commit,
                        Err(e) => {
                            let version = self.find_commit(&id.to_string()).await?.version;
                            tracing::trace!(
                                "push to next_commit_of_prev_version=({},{})",
                                id,
                                version
                            );
                            next_commit_of_prev_version.push((version, id.to_string()));
                            continue;
                        }
                    };
                tracing::debug!("branch={branch}: loaded onchain commit {}", id);
                tracing::debug!(
                    "branch={branch} commit={id} addr={address}: data {:?}",
                    onchain_commit
                );
                let data = git_object::Data::new(
                    git_object::Kind::Commit,
                    onchain_commit.content.as_bytes(),
                );
                let obj = git_object::Object::from(data.decode()?).into_commit();
                tracing::debug!("Received commit {}", id);
                let mut branches = HashSet::new();
                branches.insert(onchain_commit.branch.clone());

                tracing::debug!(
                    "branch={branch}: existing remote branches: {:?}",
                    remote_branches
                );
                // don't collect parent branches for deleted one
                if remote_branches.contains(&onchain_commit.branch) {
                    for parent in onchain_commit.parents.clone() {
                        let parent = BlockchainContractAddress::new(parent.address);
                        let parent_contract = GoshContract::new(&parent, gosh_abi::COMMIT);
                        let branch: GetNameBranchResult = parent_contract
                            .run_local(self.blockchain.client(), "getNameBranch", None)
                            .await?;
                        tracing::debug!("commit={id}: extracted branch {:?}", branch.name);
                        branches.insert(branch.name);
                    }
                } else {
                    branches.insert(branch.clone());
                }

                let to_load = process_tree::TreeObjectsQueueItem {
                    path: "".to_owned(),
                    oid: obj.tree,
                    branches,
                };
                tracing::debug!("New tree root: {}", &to_load.oid);
                if onchain_commit.initupgrade {
                    // Object can be first in the tree and have no parents
                    // if !obj.parents.is_empty() {
                    let prev_version = onchain_commit.parents[0].clone().version;
                    tracing::trace!(
                        "push to next_commit_of_prev_version=({},{})",
                        id,
                        prev_version
                    );
                    next_commit_of_prev_version.push((prev_version, id.to_string()));
                    // }
                } else {
                    tree_obj_queue.lock().await.push_front(to_load);
                    for parent_id in &obj.parents {
                        commits_queue.push_front(*parent_id);
                    }
                    tracing::trace!("Push to dangling commits: {}", id);
                    dangling_commits.push(obj);
                }
                continue;
            }

            if !dangling_commits.is_empty() {
                tracing::trace!("Writing dangling commits");
                for obj in dangling_commits.iter().rev() {
                    self.write_git_object(obj)?;
                }
                dangling_commits.clear();
                continue;
            }
            break;
        }

        let mut tree_handlers = JoinSet::<Result<(), anyhow::Error>>::new();
        let mut trees_counter = AtomicU64::new(0);
        let mut resolved_spawns = AtomicU64::new(0);
        loop {
            let blobs_restore_plan_ref = blobs_restore_plan.clone();
            {
                let mut blobs_restore_plan = blobs_restore_plan_ref.lock().await;
                if blobs_restore_plan.is_available() {
                    let visited_ref = Arc::clone(&visited);
                    let visited_ipfs_ref = Arc::clone(&visited_ipfs);
                    tracing::debug!("branch={}: Restoring blobs", branch.clone());
                    blobs_restore_plan
                        .restore(self, visited_ref, visited_ipfs_ref)
                        .await?;
                    // blobs_restore_plan_ref = Arc::new(Mutex::new(restore_blobs::BlobsRebuildingPlan::new()));
                    continue;
                }
            }

            if let Some(tree_node_to_load) = tree_obj_queue.clone().lock().await.pop_front() {
                tracing::debug!("branch={branch}: Loading tree: {:?}", tree_node_to_load);
                let id = tree_node_to_load.oid;
                tracing::debug!("branch={branch}: Loading tree: {}", id);
                guard!(id);
                tracing::debug!("branch={branch}: Ok. Guard passed. Loading tree: {}", id);
                let es_client = self.blockchain.client().clone();
                let mut repo_contract = self.blockchain.repo_contract().clone();
                let branch_ref = branch.clone();
                let tree_obj_queue_ref = tree_obj_queue.clone();
                let blobs_restore_plan_ref = blobs_restore_plan.clone();
                tree_handlers.spawn(
                    async move {
                        Retry::spawn(
                            FibonacciBackoff::from_millis(100).take(5),
                            || async {
                                tracing::debug!("attempt to process tree object: {id}");
                                process_tree::process_tree(
                                    &es_client,
                                    &mut repo_contract,
                                    &branch_ref,
                                    &tree_node_to_load,
                                    tree_obj_queue_ref.clone(),
                                    blobs_restore_plan_ref.clone(),
                                ).await
                            },
                        ).await
                    }.instrument(info_span!("tokio::spawn::process_tree").or_current()),
                );
                continue;
            }
            if !dangling_trees.is_empty() {
                tracing::trace!("Writing dangling trees");
                for obj in dangling_trees.iter().rev() {
                    self.write_git_tree(obj)?;
                }
                dangling_trees.clear();
            }
            break;
        }
        tracing::trace!(
            "next_commit_of_prev_version={:?}",
            next_commit_of_prev_version
        );

        Ok(next_commit_of_prev_version)
    }

    #[instrument(level = "trace", skip_all)]
    pub async fn fetch_tag(
        &mut self,
        sha: &str,
        tag_name: &str,
    ) -> anyhow::Result<Vec<(String, String)>> {
        let client = self.blockchain.client();
        let GetContractCodeResult { code } =
            get_contract_code(client, &self.repo_addr, blockchain::ContractKind::Tag).await?;

        let address = calculate_contract_address(
            client,
            blockchain::ContractKind::Tag,
            &code,
            Some(serde_json::json!({ "_nametag": tag_name })),
        )
        .await?;

        let tag = crate::blockchain::tag::load::get_content(client, &address).await?;

        if let TagObject::Annotated(obj) = tag {
            let tag_object = git_object::Data::new(git_object::Kind::Tag, &obj.content);
            let store = self.local_repository().clone().objects;
            let tag_id = store.write_buf(tag_object.kind, tag_object.data)?;
        }

        Ok(vec![])
    }

    #[instrument(level = "trace", skip_all)]
    pub async fn fetch(&mut self, sha: &str, name: &str) -> anyhow::Result<Vec<(String, String)>> {
        tracing::debug!("fetch: sha={sha} ref={name}");
        let splitted: Vec<&str> = name.rsplitn(2, '/').collect();
        let result = match splitted[..] {
            [tag_name, "refs/tags"] => self.fetch_tag(sha, tag_name).await?,
            [_, "refs/heads"] => self.fetch_ref(sha, name).await?,
            _ => anyhow::bail!(
                "Error. Can not fetch an object without refs/heads/ or refs/tags/ prefixes"
            ),
        };

        Ok(result)
    }
}

#[cfg(test)]
mod tests {

    #[test]
    fn testing_what_is_inside_the_snapshot_content() {}
}
