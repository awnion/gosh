use crate::blockchain::{
    gosh_abi, run_local, BlockchainContractAddress, BlockchainService, EverClient, GoshContract,
    Number,
};
use ::git_object;
use data_contract_macro_derive::DataContract;
use std::collections::HashMap;

#[derive(Deserialize, Debug)]
pub struct TreeComponent {
    pub flags: Number,
    pub mode: String,
    #[serde(rename = "typeObj")]
    pub type_obj: String,
    pub name: String,
    pub sha1: String,
    pub sha256: String,
}

#[derive(Deserialize, Debug)]
pub struct GetDetailsResult {
    #[serde(rename = "value0")]
    pub is_ready: bool,
    #[serde(rename = "value1")]
    objects: HashMap<String, TreeComponent>,
    #[serde(rename = "value2")]
    sha_tree_local: String,
    #[serde(rename = "value3")]
    sha_tree: String,
    #[serde(rename = "value4")]
    pubaddr: BlockchainContractAddress,
}

#[derive(Deserialize, Debug, DataContract)]
#[abi = "tree.abi.json"]
#[abi_data_fn = "gettree"]
pub struct Tree {
    #[serde(rename = "value0")]
    pub objects: HashMap<String, TreeComponent>,
}

#[derive(Deserialize, Debug)]
struct GetTreeResult {
    #[serde(rename = "value0")]
    address: BlockchainContractAddress,
}

impl Tree {
    pub async fn calculate_address(
        context: &EverClient,
        repo_contract: &mut GoshContract,
        tree_obj_sha1: &str,
    ) -> anyhow::Result<BlockchainContractAddress> {
        let params = serde_json::json!({ "treeName": tree_obj_sha1 });
        let result: GetTreeResult = repo_contract
            .run_static(context, "getTreeAddr", Some(params))
            .await?;
        Ok(result.address)
    }
}

impl Into<git_object::tree::Entry> for TreeComponent {
    fn into(self) -> git_object::tree::Entry {
        let mode = match self.type_obj.as_str() {
            "tree" => git_object::tree::EntryMode::Tree,
            "blob" => git_object::tree::EntryMode::Blob,
            "blobExecutable" => git_object::tree::EntryMode::BlobExecutable,
            "link" => git_object::tree::EntryMode::Link,
            "commit" => git_object::tree::EntryMode::Commit,
            _ => unreachable!(),
        };
        let filename = self.name.into();
        let oid = git_hash::ObjectId::from_hex(self.sha1.as_bytes()).expect("SHA1 must be correct");
        git_object::tree::Entry {
            mode,
            filename,
            oid,
        }
    }
}

impl Into<git_object::Tree> for Tree {
    fn into(self) -> git_object::Tree {
        let mut entries: Vec<git_object::tree::Entry> =
            self.objects.into_values().map(|e| e.into()).collect();
        entries.sort();
        git_object::Tree { entries }
    }
}

pub async fn check_if_tree_is_ready<B>(
    blockchain: &B,
    address: &BlockchainContractAddress,
) -> anyhow::Result<(bool, usize)>
// returns ready status and number of tree objects
where
    B: BlockchainService + 'static,
{
    tracing::trace!("Check whether tree is ready: {address}");
    let tree_contract = GoshContract::new(address, gosh_abi::TREE);
    let value = run_local(blockchain.client(), &tree_contract, "getDetails", None).await?;
    let res: GetDetailsResult = serde_json::from_value(value)?;

    tracing::trace!(
        "tree {}: ready={}, objects={}",
        address,
        res.is_ready,
        res.objects.len()
    );
    Ok((res.is_ready, res.objects.len()))
}
