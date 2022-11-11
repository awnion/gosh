use crate::{
    blockchain::{
        contract::{ContractInfo, ContractRead, GoshContract},
        gosh_abi,
        snapshot::{
            save::{Diff, GetDiffAddrResult, GetDiffResultResult, GetVersionResult},
            PushDiffCoordinate,
        },
        tvm_hash, BlockchainContractAddress, BlockchainService, EverClient, Snapshot,
    },
    config,
    git_helper::GitHelper,
    ipfs::{service::FileSave, IpfsService},
};
use std::sync::Arc;
use ton_client::utils::compress_zstd;

const PUSH_DIFF_MAX_TRIES: i32 = 3;
const PUSH_SNAPSHOT_MAX_TRIES: i32 = 3;

#[instrument(level = "debug", skip(diff, new_snapshot_content))]
pub async fn push_diff<'a>(
    context: &mut GitHelper<impl BlockchainService + 'a + 'static>,
    commit_id: &'a git_hash::ObjectId,
    branch_name: &'a str,
    blob_id: &'a git_hash::ObjectId,
    file_path: &'a str,
    diff_coordinate: &'a PushDiffCoordinate,
    last_commit_id: &'a git_hash::ObjectId,
    is_last: bool,
    original_snapshot_content: &'a Vec<u8>,
    diff: &'a [u8],
    new_snapshot_content: &'a Vec<u8>,
) -> anyhow::Result<tokio::task::JoinHandle<anyhow::Result<()>>> {
    let wallet = context
        .blockchain
        .user_wallet(&context.dao_addr, &context.remote.network)
        .await?;
    let mut repo_contract = context.blockchain.repo_contract().clone();
    // let snapshot_addr: BlockchainContractAddress = (Snapshot::calculate_address(
    //     &context.blockchain.client(),
    //     &mut repo_contract,
    //     branch_name,
    //     file_path,
    // ))
    // .await?;
    let snapshot_addr = BlockchainContractAddress::new("0000000000000000000000000000000000000000");

    let blockchain = context.blockchain.clone();
    let original_snapshot_content = original_snapshot_content.clone();
    let diff = diff.to_owned();
    let new_snapshot_content = new_snapshot_content.clone();
    let ipfs_endpoint = context.config.ipfs_http_endpoint().to_string();
    let repo_name = context.remote.repo.clone();
    let commit_id = *commit_id;
    let branch_name = branch_name.to_owned();
    let blob_id = *blob_id;
    let file_path = file_path.to_owned();
    let diff_coordinate = diff_coordinate.clone();
    let last_commit_id = *last_commit_id;
    Ok(tokio::spawn(async move {
        let mut attempt = 0;
        let result = loop {
            attempt += 1;
            let result = inner_push_diff(
                &blockchain,
                repo_name.clone(),
                snapshot_addr.clone(),
                wallet.clone(),
                &ipfs_endpoint,
                &commit_id,
                &branch_name,
                &blob_id,
                &file_path,
                &diff_coordinate,
                &last_commit_id,
                is_last,
                &original_snapshot_content,
                &diff,
                &new_snapshot_content,
            )
            .await;
            if result.is_ok() || attempt > PUSH_DIFF_MAX_TRIES {
                break result;
            } else {
                log::debug!(
                    "inner_push_diff error <path: {file_path}, commit: {commit_id}, coord: {:?}>: {:?}",
                    diff_coordinate,
                    result.unwrap_err()
                );
                std::thread::sleep(std::time::Duration::from_secs(5));
            }
        };
        result.map_err(|e| anyhow::Error::from(e))
    }))
}

pub async fn inner_push_diff(
    blockchain: &impl BlockchainService,
    repo_name: String,
    snapshot_addr: BlockchainContractAddress,
    wallet: impl ContractRead + ContractInfo + Sync + 'static,
    ipfs_endpoint: &str,
    commit_id: &git_hash::ObjectId,
    branch_name: &str,
    blob_id: &git_hash::ObjectId,
    file_path: &str,
    diff_coordinate: &PushDiffCoordinate,
    last_commit_id: &git_hash::ObjectId,
    is_last: bool,
    // TODO: why not just &[u8]
    original_snapshot_content: &Vec<u8>,
    diff: &[u8],
    new_snapshot_content: &Vec<u8>,
) -> anyhow::Result<()> {
    let diff = compress_zstd(diff, None)?;
    log::debug!("compressed to {} size", diff.len());

    // tokio::time::sleep(std::time::Duration::from_secs(10)).await;
    std::thread::sleep(std::time::Duration::from_secs(10));
    return Ok(());
    // let ipfs_client = IpfsService::new(ipfs_endpoint);
    // let (patch, ipfs) = {
    //     let mut is_going_to_ipfs = is_going_to_ipfs(&diff, new_snapshot_content);
    //     if !is_going_to_ipfs {
    //         // Ensure contract can accept this patch
    //         let original_snapshot_content = compress_zstd(original_snapshot_content, None)?;
    //         let data = serde_json::json!({
    //             "state": hex::encode(original_snapshot_content),
    //             "diff": hex::encode(&diff)
    //         });

    //         match wallet
    //             .read_state::<GetDiffResultResult>(&es_client, "getDiffResult", Some(data))
    //             .await
    //         {
    //             Ok(apply_patch_result) => {
    //                 if apply_patch_result.hex_encoded_compressed_content.is_none() {
    //                     is_going_to_ipfs = true;
    //                 }
    //             }
    //             Err(apply_patch_result_error) => {
    //                 is_going_to_ipfs = apply_patch_result_error
    //                     .to_string()
    //                     .contains("Contract execution was terminated with error: invalid opcode");
    //             }
    //         }
    //     }
    //     if is_going_to_ipfs {
    //         log::debug!("inner_push_diff->save_data_to_ipfs");
    //         let ipfs = Some(
    //             save_data_to_ipfs(&ipfs_client, new_snapshot_content)
    //                 .await
    //                 .map_err(|e| {
    //                     log::debug!("save_data_to_ipfs error: {}", e);
    //                     e
    //                 })?,
    //         );
    //         (None, ipfs)
    //     } else {
    //         (Some(hex::encode(diff)), None)
    //     }
    // };
    // let content_sha256 = {
    //     if ipfs.is_some() {
    //         format!("0x{}", sha256::digest(&**new_snapshot_content))
    //     } else {
    //         format!("0x{}", tvm_hash(&es_client, new_snapshot_content).await?)
    //     }
    // };

    // let diff = Diff {
    //     snapshot_addr,
    //     commit_id: commit_id.to_string(),
    //     patch,
    //     ipfs,
    //     sha1: blob_id.to_string(),
    //     sha256: content_sha256,
    // };

    // if diff.ipfs.is_some() {
    //     log::debug!("push_diff: {:?}", diff);
    // } else {
    //     log::trace!("push_diff: {:?}", diff);
    // }
    // let diffs: Vec<Diff> = vec![diff];

    // blockchain
    //     .deploy_diff(
    //         &wallet,
    //         repo_name,
    //         branch_name.to_string(),
    //         last_commit_id.to_string(),
    //         diffs,
    //         diff_coordinate.index_of_parallel_thread,
    //         diff_coordinate.order_of_diff_in_the_parallel_thread,
    //         is_last,
    //     )
    //     .await?;

    // Ok(())
}

pub fn is_going_to_ipfs(diff: &[u8], new_content: &[u8]) -> bool {
    let mut is_going_to_ipfs = diff.len() > crate::config::IPFS_DIFF_THRESHOLD
        || new_content.len() > crate::config::IPFS_CONTENT_THRESHOLD;
    if !is_going_to_ipfs {
        is_going_to_ipfs = std::str::from_utf8(new_content).is_err();
    }
    is_going_to_ipfs
}

// #[instrument(level = "debug")]
async fn save_data_to_ipfs(ipfs_client: &IpfsService, content: &[u8]) -> anyhow::Result<String> {
    log::debug!("Uploading blob to IPFS");
    let content: Vec<u8> = ton_client::utils::compress_zstd(content, None)?;
    let content = base64::encode(&content);
    let content = content.as_bytes().to_vec();

    ipfs_client.save_blob(&content).await
}

#[instrument(level = "debug", skip(context))]
pub async fn is_diff_deployed(
    context: &EverClient,
    contract_address: &BlockchainContractAddress,
) -> anyhow::Result<bool> {
    let diff_contract = GoshContract::new(contract_address, gosh_abi::DIFF);
    let result: anyhow::Result<GetVersionResult> =
        diff_contract.read_state(context, "getVersion", None).await;
    Ok(result.is_ok())
}

#[instrument(level = "debug", skip(context))]
pub async fn diff_address(
    context: &EverClient,
    repo_contract: &mut GoshContract,
    last_commit_id: &git_hash::ObjectId,
    diff_coordinate: &PushDiffCoordinate,
) -> anyhow::Result<BlockchainContractAddress> {
    let params = serde_json::json!({
        "commitName": last_commit_id.to_string(),
        "index1": diff_coordinate.index_of_parallel_thread,
        "index2": diff_coordinate.order_of_diff_in_the_parallel_thread,
    });
    let result: GetDiffAddrResult = repo_contract
        .run_static(&context, "getDiffAddr", Some(params))
        .await?;
    Ok(result.address)
}

#[instrument(level = "debug")]
pub async fn push_new_branch_snapshot(
    context: &mut GitHelper<impl BlockchainService>,
    commit_id: &git_hash::ObjectId,
    branch_name: &str,
    file_path: &str,
    original_content: &[u8],
) -> anyhow::Result<()> {
    let content: Vec<u8> = ton_client::utils::compress_zstd(original_content, None)?;
    log::debug!("compressed to {} size", content.len());

    let (content, ipfs) = if content.len() > config::IPFS_CONTENT_THRESHOLD {
        log::debug!("push_new_branch_snapshot->save_data_to_ipfs");
        let ipfs = Some(
            save_data_to_ipfs(&context.file_provider, original_content)
                .await
                .map_err(|e| {
                    log::debug!("save_data_to_ipfs error: {}", e);
                    e
                })?,
        );
        ("".to_string(), ipfs)
    } else {
        let content: String = content.iter().map(|e| format!("{:x?}", e)).collect();
        (content, None)
    };

    let wallet = context
        .blockchain
        .user_wallet(&context.dao_addr, &context.remote.network)
        .await?;

    context
        .blockchain
        .deploy_new_snapshot(
            &wallet,
            context.repo_addr.clone(),
            branch_name.to_string(),
            commit_id.to_string(),
            file_path.to_string(),
            content,
        )
        .await?;

    // log::debug!("deployNewSnapshot result: {:?}", result);
    Ok(())
}

// #[instrument(level = "debug", skip(context))]
pub async fn push_initial_snapshot(
    context: &mut GitHelper<impl BlockchainService + 'static>,
    branch_name: &str,
    file_path: &str,
) -> anyhow::Result<tokio::task::JoinHandle<anyhow::Result<()>>> {
    let repo_addr = context.repo_addr.clone();
    let branch_name = branch_name.to_string();
    let file_path = file_path.to_string();
    let wallet = context
        .blockchain
        .user_wallet(&context.dao_addr, &context.remote.network)
        .await?;

    let blockchain = context.blockchain.clone();

    Ok(tokio::spawn(async move {
        let mut attempt = 0;
        let result = loop {
            attempt += 1;

            let result = blockchain
                .deploy_new_snapshot(
                    &wallet,
                    repo_addr.clone(),
                    branch_name.to_string(),
                    "".to_string(),
                    file_path.to_string(),
                    "".to_string(),
                )
                .await
                .map(|_| ());

            if result.is_ok() || attempt > PUSH_SNAPSHOT_MAX_TRIES {
                break result;
            } else {
                log::debug!("inner_push_snapshot error <branch: {branch_name}, path: {file_path}>");
                std::thread::sleep(std::time::Duration::from_secs(5));
            }
        };
        log::debug!(
            "deployNewSnapshot <branch: {branch_name}, path: {file_path}> result: {:?}",
            result
        );
        result
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    use futures::{stream::FuturesUnordered, StreamExt};
    use git_hash::ObjectId;
    use git_repository::credentials::helper;
    use opentelemetry::trace::FutureExt;

    use crate::{
        blockchain::{
            self, contract::GoshContract, service::tests::MockEverscale, BlockchainContractAddress,
        },
        git_helper::{test_utils::setup_repo, tests::setup_test_helper},
    };

    #[tokio::test(flavor = "multi_thread", worker_threads = 5)]
    async fn test_push_big_diff() {
        use opentelemetry::sdk::Resource;
        use opentelemetry::KeyValue;

        use std::str::FromStr;

        use tracing_subscriber::layer::SubscriberExt;
        use tracing_subscriber::util::SubscriberInitExt;
        use tracing_subscriber::EnvFilter;

        let tracer = opentelemetry_otlp::new_pipeline()
            .tracing()
            .with_exporter(opentelemetry_otlp::new_exporter().tonic())
            .with_trace_config(
                opentelemetry::sdk::trace::config()
                    .with_sampler(opentelemetry::sdk::trace::Sampler::AlwaysOn)
                    .with_id_generator(opentelemetry::sdk::trace::RandomIdGenerator::default())
                    .with_max_events_per_span(64)
                    .with_max_attributes_per_span(16)
                    .with_max_events_per_span(16)
                    .with_resource(Resource::new(vec![KeyValue::new(
                        opentelemetry_semantic_conventions::resource::SERVICE_NAME,
                        "test_git_helper",
                    )])),
            )
            .install_batch(opentelemetry::runtime::Tokio)
            .unwrap();

        let telemetry = tracing_opentelemetry::layer()
            .with_location(true)
            .with_threads(true)
            .with_tracer(tracer);

        tracing_subscriber::registry().with(telemetry).init();

        {
            let root = trace_span!("test_push_big_normal_ref_inner");
            let _enter = root.enter();

            let repo = setup_repo("test_push_diff", "tests/fixtures/make_remote_repo.sh").unwrap();

            let mut mock_blockchain = MockEverscale::new();
            mock_blockchain
                .expect_is_branch_protected()
                .returning(|_, _| Ok(false));

            mock_blockchain.expect_remote_rev_parse().returning(|_, _| {
                Ok(Some((
                    blockchain::BlockchainContractAddress::new("test"),
                    "test".to_owned(),
                )))
            });

            mock_blockchain
                .expect_notify_commit()
                .returning(|_, _, _, _, _, _| Ok(()));

            mock_blockchain.expect_user_wallet().returning(|_, _| {
                Ok(GoshContract::new(
                    BlockchainContractAddress::new("0000000000000000000000000000000000000000"),
                    crate::abi::REPO,
                ))
            });

            let repo_contract = GoshContract::new(
                BlockchainContractAddress::new("0000000000000000000000000000000000000000"),
                crate::abi::REPO,
            );

            mock_blockchain
                .expect_repo_contract()
                .return_const(repo_contract);

            mock_blockchain
                .expect_clone()
                .returning(|| MockEverscale::new());

            // mock_blockchain.expect_client().return_const();

            let mut helper = setup_test_helper(
                json!({
                    "ipfs": "foo.endpoint"
                }),
                "gosh://1/2/3",
                repo,
                mock_blockchain,
            );

            let mut pushed_blobs: FuturesUnordered<tokio::task::JoinHandle<anyhow::Result<()>>> =
                FuturesUnordered::new();

            trace!("Time start");
            for i in 0..10 {
                trace!("{i}");
                pushed_blobs.push(
                    push_diff(
                        &mut helper,
                        &ObjectId::from_str("0000000000000000000000000000000000000000").unwrap(),
                        "main",
                        &ObjectId::from_str("0000000000000000000000000000000000000000").unwrap(),
                        "file_path",
                        &PushDiffCoordinate {
                            index_of_parallel_thread: 1,
                            order_of_diff_in_the_parallel_thread: 1,
                        },
                        &ObjectId::from_str("0000000000000000000000000000000000000000").unwrap(),
                        true,
                        &vec![0u8],
                        &vec![0u8],
                        &vec![0u8],
                    )
                    .await
                    .unwrap(),
                );
            }

            while let Some(finished_task) = pushed_blobs.next().await {
                match finished_task {
                    Err(e) => {
                        panic!("diffs joih-handler: {}", e);
                    }
                    Ok(Err(e)) => {
                        panic!("diffs inner: {}", e);
                    }
                    Ok(Ok(_)) => {
                        trace!("OK OK");
                    }
                }
            }
            trace!("Time end");
        }
        tokio::time::sleep(std::time::Duration::from_secs(20)).await;
        // global::shutdown_tracer_provider();
    }
}
