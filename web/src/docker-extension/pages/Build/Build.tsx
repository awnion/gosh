import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { TRepoLayoutOutletContext } from '../../../pages/RepoLayout'
import BranchSelect from '../../../components/BranchSelect'
import * as Yup from 'yup'
import { useGoshRepoBranches, useGoshRepoTree } from '../../../hooks/gosh.hooks'
import { Field, Form, Formik } from 'formik'
import SwitchField from '../../../components/FormikForms/SwitchField'
import DockerClient from '../../client'
import { useRecoilValue } from 'recoil'
import { userStateAtom } from '../../../store/user.state'
import TextField from '../../../components/FormikForms/TextField'
import { getCommit } from '../../../helpers'

type TBuildFormValues = {
    tag: string
    imageDockerfile: string
}

const BuildPage = () => {
    const userState = useRecoilValue(userStateAtom)
    const treePath = useParams()['*'] || ''
    const { daoName, repoName, branchName = 'main' } = useParams()
    const navigate = useNavigate()
    const { wallet, repo } = useOutletContext<TRepoLayoutOutletContext>()
    const { branches, branch, updateBranch } = useGoshRepoBranches(repo, branchName)
    const tree = useGoshRepoTree(repo, branch, treePath)
    const subtree = useRecoilValue(tree.getSubtree(treePath))
    const [output, setOutput] = useState('')

    // const [dirUp] = splitByPath(treePath)

    const isDisabled = false
    const rootContract = process.env.REACT_APP_GOSH_ADDR

    const appendLog = (...args: string[]) => {
        console.log('appendLog', args)
        setOutput((output) => {
            if (output.length === 0) {
                return args.join('\n')
            } else {
                return [output, ...args].join('\n')
            }
        })
    }

    const onBuild = async (values: TBuildFormValues, { setSubmitting }: any) => {
        setOutput('')
        console.log('onBuild', values)
        if (!!branch) {
            const commit = await getCommit(repo, branch.commitAddr)
            console.log('commit', commit)

            await DockerClient.buildImage(
                `gosh://${rootContract}/${daoName}/${repoName}`,
                commit.name,
                values.imageDockerfile,
                values.tag,
                appendLog,
                userState,
            )
        } else {
            console.error(`Error: branch has no commit address`)
        }
        setSubmitting(false)
        return
    }

    useEffect(() => {
        if (branch?.name) updateBranch(branch.name)
    }, [branch?.name, updateBranch])
    return (
        <div className="bordered-block px-7 py-8">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-4">
                <div className="grow flex items-center gap-y-2 gap-x-5">
                    <BranchSelect
                        branch={branch}
                        branches={branches}
                        onChange={(selected) => {
                            if (selected) {
                                navigate(`/${daoName}/${repoName}/build/${selected.name}`)
                            }
                        }}
                    />
                </div>
            </div>
            <div className="mt-5">
                <div className="text-lg">
                    Build Docker image on
                    <span className="font-semibold mx-2">{branch?.name}</span>
                </div>
                <Formik
                    initialValues={{
                        tag: `${repoName}:${branch?.name ?? 'latest'}`,
                        imageDockerfile: 'Dockerfile',
                    }}
                    onSubmit={onBuild}
                    validationSchema={Yup.object().shape({
                        tag: Yup.string().required('Field is required'),
                        imageDockerfile: Yup.string().required('Field is required'),
                    })}
                >
                    {({ isSubmitting }) => (
                        <Form>
                            <div className="mt-5">
                                <Field
                                    name="tag"
                                    component={TextField}
                                    inputProps={{
                                        className: 'text-sm py-1.5 w-full',
                                        autoComplete: 'off',
                                        placeholder: 'Image tag',
                                        disabled: isSubmitting || isDisabled,
                                    }}
                                />
                            </div>
                            <div className="mt-5">
                                <Field
                                    name="imageDockerfile"
                                    component={TextField}
                                    inputProps={{
                                        className: 'text-sm py-1.5 w-full',
                                        autoComplete: 'off',
                                        placeholder: 'Image dockerfile path',
                                        disabled: isSubmitting || isDisabled,
                                    }}
                                />
                            </div>
                            {/* <div className="mt-5">
                                <Field
                                    name="pushImage"
                                    component={SwitchField}
                                    className="ml-4"
                                    label="Push image after build"
                                    labelClassName="text-sm text-gray-505050"
                                    disabled={isSubmitting || isDisabled}
                                />
                            </div> */}
                            <div className="flex flex-wrap mt-4 items-center gap-3">
                                <button
                                    className="btn btn--body font-medium px-4 py-2 w-full sm:w-auto"
                                    type="submit"
                                    disabled={isSubmitting || isDisabled}
                                >
                                    {/* {isSubmitting && <Spinner className="mr-2" />} */}
                                    Build
                                </button>
                            </div>
                        </Form>
                    )}
                </Formik>
            </div>
            {output.length > 0 && (
                <div className="mt-5">
                    <pre>{output}</pre>
                </div>
            )}
        </div>
    )
}

export default BuildPage