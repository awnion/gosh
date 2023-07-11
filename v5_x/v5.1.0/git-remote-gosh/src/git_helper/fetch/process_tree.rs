use crate::{
    blockchain::{self, contract::GoshContract, gosh_abi},
    git_helper::EverClient,
};
use std::{
    collections::{HashSet, VecDeque},
    sync::Arc,
};
use super::restore_blobs;
use git_object::tree::EntryMode;
use tokio::sync::Mutex;

#[derive(Debug)]
pub struct TreeObjectsQueueItem {
    pub path: String,
    pub oid: git_hash::ObjectId,
    pub branches: HashSet<String>,
}

pub async fn process_tree(
    es_client: &EverClient,
    repo_contract: &mut GoshContract,
    branch: &str,
    tree_node_to_load: &TreeObjectsQueueItem,
    tree_obj_queue: Arc<Mutex<VecDeque::<TreeObjectsQueueItem>>>,
    blobs_restore_plan: Arc<Mutex<restore_blobs::BlobsRebuildingPlan>>,
) -> anyhow::Result<()> {
    let path_to_node = &tree_node_to_load.path;
    let id = tree_node_to_load.oid;
    let tree_object_id = format!("{id}");

    let address = blockchain::Tree::calculate_address(
        &es_client,
        &mut repo_contract.clone(),
        &tree_object_id,
    )
    .await?;

    let onchain_tree_object =
        blockchain::Tree::load(&es_client, &address).await?;
    let tree_object: git_object::Tree = onchain_tree_object.into();

    tracing::debug!("branch={branch}: Tree obj parsed {}", id);
    for entry in &tree_object.entries {
        let oid = entry.oid;
        match entry.mode {
            git_object::tree::EntryMode::Tree => {
                tracing::debug!("branch={branch}: Tree entry: tree {}->{}", id, oid);
                let to_load = TreeObjectsQueueItem {
                    path: format!("{}/{}", path_to_node, entry.filename),
                    oid,
                    branches: tree_node_to_load.branches.clone(),
                };
                tree_obj_queue.lock().await.push_back(to_load);
            }
            git_object::tree::EntryMode::Commit => (),
            git_object::tree::EntryMode::Blob
            | git_object::tree::EntryMode::BlobExecutable
            | git_object::tree::EntryMode::Link => {
                tracing::debug!("branch={branch}: Tree entry: blob {}->{}", id, oid);
                let file_path = format!("{}/{}", path_to_node, entry.filename);
                for branch in tree_node_to_load.branches.iter() {
                    let mut repo_contract = repo_contract.clone();
                    let snapshot_address = blockchain::Snapshot::calculate_address(
                        &Arc::clone(es_client),
                        &mut repo_contract,
                        branch,
                        // Note:
                        // Removing prefixing "/" in the path
                        &file_path[1..],
                    )
                    .await?;
                    let snapshot_contract =
                        GoshContract::new(&snapshot_address, gosh_abi::SNAPSHOT);
                    match snapshot_contract.is_active(es_client).await {
                        Ok(true) => {
                            tracing::debug!(
                                "branch={branch}: Adding a blob to search for. Path: {}, id: {}, snapshot: {}",
                                file_path,
                                oid,
                                snapshot_address
                            );
                            blobs_restore_plan
                                .lock()
                                .await
                                .mark_blob_to_restore(snapshot_address, oid);
                        }
                        _ => {
                            continue;
                        }
                    }
                }
            }
            _ => {
                tracing::debug!("branch={branch}: IT MUST BE NOTED!");
                panic!();
            }
        }
    }
    tracing::trace!("Push to dangling tree: {}", tree_object_id);
    // dangling_trees.push(tree_object);
    Ok(())
}

pub fn serialize_tree(tree: &git_object::Tree) -> anyhow::Result<Vec<u8>> {
    let mut buffer = vec![];
    let mut objects = tree.entries.clone();
    let names = objects
        .clone()
        .iter()
        .map(|entry| entry.filename.to_string())
        .collect::<Vec<String>>();
    tracing::trace!("Serialize tree before sort: {:?}", names);
    objects.sort_by(|l_obj, r_obj| {
        let l_name = match l_obj.mode {
            EntryMode::Tree => {
                format!("{}/", l_obj.filename)
            }
            _ => l_obj.filename.to_string(),
        };
        let r_name = match r_obj.mode {
            EntryMode::Tree => {
                format!("{}/", r_obj.filename)
            }
            _ => r_obj.filename.to_string(),
        };
        l_name.cmp(&r_name)
    });
    let names = objects
        .clone()
        .iter()
        .map(|entry| entry.filename.to_string())
        .collect::<Vec<String>>();
    tracing::trace!("Serialize tree after sort: {:?}", names);

    for git_object::tree::Entry {
        mode,
        filename,
        oid,
    } in &objects
    {
        buffer.write_all(mode.as_bytes())?;
        buffer.write_all(b" ")?;

        if filename.find_byte(b'\n').is_some() {
            anyhow::bail!("Newline in file name: {}", filename.to_string());
        }
        buffer.write_all(filename)?;
        buffer.write_all(&[b'\0'])?;

        buffer.write_all(oid.as_bytes())?;
    }

    Ok(buffer)
}