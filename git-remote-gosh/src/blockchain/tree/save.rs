use crate::git_helper::GitHelper;

use ::git_object;

use crate::blockchain::{self, GoshBlobBitFlags, tvm_hash, TonClient};
use git_hash::ObjectId;
use git_object::tree::{self, EntryRef};
use git_odb::{self, Find};
use std::collections::{HashSet, VecDeque, HashMap};
use std::error::Error;
use std::vec::Vec;

#[derive(Serialize, Debug)]
pub struct TreeNode {
    flags: String,
    mode: String,
    #[serde(rename = "typeObj")]
    type_obj: String,
    name: String,
    sha1: String,
    sha256: String,
}

#[derive(Serialize, Debug)]
pub struct DeployTreeArgs {
    #[serde(rename = "shaTree")]
    pub sha: String,
    #[serde(rename = "repoName")]
    pub repo_name: String,
    #[serde(rename = "datatree")]
    nodes: HashMap<String, TreeNode>,
    ipfs: Option<String>,
}

impl<'a> From<(String, &'a tree::EntryRef<'a>)> for TreeNode {
    fn from((sha256, entry): (String, &tree::EntryRef)) -> Self {
        Self {
            flags: (GoshBlobBitFlags::Compressed as u8).to_string(),
            mode: std::str::from_utf8(entry.mode.as_bytes())
                .unwrap()
                .to_owned(),
            type_obj: convert_to_type_obj(entry.mode),
            name: entry.filename.to_string(),
            sha1: entry.oid.to_hex().to_string(),
            sha256,
        }
    }
}

fn convert_to_type_obj(entry_mode: tree::EntryMode) -> String {
    use git_object::tree::EntryMode::*;
    match entry_mode {
        Tree => "tree",
        Blob | BlobExecutable | Link => "blob",
        Commit => unimplemented!(),
    }
    .to_owned()
}

#[instrument(level = "debug", skip(context))]
async fn construct_tree_node(context: &TonClient, e: &EntryRef<'_>) -> Result<(String, TreeNode), Box<dyn Error>> {
    let content_hash = tvm_hash(&context, hex::encode(&e.filename)).await?;
    let file_name = e.filename.to_string();
    let tree_node = TreeNode::from((format!("0x{content_hash}"), e));
    let type_obj = &tree_node.type_obj;
    let key = tvm_hash(
        &context,
        format!("{}:{}", type_obj, file_name)
    ).await?;
    Ok((format!("0x{}", key), tree_node))
}

#[instrument(level = "debug", skip(context))]
pub async fn push_tree(context: &mut GitHelper, tree_id: &ObjectId) -> Result<(), Box<dyn Error>> {
    let mut visited = HashSet::new();
    let mut to_deploy = VecDeque::new();
    to_deploy.push_back(tree_id.clone());
    while let Some(tree_id) = to_deploy.pop_front() {
        if visited.contains(&tree_id) {
            continue;
        }
        visited.insert(tree_id);
        let mut buffer: Vec<u8> = Vec::new();
        let entry_ref_iter = context
            .local_repository()
            .objects
            .try_find(tree_id, &mut buffer)?
            .expect("Local object must be there")
            .try_into_tree_iter()
            .unwrap()
            .entries()?;

        let mut tree_nodes: HashMap<String, TreeNode> = HashMap::new();

        for e in entry_ref_iter.iter() {
            if e.mode == git_object::tree::EntryMode::Tree {
                to_deploy.push_back(e.oid.into());
            }
            let (hash, tree_node) = construct_tree_node(&context.es_client, e).await?;
            tree_nodes.insert(hash, tree_node);
        }
        let params = DeployTreeArgs {
            sha: tree_id.to_hex().to_string(),
            repo_name: context.remote.repo.clone(),
            nodes: tree_nodes,
            ipfs: None, // !!!
        };
        let params: serde_json::Value = serde_json::to_value(params)?;

        let user_wallet_contract = blockchain::user_wallet(context).await?;

        blockchain::call(
            &context.es_client,
            user_wallet_contract,
            "deployTree",
            Some(params),
        )
        .await?;
    }
    Ok(())
}
